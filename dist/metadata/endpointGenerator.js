"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EndpointGenerator = void 0;
const debug = require("debug");
const _ = require("lodash");
const ts_morph_1 = require("ts-morph");
const ts = require("typescript");
const decoratorUtils_1 = require("../utils/decoratorUtils");
const utils_1 = require("../utils/utils");
const resolveType_1 = require("./resolveType");
class EndpointGenerator {
    node;
    debugger;
    morph;
    constructor(node, morph, name) {
        this.morph = morph;
        this.node = node;
        this.debugger = debug(`typescript-rest-swagger:metadata:${name}`);
    }
    getDecoratorValues(decoratorName, acceptMultiple = false) {
        const decorators = (0, decoratorUtils_1.getDecorators)(this.node, (decorator) => decorator.text === decoratorName);
        if (!decorators || !decorators.length) {
            return [];
        }
        if (!acceptMultiple && decorators.length > 1) {
            throw new Error(`Only one ${decoratorName} decorator allowed in ${this.getCurrentLocation()}.`);
        }
        let result;
        if (acceptMultiple) {
            result = decorators.map((d) => d.arguments);
        }
        else {
            const d = decorators[0];
            result = d.arguments;
        }
        this.debugger("Arguments of decorator %s: %j", decoratorName, result);
        return result;
    }
    getSecurity() {
        const securities = this.getDecoratorValues("Security", true);
        if (!securities || !securities.length) {
            return undefined;
        }
        return securities.map((security) => ({
            name: security[1] ? security[1] : "default",
            scopes: security[0]
                ? _.castArray(this.handleRolesArray(security[0]))
                : [],
        }));
    }
    handleRolesArray(argument) {
        if (ts.isArrayLiteralExpression(argument)) {
            return argument.elements
                .map((value) => value.getText())
                .map((val) => val && val.startsWith("'") && val.endsWith("'")
                ? val.slice(1, -1)
                : val);
        }
        else {
            return argument;
        }
    }
    getExamplesValue(argument) {
        let example = {};
        this.debugger(argument);
        if (argument.properties) {
            argument.properties.forEach((p) => {
                example[p.name.text] = this.getInitializerValue(p.initializer);
            });
        }
        else {
            example = this.getInitializerValue(argument);
        }
        this.debugger("Example extracted for %s: %j", this.getCurrentLocation(), example);
        return example;
    }
    getInitializerValue(initializer) {
        switch (initializer.kind) {
            case ts.SyntaxKind.ArrayLiteralExpression:
                return initializer.elements.map((e) => this.getInitializerValue(e));
            case ts.SyntaxKind.StringLiteral:
                return initializer.text;
            case ts.SyntaxKind.TrueKeyword:
                return true;
            case ts.SyntaxKind.FalseKeyword:
                return false;
            case ts.SyntaxKind.NumberKeyword:
            case ts.SyntaxKind.FirstLiteralToken:
                return parseInt(initializer.text, 10);
            case ts.SyntaxKind.ObjectLiteralExpression:
                const nestedObject = {};
                initializer.properties.forEach((p) => {
                    nestedObject[p.name.text] = this.getInitializerValue(p.initializer);
                });
                return nestedObject;
            default:
                return undefined;
        }
    }
    getResponses() {
        const tsMorphNode = (0, utils_1.getNodeAsTsMorphNode)(this.node, this.morph);
        if (!(tsMorphNode instanceof ts_morph_1.ClassDeclaration) &&
            !(tsMorphNode instanceof ts_morph_1.MethodDeclaration)) {
            throw new Error(`Node at position ${this.node.pos} is not a valid TypeScript node. Expected a MethodDeclaration or ClassDeclaration, but got ${tsMorphNode.getKindName()}.`);
        }
        const decorators = (0, decoratorUtils_1.getDecorators)(this.node, (decorator) => decorator.text === "Response");
        if (!decorators || !decorators.length) {
            return [];
        }
        this.debugger("Generating Responses for %s", this.getCurrentLocation());
        return tsMorphNode
            .getDecorators()
            .filter((decorator) => {
            return decorator.getName() === "Response";
        })
            .map((decorator) => {
            let description = "";
            let status = "200";
            let examples;
            const args = decorator.getArguments();
            if (args[0]) {
                status = args[0].getText();
            }
            if (args[1]) {
                description = JSON.parse(args[1].getText());
            }
            if (args[2]) {
                const argument = args[2];
                examples = this.getExamplesValue(argument.compilerNode);
            }
            let schema = undefined;
            const typeArguments = decorator.getTypeArguments();
            if (typeArguments[0]) {
                schema = (0, resolveType_1.resolveType)(typeArguments[0].getType());
            }
            const responses = {
                description: description,
                examples: examples,
                schema: schema,
                status: status,
            };
            this.debugger("Generated Responses for %s: %j", this.getCurrentLocation(), responses);
            return responses;
        });
    }
}
exports.EndpointGenerator = EndpointGenerator;
//# sourceMappingURL=endpointGenerator.js.map