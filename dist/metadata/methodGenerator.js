"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MethodGenerator = void 0;
const pathUtil = require("path");
const decoratorUtils_1 = require("../utils/decoratorUtils");
const jsDocUtils_1 = require("../utils/jsDocUtils");
const pathUtils_1 = require("../utils/pathUtils");
const endpointGenerator_1 = require("./endpointGenerator");
const parameterGenerator_1 = require("./parameterGenerator");
const resolveType_1 = require("./resolveType");
class MethodGenerator extends endpointGenerator_1.EndpointGenerator {
    controllerPath;
    genericTypeMap;
    method;
    path;
    constructor(node, controllerPath, genericTypeMap) {
        super(node, "methods");
        this.controllerPath = controllerPath;
        this.genericTypeMap = genericTypeMap;
        this.processMethodDecorators();
    }
    isValid() {
        return !!this.method;
    }
    getMethodName() {
        const identifier = this.node.name;
        return identifier.text;
    }
    generate() {
        if (!this.isValid()) {
            throw new Error("This isn't a valid controller method.");
        }
        this.debugger("Generating Metadata for method %s", this.getCurrentLocation());
        // TODO implement implicit return type 
        // const typeChecker = MetadataGenerator.current.typeChecker;
        // const signature =
        //   typeChecker.getSignatureFromDeclaration(this.node);
        // const returnType = typeChecker.getReturnTypeOfSignature(signature);
        // const kind = ts.SyntaxKind[this.node.kind];
        const identifier = this.node.name;
        const type = (0, resolveType_1.resolveType)(this.node.type, this.genericTypeMap);
        const responses = this.mergeResponses(this.getResponses(this.genericTypeMap), this.getMethodSuccessResponse(type));
        const methodMetadata = {
            consumes: this.getDecoratorValues("Consumes"),
            deprecated: (0, jsDocUtils_1.isExistJSDocTag)(this.node, "deprecated"),
            description: (0, jsDocUtils_1.getJSDocDescription)(this.node),
            method: this.method,
            name: identifier.text,
            parameters: this.buildParameters(),
            path: this.path,
            produces: this.getDecoratorValues("Produces")
                ? this.getDecoratorValues("Produces")
                : this.getDecoratorValues("Accept"),
            responses: responses,
            security: this.getSecurity(),
            summary: (0, jsDocUtils_1.getJSDocTag)(this.node, "summary"),
            tags: this.getDecoratorValues("Tags"),
            type: type,
        };
        this.debugger("Generated Metadata for method %s: %j", this.getCurrentLocation(), methodMetadata);
        return methodMetadata;
    }
    getCurrentLocation() {
        const methodId = this.node.name;
        const controllerId = this.node.parent
            .name;
        return `${controllerId.text}.${methodId.text}`;
    }
    buildParameters() {
        this.debugger("Processing method %s parameters.", this.getCurrentLocation());
        const parameters = this.node.parameters
            .map((p) => {
            try {
                const path = pathUtil.posix.join("/", this.controllerPath ? this.controllerPath : "", this.path);
                return new parameterGenerator_1.ParameterGenerator(p, this.method, path, this.genericTypeMap).generate();
            }
            catch (e) {
                const methodId = this.node.name;
                const controllerId = this.node.parent
                    .name;
                const parameterId = p.name;
                throw new Error(`Error generate parameter method: '${controllerId.text}.${methodId.text}' argument: ${parameterId.text} ${e} \n ${e.stack}`);
            }
        })
            .filter((p) => p && p.in !== "context" && p.in !== "cookie");
        const bodyParameters = parameters.filter((p) => p && p.in === "body");
        const formParameters = parameters.filter((p) => p && p.in === "formData");
        if (bodyParameters.length > 1) {
            throw new Error(`Only one body parameter allowed in '${this.getCurrentLocation()}' method.`);
        }
        if (bodyParameters.length > 0 && formParameters.length > 0) {
            throw new Error(`Choose either during @FormParam and @FileParam or body parameter  in '${this.getCurrentLocation()}' method.`);
        }
        this.debugger("Parameters list for method %s: %j.", this.getCurrentLocation(), parameters);
        return parameters;
    }
    processMethodDecorators() {
        const httpMethodDecorators = (0, decoratorUtils_1.getDecorators)(this.node, (decorator) => this.supportsPathMethod(decorator.text));
        if (!httpMethodDecorators || !httpMethodDecorators.length) {
            return;
        }
        if (httpMethodDecorators.length > 1) {
            throw new Error(`Only one HTTP Method decorator in '${this.getCurrentLocation}' method is acceptable, Found: ${httpMethodDecorators
                .map((d) => d.text)
                .join(", ")}`);
        }
        const methodDecorator = httpMethodDecorators[0];
        this.method = methodDecorator.text.toLowerCase();
        this.debugger("Processing method %s decorators.", this.getCurrentLocation());
        const pathDecorators = (0, decoratorUtils_1.getDecorators)(this.node, (decorator) => decorator.text === "Path");
        if (pathDecorators && pathDecorators.length > 1) {
            throw new Error(`Only one Path decorator in '${this.getCurrentLocation}' method is acceptable, Found: ${httpMethodDecorators
                .map((d) => d.text)
                .join(", ")}`);
        }
        if (pathDecorators) {
            const pathDecorator = pathDecorators[0];
            this.path = pathDecorator
                ? `/${(0, pathUtils_1.normalizePath)(pathDecorator.arguments[0])}`
                : "";
        }
        else {
            this.path = "";
        }
        this.debugger("Mapping endpoint %s %s", this.method, this.path);
    }
    getMethodSuccessResponse(type) {
        const responseData = this.getMethodSuccessResponseData(type);
        return {
            description: type.typeName === "void" ? "No content" : "Ok",
            examples: this.getMethodSuccessExamples(),
            schema: responseData.type,
            status: responseData.status,
        };
    }
    getMethodSuccessResponseData(type) {
        switch (type.simpleTypeName) {
            case "void":
                return { status: "204", type: type };
            case "NewResource":
                return { status: "201", type: type.typeArgument || type };
            case "RequestAccepted":
                return { status: "202", type: type.typeArgument || type };
            case "MovedPermanently":
                return { status: "301", type: type.typeArgument || type };
            case "MovedTemporarily":
                return { status: "302", type: type.typeArgument || type };
            case "DownloadResource":
            case "DownloadBinaryData":
                return { status: "200", type: { typeName: "buffer" } };
            default:
                return { status: "200", type: type };
        }
    }
    getMethodSuccessExamples() {
        const exampleDecorators = (0, decoratorUtils_1.getDecorators)(this.node, (decorator) => decorator.text === "Example");
        if (!exampleDecorators || !exampleDecorators.length) {
            return undefined;
        }
        if (exampleDecorators.length > 1) {
            throw new Error(`Only one Example decorator allowed in '${this.getCurrentLocation}' method.`);
        }
        const d = exampleDecorators[0];
        const argument = d.arguments[0];
        return this.getExamplesValue(argument);
    }
    mergeResponses(responses, defaultResponse) {
        if (!responses || !responses.length) {
            return [defaultResponse];
        }
        const index = responses.findIndex((resp) => resp.status === defaultResponse.status);
        if (index >= 0) {
            if (defaultResponse.examples && !responses[index].examples) {
                responses[index].examples = defaultResponse.examples;
            }
        }
        else {
            responses.push(defaultResponse);
        }
        return responses;
    }
    supportsPathMethod(method) {
        return ["GET", "POST", "PATCH", "DELETE", "PUT", "OPTIONS", "HEAD"].some((m) => m === method);
    }
}
exports.MethodGenerator = MethodGenerator;
//# sourceMappingURL=methodGenerator.js.map