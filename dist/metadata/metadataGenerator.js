"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MetadataGenerator = void 0;
const debug = require("debug");
const glob_1 = require("glob");
const minimatch_1 = require("minimatch");
const path_1 = require("path");
const ts_morph_1 = require("ts-morph");
const ts = require("typescript");
const decoratorUtils_1 = require("../utils/decoratorUtils");
const controllerGenerator_1 = require("./controllerGenerator");
const _ = require("lodash");
class MetadataGenerator {
    ignorePaths;
    static current;
    nodes = new Array();
    typeChecker;
    program;
    referenceTypes = {};
    circularDependencyResolvers = new Array();
    debugger = debug("typescript-rest-swagger:metadata");
    morph;
    targetFiles;
    constructor(entryFile, tsConfigFilePath, ignorePaths) {
        this.ignorePaths = ignorePaths;
        this.targetFiles = this.getSourceFiles(entryFile);
        this.debugger("Starting Metadata Generator");
        this.debugger("Entry File: %j ", entryFile);
        this.debugger("Ts Config Path: %j ", tsConfigFilePath);
        this.morph = new ts_morph_1.Project({
            tsConfigFilePath: tsConfigFilePath,
        });
        this.morph.addSourceFilesAtPaths(entryFile);
        MetadataGenerator.current = this;
        this.program = this.morph.getProgram().compilerObject;
        this.typeChecker = this.program.getTypeChecker();
    }
    generate() {
        this.program.getSourceFiles().forEach((sf) => {
            if (this.ignorePaths && this.ignorePaths.length) {
                for (const path of this.ignorePaths) {
                    if ((0, minimatch_1.match)([sf.fileName], path).length > 0) {
                        return;
                    }
                }
            }
            if (sf.fileName.includes("node_modules"))
                return;
            let matchTargetFile = this.targetFiles.some((targetFile) => {
                return (0, path_1.relative)(process.cwd(), sf.fileName).includes(targetFile);
            });
            if (!matchTargetFile)
                return;
            let addNodes = (node) => {
                this.nodes.push(node);
                if (node.kind === ts.SyntaxKind.ModuleDeclaration ||
                    node.kind === ts.SyntaxKind.ModuleBlock) {
                    ts.forEachChild(node, addNodes);
                }
            };
            ts.forEachChild(sf, addNodes);
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
    getReferenceTypes() {
        return this.referenceTypes;
    }
    removeReferenceType(typeName) {
        delete this.referenceTypes[typeName];
    }
    onFinish(callback) {
        this.circularDependencyResolvers.push(callback);
    }
    getSourceFiles(sourceFiles) {
        this.debugger("Getting source files from expressions");
        this.debugger("Source file patterns: %j ", sourceFiles);
        const sourceFilesExpressions = _.castArray(sourceFiles);
        const result = new Set();
        const options = { cwd: process.cwd() };
        sourceFilesExpressions.forEach((pattern) => {
            this.debugger("Searching pattern: %s with options: %j", pattern, options);
            const matches = glob_1.glob.sync(pattern, options);
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