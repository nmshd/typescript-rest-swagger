import * as debug from 'debug';
import { glob } from 'glob';
import { match } from 'minimatch';
import { relative } from 'path';
import { Project } from 'ts-morph';
import * as ts from 'typescript';
import { isDecorator } from '../utils/decoratorUtils';
import { ControllerGenerator } from './controllerGenerator';
import _ = require('lodash');

export class MetadataGenerator {
    public static current: MetadataGenerator;
    public readonly nodes = new Array<ts.Node>();
    public readonly typeChecker: ts.TypeChecker;
    public readonly program: ts.Program;
    private referenceTypes: {
        [typeName: string]: ReferenceType;
    } = {};
    private circularDependencyResolvers = new Array<(referenceTypes: { [typeName: string]: ReferenceType }) => void>();
    private debugger = debug('typescript-rest-swagger:metadata');
    public morph: Project;
    private targetFiles: string[];

    constructor(
        entryFile: string | Array<string>,
        tsConfigFilePath: string,
        private readonly ignorePaths?: Array<string>
    ) {
        this.targetFiles = this.getSourceFiles(entryFile);
        this.debugger('Starting Metadata Generator');
        this.debugger('Entry File: %j ', entryFile);
        this.debugger('Ts Config Path: %j ', tsConfigFilePath);
        this.morph = new Project({
            compilerOptions: {
                //Enforce strict null check to be disabled as this ensures optional types are handled correctly
                strictNullChecks: false
            },
            tsConfigFilePath: tsConfigFilePath
        });
        this.morph.addSourceFilesAtPaths(entryFile);
        MetadataGenerator.current = this;
        this.program = this.morph.getProgram().compilerObject;
        this.typeChecker = this.program.getTypeChecker();
    }

    public generate(): Metadata {
        this.program.getSourceFiles().forEach((sf) => {
            if (this.ignorePaths && this.ignorePaths.length) {
                for (const path of this.ignorePaths) {
                    if (match([sf.fileName], path).length > 0) {
                        return;
                    }
                }
            }
            if (sf.fileName.includes('node_modules')) return;

            let matchTargetFile = this.targetFiles.some((targetFile) => {
                return relative(process.cwd(), sf.fileName).includes(targetFile);
            });

            if (!matchTargetFile) return;

            let addNodes = (node: ts.Node) => {
                this.nodes.push(node);
                if (node.kind === ts.SyntaxKind.ModuleDeclaration || node.kind === ts.SyntaxKind.ModuleBlock) {
                    ts.forEachChild(node, addNodes);
                }
            };
            ts.forEachChild(sf, addNodes);
        });

        this.debugger('Building Metadata for controllers Generator');
        const controllers = this.buildControllers();

        this.debugger('Handling circular references');
        this.circularDependencyResolvers.forEach((c) => c(this.referenceTypes));

        return {
            controllers: controllers,
            referenceTypes: this.referenceTypes
        };
    }

    public TypeChecker() {
        return this.typeChecker;
    }

    public addReferenceType(referenceType: ReferenceType) {
        this.referenceTypes[referenceType.typeName] = referenceType;
    }

    public getReferenceType(typeName: string): ReferenceType | undefined {
        return this.referenceTypes[typeName];
    }
    public getReferenceTypes() {
        return this.referenceTypes;
    }

    public removeReferenceType(typeName: string) {
        delete this.referenceTypes[typeName];
    }

    public onFinish(callback: (referenceTypes: { [typeName: string]: ReferenceType }) => void) {
        this.circularDependencyResolvers.push(callback);
    }

    private getSourceFiles(sourceFiles: string | Array<string>) {
        this.debugger('Getting source files from expressions');
        this.debugger('Source file patterns: %j ', sourceFiles);
        const sourceFilesExpressions = _.castArray(sourceFiles);
        const result: Set<string> = new Set<string>();
        const options = { cwd: process.cwd() };
        sourceFilesExpressions.forEach((pattern) => {
            this.debugger('Searching pattern: %s with options: %j', pattern, options);
            const matches = glob.sync(pattern, options);
            matches.forEach((file) => result.add(file));
        });

        return Array.from(result);
    }
    private buildControllers() {
        return this.nodes
            .filter((node) => node.kind === ts.SyntaxKind.ClassDeclaration)
            .filter((node) => !isDecorator(node, (decorator) => 'Hidden' === decorator.text))
            .map((classDeclaration: ts.ClassDeclaration) => new ControllerGenerator(classDeclaration, this.morph))
            .filter((generator) => generator.isValid())
            .map((generator) => generator.generate());
    }
}

export interface Metadata {
    controllers: Array<Controller>;
    referenceTypes: { [typeName: string]: ReferenceType };
}

export interface Controller {
    location: string;
    methods: Array<Method>;
    name: string;
    path: string;
    consumes: Array<string>;
    produces: Array<string>;
    responses: Array<ResponseType>;
    tags: Array<string>;
    security?: Array<Security>;
}

export interface Method {
    deprecated?: boolean;
    description: string;
    method: string;
    name: string;
    parameters: Array<Parameter>;
    path: string;
    type: Type;
    tags: Array<string>;
    responses: Array<ResponseType>;
    security?: Array<Security>;
    summary?: string;
    consumes: Array<string>;
    produces: Array<string>;
}

export interface Parameter {
    parameterName: string;
    description: string;
    in: string;
    name: string;
    required: boolean;
    type: Type;
    collectionFormat?: boolean;
    allowEmptyValue?: boolean;
    default?: any;
    maxItems?: number;
    minItems?: number;
}

export interface Security {
    name: string;
    scopes?: Array<string>;
}

export interface Type {
    typeName:
        | 'array'
        | 'object'
        | 'void'
        | 'string'
        | 'double'
        | 'boolean'
        | 'buffer'
        | 'integer'
        | 'long'
        | 'float'
        | 'date'
        | 'datetime'
        | 'enum'
        | 'undefined'
        | 'const'
        | string;
    simpleTypeName?: string;
    typeArgument?: Type;
}

export interface ConstType extends Type {
    typeName: 'const';
    value: string | number | boolean | object;
}

export interface EnumerateType extends Type {
    typeName: 'enum';
    enumMembers: Array<string | number>;
}

export interface UnionType extends Type {
    typeName: string;
    types: Array<Type>;
}

export const isUnionType = (type: Type): type is UnionType => {
    return (type as UnionType).types !== undefined;
};

export interface ReferenceType extends Type {
    typeName: string;
    description: string;
    properties: Array<Property>;
    originalFileName: any;
    // additionalProperties?: Array<Property>;
}

export interface ObjectType extends Type {
    properties: Array<Property>;
}

export interface ArrayType extends Type {
    elementType: Type;
}

export interface ResponseType {
    description: string;
    status: string;
    schema?: Type;
    examples?: any;
}

export interface Property {
    description: string;
    name: string;
    type: Type;
    required: boolean;
}

export interface ResponseData {
    status: string;
    type: Type;
}
