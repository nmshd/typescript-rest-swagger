"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveType = resolveType;
exports.getCommonPrimitiveAndArrayUnionType = getCommonPrimitiveAndArrayUnionType;
exports.getLiteralValue = getLiteralValue;
const ts_morph_1 = require("ts-morph");
const ts = require("typescript");
const jsDocUtils_1 = require("../utils/jsDocUtils");
const metadataGenerator_1 = require("./metadataGenerator");
const syntaxKindMap = {};
syntaxKindMap[ts.SyntaxKind.NumberKeyword] = "number";
syntaxKindMap[ts.SyntaxKind.StringKeyword] = "string";
syntaxKindMap[ts.SyntaxKind.BooleanKeyword] = "boolean";
syntaxKindMap[ts.SyntaxKind.VoidKeyword] = "void";
syntaxKindMap[ts.SyntaxKind.UndefinedKeyword] = "undefined";
function resolveType(type, parentTypeMap, node) {
    if (!type) {
        return { typeName: "void" };
    }
    let resultType = { typeName: "void" };
    const typeObject = getTypeObject(type);
    const debug = Object.getOwnPropertyNames(ts_morph_1.Type.prototype).reduce((prev, curr) => {
        if (type[curr] &&
            typeof type[curr] === "function" &&
            curr.includes("get")) {
            try {
                // @ts-expect-error
                prev[curr] = type[curr]();
            }
            catch {
                // Ignore errors in debug methods
            }
        }
        return prev;
    }, {});
    const typeArgumentsMap = getTypeArgumentMap(type);
    const specialType = handleSpecialTypes(type, node);
    if (specialType) {
        return specialType;
    }
    switch (true) {
        case typeObject.isTypeParameter:
            if (!parentTypeMap) {
                throw new Error(`Type parameter ${type
                    .getSymbolOrThrow()
                    .getName()} is not resolved. Type arguments map is empty.`);
            }
            const resolvedType = parentTypeMap[type.getText()];
            debugger;
            break;
        // return resolveType(resolvedType, getTypeArgumentMap(resolvedType));
        case typeObject.isEnumLiteral:
            debugger;
            break;
        case typeObject.isTuple:
            debugger;
            break;
        case typeObject.isIntersection:
            debugger;
            break;
        case typeObject.isAny:
        case typeObject.isUnknown:
            resultType = { typeName: "object" };
            break;
        case typeObject.isNever:
        case typeObject.isNull:
        case typeObject.isVoid:
            resultType = { typeName: "void" };
            break;
        case typeObject.isUndefined:
            resultType = { typeName: "undefined" };
            break;
        case typeObject.isBoolean:
        case typeObject.isBooleanLiteral:
            resultType = { typeName: "boolean" };
            break;
        case typeObject.isString:
        case typeObject.isTemplateLiteral:
        case typeObject.isStringLiteral:
            resultType = { typeName: "string" };
            break;
        case typeObject.isNumberLiteral:
        case typeObject.isNumber:
            resultType = { typeName: "double" };
            break;
        case typeObject.isBigIntLiteral:
        case typeObject.isBigInt:
            resultType = { typeName: "long" };
            break;
        case typeObject.isArray:
        case typeObject.isReadonlyArray:
            const arrayElementType = type.getArrayElementTypeOrThrow();
            const arrayType = {
                typeName: "array",
                elementType: resolveType(arrayElementType, typeArgumentsMap),
            };
            return arrayType;
        // Wanted fall through to handle object types
        case typeObject.isObject && type.getProperties().length === 0:
            return { typeName: "object" };
        case typeObject.isInterface:
        case typeObject.isClass:
        case typeObject.isClassOrInterface:
        case typeObject.isObject:
            const node = type.getSymbol()?.getDeclarations()[0];
            if (!node) {
                throw new Error(`Node is required to resolve type for ${type.getText()}`);
            }
            let typeName = type.getText(node);
            // sometimes the type text is the pure definition {prop:string} those need to be filtered out
            if (typeName.trim().startsWith("{")) {
                typeName = "";
            }
            typeName = replaceNameText(typeName);
            const cachedType = metadataGenerator_1.MetadataGenerator.current.getReferenceType(typeName);
            if (cachedType) {
                return cachedType;
            }
            const tc = metadataGenerator_1.MetadataGenerator.current.morph.getTypeChecker();
            const properties = type.getProperties().map((prop) => {
                const tcType = tc.getTypeOfSymbolAtLocation(prop, node);
                const propNode = prop.getDeclarations()[0];
                // if (typeName === "Something") {
                // let a = undefined;
                // }
                let description = (0, jsDocUtils_1.getJSDocDescriptionFromProperty)(propNode, node);
                return {
                    name: prop.getName(),
                    required: !prop.isOptional(),
                    type: resolveType(tcType, undefined, propNode),
                    description,
                };
            });
            if (!typeName) {
                return {
                    typeName: "",
                    properties,
                };
            }
            const referenceType = {
                properties,
                originalFileName: node.getSourceFile().getFilePath(),
                typeName,
                simpleTypeName: type.getSymbol()?.getName() ?? "",
                description: "",
            };
            metadataGenerator_1.MetadataGenerator.current.addReferenceType(referenceType);
            return referenceType;
        case typeObject.isEnum:
            const declaration = type.getSymbolOrThrow().getValueDeclarationOrThrow();
            if (!(declaration instanceof ts_morph_1.EnumDeclaration)) {
                throw new Error(`Expected EnumDeclaration, but got ${declaration.getKindName()} for ${type
                    .getSymbolOrThrow()
                    .getName()}`);
            }
            const enumMembers = declaration.getMembers().map((member, index) => {
                return member.getValue();
            });
            const uniqueTypes = enumMembers
                .map((a) => typeof a)
                .reduce((curr, next) => {
                if (!curr.includes(next)) {
                    curr.push(next);
                }
                return curr;
            }, new Array());
            if (uniqueTypes.length > 1) {
                throw new Error(`Mixed enum types are not supported by OpenAPI/Swagger.
          Enum ${type.getText()} has mixed types.`);
            }
            return {
                typeName: "enum",
                enumMembers: enumMembers,
            };
        case typeObject.isUnion:
            const types = type.getUnionTypes().map(getTypeObject);
            const allTheSameLiteralType = types.every((t, i, a) => {
                return t.isLiteral && JSON.stringify(a[0]) === JSON.stringify(t);
            });
            if (allTheSameLiteralType) {
                return {
                    typeName: "enum",
                    enumMembers: type.getUnionTypes().map((t) => t.getLiteralValue()),
                };
            }
            const unionTypes = type.getUnionTypes().map((subType) => {
                return resolveType(subType, typeArgumentsMap);
            });
            return {
                types: unionTypes,
                typeName: "",
            };
        case typeObject.isLiteral:
        default:
            const apparentType = type.getApparentType();
            if (apparentType) {
                debugger;
                return resolveType(apparentType, typeArgumentsMap);
            }
            debugger;
    }
    return resultType;
}
/**
 * Used to identify union types of a primitive and array of the same primitive, e.g. `string | string[]`
 */
function getCommonPrimitiveAndArrayUnionType(type) {
    if (type && type.isUnion()) {
        const union = type;
        const types = union
            .getUnionTypes()
            .map((t) => {
            return resolveType(t);
        })
            .filter((t) => t.typeName !== "undefined");
        const arrType = types.find((t) => t.typeName === "array");
        const primitiveType = types.find((t) => t.typeName !== "array");
        if (types.length === 2 &&
            arrType &&
            arrType.elementType &&
            primitiveType &&
            arrType.elementType.typeName === primitiveType.typeName) {
            return arrType;
        }
    }
    return null;
}
function getLiteralValue(expression) {
    if (expression.kind === ts.SyntaxKind.StringLiteral) {
        return expression.text;
    }
    if (expression.kind === ts.SyntaxKind.NumericLiteral) {
        return parseFloat(expression.text);
    }
    if (expression.kind === ts.SyntaxKind.TrueKeyword) {
        return true;
    }
    if (expression.kind === ts.SyntaxKind.FalseKeyword) {
        return false;
    }
    if (expression.kind === ts.SyntaxKind.ArrayLiteralExpression) {
        return expression.elements.map((e) => getLiteralValue(e));
    }
    return;
}
function getTypeObject(type) {
    const typeObject = {
        isAny: type.isAny(),
        isUnknown: type.isUnknown(),
        isAnonymous: type.isAnonymous(),
        isNever: type.isNever(),
        isNull: type.isNull(),
        isVoid: type.isVoid(),
        isUndefined: type.isUndefined(),
        isBoolean: type.isBoolean(),
        isBooleanLiteral: type.isBooleanLiteral(),
        isString: type.isString(),
        isTemplateLiteral: type.isTemplateLiteral(),
        isStringLiteral: type.isStringLiteral(),
        isNumberLiteral: type.isNumberLiteral(),
        isNumber: type.isNumber(),
        isBigIntLiteral: type.isBigIntLiteral(),
        isBigInt: type.isBigInt(),
        isArray: type.isArray(),
        isReadonlyArray: type.isReadonlyArray(),
        isLiteral: type.isLiteral(),
        isEnumLiteral: type.isEnumLiteral(),
        isClass: type.isClass(),
        isClassOrInterface: type.isClassOrInterface(),
        isEnum: type.isEnum(),
        isInterface: type.isInterface(),
        isObject: type.isObject(),
        isTypeParameter: type.isTypeParameter(),
        isTuple: type.isTuple(),
        isUnion: type.isUnion(),
        isIntersection: type.isIntersection(),
        isUnionOrIntersection: type.isUnionOrIntersection(),
    };
    const typeKey = Object.fromEntries(Object.entries(typeObject).filter(([_, value]) => value));
    return typeKey;
}
function replaceNameText(text = "") {
    return text
        .replace(/\</g, "-")
        .replace(/\>/g, "-")
        .replace(/\,/g, ".")
        .replace(/\|/g, "_or_")
        .replace(/\[\]/g, "Array")
        .replace(/[^A-Z|a-z|0-9|_|\-|.]/g, "");
}
function getTypeArgumentMap(type) {
    return Object.fromEntries(type
        .getTargetType()
        ?.getTypeArguments()
        .map((typeArgument, index) => {
        return [
            typeArgument.getText(),
            type.getTypeArguments()[index],
        ];
    }) ?? []);
}
function handleSpecialTypes(type, node) {
    let symbolText = type.getSymbol()?.getName() ?? "";
    if (symbolText === "Promise") {
        const typeArgument = type.getTypeArguments()[0];
        if (!typeArgument) {
            throw new Error(`Promise type ${type.getText()} is not resolved. Type argument is missing.`);
        }
        return resolveType(typeArgument);
    }
    if (symbolText === "Buffer") {
        return { typeName: "buffer" };
    }
    if (symbolText === "DownloadBinaryData") {
        return { typeName: "buffer" };
    }
    if (symbolText === "DownloadResource") {
        return { typeName: "buffer" };
    }
    if (symbolText === "Date") {
        if (!node) {
            return { typeName: "datetime" };
        }
        if (ts_morph_1.Node.isDecoratable(node)) {
            const decorators = node.getDecorators();
            const decoratorName = decorators.map((decorator) => decorator.getName());
            switch (true) {
                case decoratorName.includes("IsDate"):
                    return { typeName: "date" };
                case decoratorName.includes("IsDateTime"):
                    return { typeName: "datetime" };
                default:
                    return { typeName: "datetime" };
            }
        }
        return { typeName: "datetime" };
    }
    if (type.isNumber()) {
        if (!node) {
            return { typeName: "double" };
        }
        const tagsOrDecorators = [];
        if (ts_morph_1.Node.isJSDocable(node)) {
            const jsDocs = node
                .getJsDocs()
                .map((jsDoc) => jsDoc.getTags().map((tag) => tag.getTagName()))
                .flat()
                .filter((tags) => tags.length);
            tagsOrDecorators.push(...jsDocs);
        }
        if (ts_morph_1.Node.isDecoratable(node)) {
            const decorators = node.getDecorators();
            const decoratorName = decorators.map((decorator) => decorator.getName());
            tagsOrDecorators.push(...decoratorName);
        }
        switch (true) {
            case tagsOrDecorators.includes("IsInt"):
                return { typeName: "integer" };
            case tagsOrDecorators.includes("IsLong"):
                return { typeName: "long" };
            case tagsOrDecorators.includes("IsFloat"):
                return { typeName: "float" };
            case tagsOrDecorators.includes("IsDouble"):
                return { typeName: "double" };
        }
    }
    return undefined;
}
//# sourceMappingURL=resolveType.js.map