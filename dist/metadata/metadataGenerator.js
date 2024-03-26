"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MetadataGenerator = void 0;
const debug = require("debug");
const glob = require("glob");
const _ = require("lodash");
const minimatch_1 = require("minimatch");
const ts = require("typescript");
const decoratorUtils_1 = require("../utils/decoratorUtils");
const controllerGenerator_1 = require("./controllerGenerator");
class MetadataGenerator {
    ignorePaths;
    static current;
    nodes = new Array();
    typeChecker;
    program;
    referenceTypes = {};
    circularDependencyResolvers = new Array();
    debugger = debug("typescript-rest-swagger:metadata");
    constructor(entryFile, compilerOptions, ignorePaths) {
        this.ignorePaths = ignorePaths;
        const sourceFiles = this.getSourceFiles(entryFile);
        this.debugger("Starting Metadata Generator");
        this.debugger("Source files: %j ", sourceFiles);
        this.debugger("Compiler Options: %j ", compilerOptions);
        this.program = ts.createProgram(sourceFiles, compilerOptions);
        this.typeChecker = this.program.getTypeChecker();
        MetadataGenerator.current = this;
    }
    generate() {
        this.program.getSourceFiles().forEach((sf) => {
            if (this.ignorePaths && this.ignorePaths.length) {
                for (const path of this.ignorePaths) {
                    if (!sf.fileName.includes("node_modules/typescript-rest/") &&
                        (0, minimatch_1.match)([sf.fileName], path)) {
                        return;
                    }
                }
            }
            ts.forEachChild(sf, (node) => {
                this.nodes.push(node);
            });
        });
        this.debugger("Building Metadata for controllers Generator");
        const controllers = this.buildControllers();
        this.debugger("Handling circular references");
        this.circularDependencyResolvers.forEach((c) => c(this.referenceTypes));
        return {
            controllers: controllers,
            referenceTypes: this.referenceTypes,
        };
    }
    TypeChecker() {
        return this.typeChecker;
    }
    addReferenceType(referenceType) {
        this.referenceTypes[referenceType.typeName] = referenceType;
    }
    getReferenceType(typeName) {
        return this.referenceTypes[typeName];
    }
    onFinish(callback) {
        this.circularDependencyResolvers.push(callback);
    }
    getClassDeclaration(className) {
        const found = this.nodes.filter((node) => {
            const classDeclaration = node;
            return (node.kind === ts.SyntaxKind.ClassDeclaration &&
                classDeclaration.name &&
                classDeclaration.name.text === className);
        });
        if (found && found.length) {
            return found[0];
        }
        return undefined;
    }
    getInterfaceDeclaration(className) {
        const found = this.nodes.filter((node) => {
            const interfaceDeclaration = node;
            return (node.kind === ts.SyntaxKind.InterfaceDeclaration &&
                interfaceDeclaration.name &&
                interfaceDeclaration.name.text === className);
        });
        if (found && found.length) {
            return found[0];
        }
        return undefined;
    }
    getSourceFiles(sourceFiles) {
        this.debugger("Getting source files from expressions");
        this.debugger("Source file patterns: %j ", sourceFiles);
        const sourceFilesExpressions = _.castArray(sourceFiles);
        const result = new Set();
        const options = { cwd: process.cwd() };
        sourceFilesExpressions.forEach((pattern) => {
            this.debugger("Searching pattern: %s with options: %j", pattern, options);
            const matches = glob.sync(pattern, options);
            matches.forEach((file) => result.add(file));
        });
        return Array.from(result);
    }
    buildControllers() {
        return this.nodes
            .filter((node) => node.kind === ts.SyntaxKind.ClassDeclaration)
            .filter((node) => !(0, decoratorUtils_1.isDecorator)(node, (decorator) => "Hidden" === decorator.text))
            .map((classDeclaration) => new controllerGenerator_1.ControllerGenerator(classDeclaration))
            .filter((generator) => generator.isValid())
            .map((generator) => generator.generate());
    }
}
exports.MetadataGenerator = MetadataGenerator;
//# sourceMappingURL=metadataGenerator.js.map