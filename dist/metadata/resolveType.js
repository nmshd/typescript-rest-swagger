"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveType = resolveType;
exports.getSuperClass = getSuperClass;
exports.getCommonPrimitiveAndArrayUnionType = getCommonPrimitiveAndArrayUnionType;
exports.getLiteralValue = getLiteralValue;
exports.resolveImports = resolveImports;
const _ = require("lodash");
const path_1 = require("path");
const ts = require("typescript");
const decoratorUtils_1 = require("../utils/decoratorUtils");
const jsDocUtils_1 = require("../utils/jsDocUtils");
const metadataGenerator_1 = require("./metadataGenerator");
let timer = 0;
const syntaxKindMap = {};
syntaxKindMap[ts.SyntaxKind.NumberKeyword] = "number";
syntaxKindMap[ts.SyntaxKind.StringKeyword] = "string";
syntaxKindMap[ts.SyntaxKind.BooleanKeyword] = "boolean";
syntaxKindMap[ts.SyntaxKind.VoidKeyword] = "void";
syntaxKindMap[ts.SyntaxKind.UndefinedKeyword] = "undefined";
function resolveType(typeNode, genericTypeMap) {
    if (!typeNode) {
        return { typeName: "void" };
    }
    if (typeNode.kind === ts.SyntaxKind.FunctionType) {
        return { typeName: "void" };
    }
    const primitiveType = getPrimitiveType(typeNode);
    if (primitiveType) {
        return primitiveType;
    }
    if (typeNode.kind === ts.SyntaxKind.ArrayType) {
        const arrayType = typeNode;
        return {
            elementType: resolveType(arrayType.elementType, genericTypeMap),
            typeName: "array",
        };
    }
    if (typeNode.kind === ts.SyntaxKind.AnyKeyword ||
        typeNode.kind === ts.SyntaxKind.ObjectKeyword ||
        typeNode.kind === ts.SyntaxKind.UnknownKeyword) {
        return { typeName: "object" };
    }
    if (typeNode.kind === ts.SyntaxKind.TypeLiteral) {
        return getInlineObjectType(typeNode);
    }
    if (typeNode.kind === ts.SyntaxKind.LiteralType) {
        return resolveLiteralType(typeNode.literal);
    }
    if (typeNode.kind === ts.SyntaxKind.UnionType) {
        return getUnionType(typeNode);
    }
    if (typeNode.kind === ts.SyntaxKind.ParenthesizedType) {
        return getUnionType(typeNode.type);
    }
    if (typeNode.kind !== ts.SyntaxKind.TypeReference &&
        typeNode.kind !== ts.SyntaxKind.ExpressionWithTypeArguments &&
        typeNode.kind !== ts.SyntaxKind.ExpressionStatement) {
        throw new Error(`Unknown type: ${ts.SyntaxKind[typeNode.kind]} with name ${typeNode.getText()}`);
    }
    const typeReference = typeNode;
    const typeNameNode = "expression" in typeReference
        ? typeReference.expression
        : typeReference.typeName;
    const typeName = resolveSimpleTypeName(typeNameNode);
    const namedType = resolveSpecialTypesByName(typeName, typeNode, genericTypeMap);
    if (namedType) {
        return namedType;
    }
    const enumType = getEnumerateType(typeNameNode);
    if (enumType) {
        return enumType;
    }
    let referenceType;
    const sourceFile = getSourceFile(typeNode);
    const tmpFileName = _.uniqueId("__tmp_") + ".ts";
    const fullTypeName = typeNode.getText();
    const fullRefTypeName = replaceNameText(fullTypeName);
    const refType = metadataGenerator_1.MetadataGenerator.current.getReferenceType(fullRefTypeName);
    const symbol = metadataGenerator_1.MetadataGenerator.current.typeChecker.getSymbolAtLocation(typeNameNode);
    let originalDeclarationFileName = sourceFile.fileName;
    if (symbol) {
        originalDeclarationFileName =
            getOriginalSourceFile(symbol) ?? sourceFile.fileName;
    }
    // if (refType && refType?.originalFileName !== originalDeclarationFileName) {
    //   throw new Error(`reference type ${fullRefTypeName} with same name but different properties. Please use different names for different types.`)
    // } else if (refType) {
    //   return refType;
    // }
    const newTmpSourceFile = `
  
  ${sourceFile.getFullText()}
  
  type __Simplify<T> = { [KeyType in keyof T]: T[KeyType] } & {};
  
  type __Result = __Simplify<${fullTypeName}>;

  type __Original = ${fullTypeName};
  
  `;
    const tmpSourceFile = metadataGenerator_1.MetadataGenerator.current.morph.createSourceFile((0, path_1.dirname)(sourceFile.fileName) + "/" + tmpFileName, newTmpSourceFile);
    const statement = tmpSourceFile.getStatements().at(-2);
    const originalStatement = tmpSourceFile.getStatements().at(-1);
    const type = statement.getType();
    if (type.isUnion()) {
        let unionType = {
            types: (originalStatement.getType().compilerType.aliasSymbol
                ?.declarations?.[0]).type.types
                .map((t) => {
                return resolveType(t);
            })
                .filter((p) => p !== undefined),
            typeName: typeName,
        };
        return unionType;
    }
    if (!type.isObject()) {
        const declaration = symbol?.declarations?.[0];
        if (!declaration) {
            throw new Error("Could not resolve declaration of Object");
        }
        if ("type" in declaration) {
            return resolveType(declaration.type);
        }
        let originalType = originalStatement.getType();
        switch (true) {
            case originalType.isString():
                return { typeName: "string" };
            case originalType.isNumber():
                return { typeName: "double" };
            case originalType.isBoolean():
                return { typeName: "boolean" };
            case originalType.isNull():
            case originalType.isUndefined():
                return { typeName: "void" };
        }
    }
    const specialTypeNameAfterReference = type.compilerType.symbol?.escapedName.toString();
    const checker = metadataGenerator_1.MetadataGenerator.current.typeChecker;
    const typeNodeType = checker.getTypeAtLocation(typeNode);
    if ("node" in typeNodeType) {
        const specialTypeAfterReference = resolveSpecialTypesByName(specialTypeNameAfterReference, typeNodeType.node, genericTypeMap);
        if (specialTypeAfterReference) {
            return specialTypeAfterReference;
        }
    }
    const typeArguments = typeReference.typeArguments;
    const originalType = metadataGenerator_1.MetadataGenerator.current.typeChecker.getTypeAtLocation(typeReference);
    const typeArgumentsMap = {};
    if (typeArguments?.length ?? 0 > 0) {
        const typeParameter = (originalType.symbol.declarations?.[0]).typeParameters;
        const typeParameterNames = typeParameter?.map((typeParam) => typeParam.name.getText());
        typeParameterNames?.forEach((param, index) => {
            typeArgumentsMap[param] =
                typeArguments?.[index] ?? typeParameter?.[index].default;
        });
    }
    const typeProperties = type.getProperties();
    const properties = typeProperties
        .map((property) => {
        const declaration = property.getDeclarations()[0]
            .compilerNode;
        if (declaration.kind) {
            const name = property.getName();
            let type;
            if (ts.isTypeReferenceNode(declaration.type)) {
                type = resolveType(typeArgumentsMap[declaration.type.typeName.getText()] ??
                    declaration.type);
            }
            else {
                type = resolveType(declaration.type);
            }
            const questionMark = !!declaration.questionToken;
            const undefinedUnion = declaration.type.kind === ts.SyntaxKind.UnionType &&
                declaration.type.types.some((t) => t.kind === ts.SyntaxKind.UndefinedKeyword);
            const required = !questionMark && !undefinedUnion;
            // MetadataGenerator.current.morph.removeSourceFile(tmpSourceFile);
            return {
                description: "",
                name: name,
                required: required,
                type,
            };
        }
        return undefined;
    })
        .filter((p) => p && p.type.typeName !== "void");
    referenceType = {
        description: "",
        properties,
        typeName: replaceNameText(fullTypeName),
        simpleTypeName: typeName,
        originalFileName: originalDeclarationFileName,
    };
    metadataGenerator_1.MetadataGenerator.current.morph.removeSourceFile(tmpSourceFile);
    metadataGenerator_1.MetadataGenerator.current.addReferenceType(referenceType);
    return referenceType;
}
function resolveSpecialTypesByName(typeName, typeNode, genericTypeMap) {
    const typeReference = typeNode;
    if (typeName === "Date") {
        return getDateType(typeNode);
    }
    if (typeName === "Buffer") {
        return { typeName: "buffer" };
    }
    if (typeName === "DownloadBinaryData") {
        return { typeName: "buffer" };
    }
    if (typeName === "DownloadResource") {
        return { typeName: "buffer" };
    }
    if (typeName === "Promise") {
        return resolveType(typeReference.typeArguments?.[0], genericTypeMap);
    }
    if (typeName === "Array") {
        return {
            elementType: resolveType(typeReference.typeArguments?.[0], genericTypeMap),
            typeName: "array",
        };
    }
    if (typeName === "Record") {
        return { typeName: "object" };
    }
    return undefined;
}
function getPrimitiveType(typeNode) {
    const primitiveType = syntaxKindMap[typeNode.kind];
    if (!primitiveType) {
        return undefined;
    }
    if (primitiveType === "number") {
        const parentNode = typeNode.parent;
        if (!parentNode) {
            return { typeName: "double" };
        }
        const validDecorators = ["IsInt", "IsLong", "IsFloat", "IsDouble"];
        // Can't use decorators on interface/type properties, so support getting the type from jsdoc too.
        const jsdocTagName = (0, jsDocUtils_1.getFirstMatchingJSDocTagName)(parentNode, (tag) => {
            return validDecorators.some((t) => t === tag.tagName.text);
        });
        const decoratorName = (0, decoratorUtils_1.getDecoratorName)(parentNode, (identifier) => {
            return validDecorators.some((m) => m === identifier.text);
        });
        switch (decoratorName || jsdocTagName) {
            case "IsInt":
                return { typeName: "integer" };
            case "IsLong":
                return { typeName: "long" };
            case "IsFloat":
                return { typeName: "float" };
            case "IsDouble":
                return { typeName: "double" };
            default:
                return { typeName: "double" };
        }
    }
    return { typeName: primitiveType };
}
function getDateType(typeNode) {
    const parentNode = typeNode.parent;
    if (!parentNode) {
        return { typeName: "datetime" };
    }
    const decoratorName = (0, decoratorUtils_1.getDecoratorName)(parentNode, (identifier) => {
        return ["IsDate", "IsDateTime"].some((m) => m === identifier.text);
    });
    switch (decoratorName) {
        case "IsDate":
            return { typeName: "date" };
        case "IsDateTime":
            return { typeName: "datetime" };
        default:
            return { typeName: "datetime" };
    }
}
function getEnumerateType(typeNameNode) {
    let enumDeclaration = metadataGenerator_1.MetadataGenerator.current.typeChecker.getSymbolAtLocation(typeNameNode)
        ?.declarations?.[0];
    enumDeclaration = resolveImports(enumDeclaration);
    if (enumDeclaration?.kind !== ts.SyntaxKind.EnumDeclaration) {
        return undefined;
    }
    function getEnumValue(member) {
        const initializer = member.initializer;
        if (initializer) {
            if (initializer.expression) {
                return parseEnumValueByKind(initializer.expression.text, initializer.kind);
            }
            return parseEnumValueByKind(initializer.text, initializer.kind);
        }
        return;
    }
    return {
        enumMembers: enumDeclaration.members.map((member, index) => {
            return getEnumValue(member) || index;
        }),
        typeName: "enum",
    };
}
function parseEnumValueByKind(value, kind) {
    return kind === ts.SyntaxKind.NumericLiteral ? parseFloat(value) : value;
}
function getUnionType(typeNode) {
    const union = typeNode;
    let baseType;
    let isObject = false;
    const types = union.types.filter((t) => t.kind !== ts.SyntaxKind.UndefinedKeyword);
    if (types.length === 1) {
        return resolveType(types[0]);
    }
    union.types.map((type) => {
        if (!baseType) {
            baseType = type;
        }
        const prim = getPrimitiveType(type);
        if (baseType.kind !== type.kind || !prim) {
            isObject = true;
        }
    });
    if (isObject) {
        const mapedTypes = union.types.map((type) => {
            return resolveType(type);
        });
        return { typeName: "", types: mapedTypes };
    }
    return {
        enumMembers: union.types.map((type, index) => {
            return type.getText() ? removeQuotes(type.getText()) : index;
        }),
        typeName: "enum",
    };
}
function removeQuotes(str) {
    return str.replace(/^["']|["']$/g, "");
}
function getInlineObjectType(typeNode) {
    const type = {
        properties: getModelTypeProperties(typeNode),
        typeName: "",
    };
    return type;
}
function resolveLiteralType(literalTypeNode) {
    return {
        enumMembers: [literalTypeNode.text],
        typeName: "enum",
    };
}
function resolveSimpleTypeName(type) {
    if (type.kind === ts.SyntaxKind.Identifier) {
        return type.text;
    }
    const qualifiedType = type;
    return qualifiedType.right.text;
}
function getTypeName(typeName) {
    return replaceNameText(typeName.parent.getText());
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
function getModelTypeProperties(node, genericTypes) {
    if (node.kind === ts.SyntaxKind.TypeLiteral ||
        node.kind === ts.SyntaxKind.InterfaceDeclaration) {
        const interfaceDeclaration = node;
        return interfaceDeclaration.members
            .filter((member) => {
            if (member.type &&
                member.type.kind === ts.SyntaxKind.FunctionType) {
                return false;
            }
            return member.kind === ts.SyntaxKind.PropertySignature;
        })
            .map((member) => {
            const propertyDeclaration = member;
            const identifier = propertyDeclaration.name;
            if (!propertyDeclaration.type) {
                throw new Error("No valid type found for property declaration.");
            }
            // Declare a variable that can be overridden if needed
            let aType = propertyDeclaration.type;
            // aType.kind will always be a TypeReference when the property of Interface<T> is of type T
            if (aType.kind === ts.SyntaxKind.TypeReference &&
                genericTypes &&
                genericTypes.length &&
                node.typeParameters) {
                // The type definitions are conviently located on the object which allow us to map -> to the genericTypes
                const typeParams = _.map(node.typeParameters, (typeParam) => {
                    return typeParam.name.text;
                });
                // I am not sure in what cases
                const typeIdentifier = aType.typeName;
                let typeIdentifierName;
                // typeIdentifier can either be a Identifier or a QualifiedName
                if (typeIdentifier.text) {
                    typeIdentifierName = typeIdentifier.text;
                }
                else {
                    typeIdentifierName = typeIdentifier.right
                        .text;
                }
                // I could not produce a situation where this did not find it so its possible this check is irrelevant
                const indexOfType = _.indexOf(typeParams, typeIdentifierName);
                if (indexOfType >= 0) {
                    aType = genericTypes[indexOfType];
                }
            }
            return {
                description: getNodeDescription(propertyDeclaration),
                name: identifier.text,
                required: !propertyDeclaration.questionToken,
                type: resolveType(aType),
            };
        });
    }
    let classDeclaration = node;
    let properties = classDeclaration.members.filter((member) => {
        if (member.kind !== ts.SyntaxKind.PropertyDeclaration) {
            return false;
        }
        const propertySignature = member;
        return propertySignature && hasPublicMemberModifier(propertySignature);
    });
    const classConstructor = classDeclaration.members.find((member) => member.kind === ts.SyntaxKind.Constructor);
    if (classConstructor && classConstructor.parameters) {
        properties = properties.concat(classConstructor.parameters.filter((parameter) => hasPublicConstructorModifier(parameter)));
    }
    return properties.map((declaration) => {
        const identifier = declaration.name;
        if (!declaration.type) {
            throw new Error("No valid type found for property declaration.");
        }
        return {
            description: getNodeDescription(declaration),
            name: identifier.text,
            required: !declaration.questionToken,
            type: resolveType(resolveTypeParameter(declaration.type, classDeclaration, genericTypes)),
        };
    });
}
function resolveTypeParameter(type, classDeclaration, genericTypes) {
    if (genericTypes &&
        classDeclaration.typeParameters &&
        classDeclaration.typeParameters.length) {
        for (let i = 0; i < classDeclaration.typeParameters.length; i++) {
            if (type.typeName &&
                classDeclaration.typeParameters[i].name.text === type.typeName.text) {
                return genericTypes[i];
            }
        }
    }
    return type;
}
// function getModelTypeAdditionalProperties(node: UsableDeclaration) {
//   if (node.kind === ts.SyntaxKind.InterfaceDeclaration) {
//     const interfaceDeclaration = node as ts.InterfaceDeclaration;
//     return interfaceDeclaration.members
//       .filter((member) => member.kind === ts.SyntaxKind.IndexSignature)
//       .map((member: any) => {
//         const indexSignatureDeclaration =
//           member as ts.IndexSignatureDeclaration;
//         const indexType = resolveType(
//           indexSignatureDeclaration.parameters[0].type as ts.TypeNode
//         );
//         if (
//           indexType.typeName !== "string" &&
//           indexType.typeName !== "double"
//         ) {
//           throw new Error(
//             `Only string/number indexers are supported. Found ${indexType.typeName}.`
//           );
//         }
//         return {
//           description: "",
//           name: "",
//           required: true,
//           type: resolveType(indexSignatureDeclaration.type as ts.TypeNode),
//         };
//       });
//   }
//   return undefined;
// }
function getModifiers(node) {
    if (ts.canHaveModifiers(node)) {
        return ts.getModifiers(node) ?? [];
    }
    return [];
}
function hasPublicMemberModifier(node) {
    return (getModifiers(node).length > 0 &&
        getModifiers(node).every((modifier) => {
            return (modifier.kind !== ts.SyntaxKind.ProtectedKeyword &&
                modifier.kind !== ts.SyntaxKind.PrivateKeyword);
        }));
}
function hasPublicConstructorModifier(node) {
    return (getModifiers(node).length > 0 &&
        getModifiers(node).some((modifier) => {
            return modifier.kind === ts.SyntaxKind.PublicKeyword;
        }));
}
function getNodeDescription(node) {
    let symbol = metadataGenerator_1.MetadataGenerator.current.typeChecker.getSymbolAtLocation(node.name);
    symbol = resolveImports(symbol);
    if (symbol) {
        /**
         * TODO: Workaround for what seems like a bug in the compiler
         * Warrants more investigation and possibly a PR against typescript
         */
        if (node.kind === ts.SyntaxKind.Parameter) {
            // TypeScript won't parse jsdoc if the flag is 4, i.e. 'Property'
            symbol.flags = 0;
        }
        const comments = symbol.getDocumentationComment(metadataGenerator_1.MetadataGenerator.current.typeChecker);
        if (comments.length) {
            return ts.displayPartsToString(comments);
        }
    }
    return "";
}
function getSuperClass(node, typeArguments) {
    const clauses = node.heritageClauses;
    if (clauses) {
        const filteredClauses = clauses.filter((clause) => clause.token === ts.SyntaxKind.ExtendsKeyword);
        if (filteredClauses.length > 0) {
            const clause = filteredClauses[0];
            if (clause.types && clause.types.length > 0) {
                let type = metadataGenerator_1.MetadataGenerator.current.typeChecker.getSymbolAtLocation(clause.types[0].expression)?.declarations?.[0];
                type = resolveImports(type);
                if (!type) {
                    throw new Error("Could not resolve type of extend");
                }
                return {
                    type: type,
                    typeArguments: resolveTypeArguments(type, clause.types[0].typeArguments, typeArguments),
                };
            }
        }
    }
    return undefined;
}
function buildGenericTypeMap(node, typeArguments) {
    const result = new Map();
    if (node.typeParameters && typeArguments) {
        node.typeParameters.forEach((typeParam, index) => {
            const paramName = typeParam.name.text;
            result.set(paramName, typeArguments[index]);
        });
    }
    return result;
}
function resolveTypeArguments(node, typeArguments, parentTypeArguments) {
    const result = buildGenericTypeMap(node, typeArguments);
    if (parentTypeArguments) {
        result.forEach((value, key) => {
            const typeName = getTypeName(value);
            if (parentTypeArguments.has(typeName)) {
                result.set(key, parentTypeArguments.get(typeName));
            }
        });
    }
    return result;
}
/**
 * Used to identify union types of a primitive and array of the same primitive, e.g. `string | string[]`
 */
function getCommonPrimitiveAndArrayUnionType(typeNode) {
    if (typeNode && typeNode.kind === ts.SyntaxKind.UnionType) {
        const union = typeNode;
        const types = union.types
            .map((t) => resolveType(t))
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
function resolveImports(node) {
    const nodeAsImportSpecifier = node;
    const checker = metadataGenerator_1.MetadataGenerator.current.typeChecker;
    if (nodeAsImportSpecifier?.kind === ts.SyntaxKind.ImportSpecifier) {
        const symbol = checker.getSymbolAtLocation(nodeAsImportSpecifier.name);
        if (symbol) {
            const aliasedSymbol = checker.getAliasedSymbol(symbol);
            const declaration = aliasedSymbol.getDeclarations()?.[0];
            return declaration;
        }
    }
    return node;
}
function getSourceFile(node) {
    while (node.kind !== ts.SyntaxKind.SourceFile) {
        node = node.parent;
    }
    return node;
}
function getOriginalSourceFile(symbol) {
    if (symbol &&
        symbol?.declarations?.[0].kind === ts.SyntaxKind.ImportSpecifier) {
        return metadataGenerator_1.MetadataGenerator.current.typeChecker
            .getAliasedSymbol(symbol)
            .getDeclarations()?.[0]
            .getSourceFile().fileName;
    }
    return symbol?.declarations?.[0].getSourceFile().fileName;
}
//# sourceMappingURL=resolveType.js.map