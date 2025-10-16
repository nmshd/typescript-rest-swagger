"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ParameterGenerator = void 0;
const ts = require("typescript");
const decoratorUtils_1 = require("../utils/decoratorUtils");
const utils_1 = require("../utils/utils");
const metadataGenerator_1 = require("./metadataGenerator");
const resolveType_1 = require("./resolveType");
class ParameterGenerator {
    parameter;
    method;
    path;
    morph;
    constructor(parameter, method, path, morph) {
        this.parameter = parameter;
        this.method = method;
        this.path = path;
        this.morph = morph;
    }
    generate(bodyDecorator) {
        const decoratorName = (0, decoratorUtils_1.getDecoratorName)(this.parameter, (identifier) => this.supportParameterDecorator(identifier.text));
        switch (decoratorName) {
            case "Param":
                return this.getRequestParameter(this.parameter);
            case "CookieParam":
                return this.getCookieParameter(this.parameter);
            case "FormParam":
                return this.getFormParameter(this.parameter);
            case "HeaderParam":
                return this.getHeaderParameter(this.parameter);
            case "QueryParam":
                return this.getQueryParameter(this.parameter);
            case "PathParam":
                return this.getPathParameter(this.parameter);
            case "FileParam":
                return this.getFileParameter(this.parameter);
            case "FilesParam":
                return this.getFilesParameter(this.parameter);
            case "Context":
            case "ContextRequest":
            case "ContextResponse":
            case "ContextNext":
            case "ContextLanguage":
            case "ContextAccept":
                return this.getContextParameter(this.parameter);
            default:
                return this.getBodyParameter(this.parameter, bodyDecorator);
        }
    }
    getCurrentLocation() {
        const methodId = this.parameter.parent
            .name;
        const controllerId = this.parameter.parent
            .parent.name;
        return `${controllerId.text}.${methodId.text}`;
    }
    getRequestParameter(parameter) {
        const parameterName = parameter.name.text;
        const type = this.getValidatedType(parameter);
        if (!this.supportsBodyParameters(this.method)) {
            throw new Error(`Param can't support '${this.getCurrentLocation()}' method.`);
        }
        return {
            description: this.getParameterDescription(parameter),
            in: "param",
            name: (0, decoratorUtils_1.getDecoratorTextValue)(this.parameter, (ident) => ident.text === "Param") || parameterName,
            parameterName: parameterName,
            required: this.isRequired(parameter),
            type: type,
        };
    }
    getContextParameter(parameter) {
        const parameterName = parameter.name.text;
        return {
            description: this.getParameterDescription(parameter),
            in: "context",
            name: parameterName,
            parameterName: parameterName,
            required: this.isRequired(parameter),
            type: { typeName: "" },
        };
    }
    getCookieParameter(parameter) {
        const parameterName = parameter.name.text;
        //        const type = this.getValidatedType(parameter);
        // if (!this.supportPathDataType(type)) {
        //     throw new Error(`Cookie can't support '${this.getCurrentLocation()}' method.`);
        // }
        return {
            description: this.getParameterDescription(parameter),
            in: "cookie",
            name: (0, decoratorUtils_1.getDecoratorTextValue)(this.parameter, (ident) => ident.text === "CookieParam") || parameterName,
            parameterName: parameterName,
            required: this.isRequired(parameter),
            type: { typeName: "" },
        };
    }
    getBodyParameter(parameter, bodyDecorator) {
        const parameterName = parameter.name.text;
        if (bodyDecorator) {
            const type = bodyDecorator.typeArguments;
            //TODO implement Body Type Decorator
            debugger;
        }
        const type = this.getValidatedType(parameter);
        if (!this.supportsBodyParameters(this.method)) {
            throw new Error(`Body can't support ${this.method} method`);
        }
        return {
            description: this.getParameterDescription(parameter),
            in: "body",
            name: parameterName,
            parameterName: parameterName,
            required: this.isRequired(parameter),
            type: type,
        };
    }
    getHeaderParameter(parameter) {
        const parameterName = parameter.name.text;
        const type = this.getValidatedType(parameter);
        if (!this.supportPathDataType(type)) {
            throw new InvalidParameterException(`Parameter '${parameterName}' can't be passed as a header parameter in '${this.getCurrentLocation()}'.`);
        }
        return {
            description: this.getParameterDescription(parameter),
            in: "header",
            name: (0, decoratorUtils_1.getDecoratorTextValue)(this.parameter, (ident) => ident.text === "HeaderParam") || parameterName,
            parameterName: parameterName,
            required: this.isRequired(parameter),
            type: type,
        };
    }
    getQueryParameter(parameter) {
        const parameterName = parameter.name.text;
        const parameterOptions = (0, decoratorUtils_1.getDecoratorOptions)(this.parameter, (ident) => ident.text === "QueryParam") || {};
        let type = this.getValidatedType(parameter);
        if ((0, metadataGenerator_1.isUnionType)(type)) {
            const typeWithoutUndefined = type.types.filter((t) => t.typeName !== "undefined");
            if (typeWithoutUndefined.length === 1) {
                type = typeWithoutUndefined[0];
            }
        }
        if (!this.supportQueryDataType(type)) {
            const arrayType = (0, resolveType_1.getCommonPrimitiveAndArrayUnionType)((0, utils_1.getNodeAsTsMorphNode)(parameter, this.morph).getType());
            if (arrayType && this.supportQueryDataType(arrayType)) {
                type = arrayType;
            }
            else {
                throw new InvalidParameterException(`Parameter '${parameterName}' can't be passed as a query parameter in '${this.getCurrentLocation()}'.`);
            }
        }
        return {
            // allowEmptyValue: parameterOptions.allowEmptyValue,
            collectionFormat: parameterOptions.collectionFormat,
            default: this.getDefaultValue(parameter.initializer),
            description: this.getParameterDescription(parameter),
            in: "query",
            // maxItems: parameterOptions.maxItems,
            // minItems: parameterOptions.minItems,
            name: (0, decoratorUtils_1.getDecoratorTextValue)(this.parameter, (ident) => ident.text === "QueryParam") || parameterName,
            parameterName: parameterName,
            required: this.isRequired(parameter),
            type: type,
        };
    }
    isRequired(parameter) {
        let isUndefinedUnion = parameter.type?.kind === ts.SyntaxKind.UnionType &&
            parameter.type.types.some((t) => t.kind === ts.SyntaxKind.UndefinedKeyword);
        return (!parameter.questionToken && !parameter.initializer && !isUndefinedUnion);
    }
    getPathParameter(parameter) {
        const parameterName = parameter.name.text;
        const type = this.getValidatedType(parameter);
        const pathName = (0, decoratorUtils_1.getDecoratorTextValue)(this.parameter, (ident) => ident.text === "PathParam") || parameterName;
        if (!this.supportPathDataType(type)) {
            throw new InvalidParameterException(`Parameter '${parameterName}:${type}' can't be passed as a path parameter in '${this.getCurrentLocation()}'.`);
        }
        if (!this.path.includes(`{${pathName}}`) &&
            !this.path.includes(`:${pathName}`)) {
            throw new Error(`Parameter '${parameterName}' can't match in path: '${this.path}'`);
        }
        return {
            description: this.getParameterDescription(parameter),
            in: "path",
            name: pathName,
            parameterName: parameterName,
            required: true,
            type: type,
        };
    }
    getParameterDescription(node) {
        const symbol = metadataGenerator_1.MetadataGenerator.current.typeChecker.getSymbolAtLocation(node.name);
        if (symbol) {
            const comments = symbol.getDocumentationComment(metadataGenerator_1.MetadataGenerator.current.typeChecker);
            if (comments.length) {
                return ts.displayPartsToString(comments);
            }
        }
        return "";
    }
    supportsBodyParameters(method) {
        return ["delete", "post", "put", "patch"].some((m) => m === method);
    }
    supportParameterDecorator(decoratorName) {
        return [
            "HeaderParam",
            "QueryParam",
            "Param",
            "FileParam",
            "PathParam",
            "FilesParam",
            "FormParam",
            "CookieParam",
            "Context",
            "ContextRequest",
            "ContextResponse",
            "ContextNext",
            "ContextLanguage",
            "ContextAccept",
        ].some((d) => d === decoratorName);
    }
    supportPathDataType(parameterType) {
        return [
            "string",
            "integer",
            "long",
            "float",
            "double",
            "date",
            "datetime",
            "buffer",
            "boolean",
            "enum",
        ].find((t) => t === parameterType.typeName);
    }
    supportQueryDataType(parameterType) {
        // Copied from supportPathDataType and added 'array'. Not sure if all options apply to queries, but kept to avoid breaking change.
        return [
            "string",
            "integer",
            "long",
            "float",
            "double",
            "date",
            "datetime",
            "buffer",
            "boolean",
            "enum",
            "array",
        ].find((t) => t === parameterType.typeName);
    }
    getValidatedType(parameter) {
        if (!parameter.type) {
            throw new Error(`Parameter ${parameter.name} doesn't have a valid type assigned in '${this.getCurrentLocation()}'.`);
        }
        const nodeAsTsMorphNode = (0, utils_1.getNodeAsTsMorphNode)(parameter, this.morph);
        return (0, resolveType_1.resolveType)(nodeAsTsMorphNode.getType(), undefined, nodeAsTsMorphNode);
    }
    getDefaultValue(initializer) {
        if (!initializer) {
            return;
        }
        return (0, resolveType_1.getLiteralValue)(initializer, this.morph);
    }
}
exports.ParameterGenerator = ParameterGenerator;
class InvalidParameterException extends Error {
}
//# sourceMappingURL=parameterGenerator.js.map