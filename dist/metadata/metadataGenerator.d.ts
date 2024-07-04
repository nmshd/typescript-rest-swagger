import { Project } from "ts-morph";
import * as ts from "typescript";
export declare class MetadataGenerator {
    private readonly ignorePaths?;
    static current: MetadataGenerator;
    readonly nodes: ts.Node[];
    readonly typeChecker: ts.TypeChecker;
    readonly program: ts.Program;
    private referenceTypes;
    private circularDependencyResolvers;
    private debugger;
    morph: Project;
    private targetFiles;
    constructor(entryFile: string | Array<string>, tsConfigFilePath: string, ignorePaths?: Array<string> | undefined);
    generate(): Metadata;
    TypeChecker(): ts.TypeChecker;
    addReferenceType(referenceType: ReferenceType): void;
    getReferenceType(typeName: string): ReferenceType | undefined;
    getReferenceTypes(): {
        [typeName: string]: ReferenceType;
    };
    removeReferenceType(typeName: string): void;
    onFinish(callback: (referenceTypes: {
        [typeName: string]: ReferenceType;
    }) => void): void;
    private getSourceFiles;
    private buildControllers;
}
export interface Metadata {
    controllers: Array<Controller>;
    referenceTypes: {
        [typeName: string]: ReferenceType;
    };
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
    typeName: string;
    simpleTypeName?: string;
    typeArgument?: Type;
}
export interface EnumerateType extends Type {
    enumMembers: Array<string>;
}
export interface UnionType extends Type {
    types: Array<Type>;
}
export interface ReferenceType extends Type {
    description: string;
    properties: Array<Property>;
    originalFileName: any;
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
//# sourceMappingURL=metadataGenerator.d.ts.map