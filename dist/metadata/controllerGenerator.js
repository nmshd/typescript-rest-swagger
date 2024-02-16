"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ControllerGenerator = void 0;
const _ = require("lodash");
const ts = require("typescript");
const decoratorUtils_1 = require("../utils/decoratorUtils");
const pathUtils_1 = require("../utils/pathUtils");
const endpointGenerator_1 = require("./endpointGenerator");
const methodGenerator_1 = require("./methodGenerator");
const resolveType_1 = require("./resolveType");
class ControllerGenerator extends endpointGenerator_1.EndpointGenerator {
    pathValue;
    genMethods = new Set();
    constructor(node) {
        super(node, 'controllers');
        this.pathValue = (0, pathUtils_1.normalizePath)((0, decoratorUtils_1.getDecoratorTextValue)(node, decorator => decorator.text === 'Path'));
    }
    isValid() {
        return !!this.pathValue || this.pathValue === '';
    }
    generate() {
        if (!this.node.parent) {
            throw new Error('Controller node doesn\'t have a valid parent source file.');
        }
        if (!this.node.name) {
            throw new Error('Controller node doesn\'t have a valid name.');
        }
        const sourceFile = this.node.parent.getSourceFile();
        this.debugger('Generating Metadata for controller %s', this.getCurrentLocation());
        this.debugger('Controller path: %s', this.pathValue);
        const controllerMetadata = {
            consumes: this.getDecoratorValues('Consumes'),
            location: sourceFile.fileName,
            methods: this.buildMethods(),
            name: this.getCurrentLocation(),
            path: this.pathValue || '',
            produces: (this.getDecoratorValues('Produces') ? this.getDecoratorValues('Produces') : this.getDecoratorValues('Accept')),
            responses: this.getResponses(),
            security: this.getSecurity(),
            tags: this.getDecoratorValues('Tags'),
        };
        this.debugger('Generated Metadata for controller %s: %j', this.getCurrentLocation(), controllerMetadata);
        return controllerMetadata;
    }
    getCurrentLocation() {
        return this.node.name.text;
    }
    buildMethods() {
        let result = [];
        let targetClass = {
            type: this.node,
            typeArguments: null
        };
        while (targetClass) {
            result = _.union(result, this.buildMethodsForClass(targetClass.type, targetClass.typeArguments));
            targetClass = (0, resolveType_1.getSuperClass)(targetClass.type, targetClass.typeArguments);
        }
        return result;
    }
    buildMethodsForClass(node, genericTypeMap) {
        return node.members
            .filter(m => (m.kind === ts.SyntaxKind.MethodDeclaration))
            .filter(m => !(0, decoratorUtils_1.isDecorator)(m, decorator => 'Hidden' === decorator.text))
            .map((m) => new methodGenerator_1.MethodGenerator(m, this.pathValue || '', genericTypeMap))
            .filter(generator => {
            if (generator.isValid() && !this.genMethods.has(generator.getMethodName())) {
                this.genMethods.add(generator.getMethodName());
                return true;
            }
            return false;
        })
            .map(generator => generator.generate());
    }
}
exports.ControllerGenerator = ControllerGenerator;
//# sourceMappingURL=controllerGenerator.js.map