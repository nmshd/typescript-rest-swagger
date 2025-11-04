import { EnumDeclaration, Expression, Type as MorphType, Node, Project, ts } from "ts-morph";
import { getJSDocDescriptionFromProperty } from "../utils/jsDocUtils";
import { getNodeAsTsMorphNode } from "../utils/utils";
import {
    ArrayType,
    ConstType,
    EnumerateType,
    isObjectType,
    MetadataGenerator,
    ObjectType,
    Property,
    ReferenceType,
    Type,
    UnionType
} from "./metadataGenerator";

const inProgressTypes: { [typeName: string]: boolean } = {};
const syntaxKindMap: { [kind: number]: string } = {};
syntaxKindMap[ts.SyntaxKind.NumberKeyword] = "number";
syntaxKindMap[ts.SyntaxKind.StringKeyword] = "string";
syntaxKindMap[ts.SyntaxKind.BooleanKeyword] = "boolean";
syntaxKindMap[ts.SyntaxKind.VoidKeyword] = "void";
syntaxKindMap[ts.SyntaxKind.UndefinedKeyword] = "undefined";

export function resolveType(type?: MorphType, node?: Node): Type {
    if (!type) {
        return { typeName: "void" };
    }
    let resultType: Type = { typeName: "void" };
    const typeObject = getTypeObject(type);

    const debug = Object.getOwnPropertyNames(MorphType.prototype).reduce((prev, curr: keyof MorphType) => {
        if (type[curr] && typeof type[curr] === "function" && curr.includes("get")) {
            try {
                // @ts-expect-error
                prev[curr] = type[curr]();
            } catch {
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
        case typeObject.isTuple:
            throw new Error("Tuple types are not supported.");
        case typeObject.isIntersection:
            const intersectionTypes = type.getIntersectionTypes().map((subType) => {
                return resolveType(subType);
            });
            const noneObjectTypes = intersectionTypes.filter((t) => {
                return !isObjectType(t) && t.typeName !== "object";
            });
            if (noneObjectTypes.length > 0) {
                throw new Error(
                    `Intersection types other than object types are not supported. Found: ${intersectionTypes
                        .map((t) => t.typeName || "object")
                        .join(", ")}`
                );
            }
            const mergedProperties: Property[] = [];
            intersectionTypes.forEach((type) => {
                if (isObjectType(type)) {
                    mergedProperties.push(...(type as ObjectType).properties);
                }
            });
            const intersectionType: ObjectType = {
                typeName: "",
                properties: mergedProperties
            };
            return intersectionType;

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
            resultType = { typeName: "void" };
            break;
        case typeObject.isBoolean:
            resultType = { typeName: "boolean" };
            break;
        case typeObject.isString:
            resultType = { typeName: "string" };
            break;
        case typeObject.isNumber:
            resultType = { typeName: "double" };
            break;
        case typeObject.isBigInt:
            resultType = { typeName: "long" };
            break;

        case typeObject.isArray:
        case typeObject.isReadonlyArray:
            const arrayElementType = type.getArrayElementTypeOrThrow();
            const arrayType: ArrayType = {
                typeName: "array",
                elementType: resolveType(arrayElementType)
            };
            return arrayType;

        // Wanted fall through to handle object types
        case typeObject.isObject && type.getProperties().length === 0:
            return { typeName: "object" };
        case typeObject.isInterface:
        case typeObject.isClass:
        case typeObject.isClassOrInterface:
        case typeObject.isObject:
            const declarationNode = type.getSymbol()?.getDeclarations()[0];

            if (!declarationNode) {
                throw new Error(`Node is required to resolve type for ${type.getText()}`);
            }
            const originalFilePath = declarationNode.getSourceFile().getFilePath();

            let typeName = type.getText(declarationNode, ts.TypeFormatFlags.UseAliasDefinedOutsideCurrentScope);

            // sometimes the type text is the pure definition {prop:string} those need to be filtered out
            if (typeName.trim().startsWith("{")) {
                typeName = "";
            }
            let typeNodeName = "";

            if (Node.isTyped(node)) {
                typeNodeName = node.getTypeNode()?.getText() ?? "";
                if (typeNodeName.trim().startsWith("{")) {
                    typeNodeName = "";
                }
            }

            typeName = typeName || typeNodeName;

            typeName = replaceNameText(typeName);

            if (typeName && inProgressTypes[typeName]) {
                return createCircularDependencyResolver(typeName);
            }

            if (typeName) {
                inProgressTypes[typeName] = true;
            }

            const cachedType = MetadataGenerator.current.getReferenceType(typeName);
            if (typeName && cachedType) {
                if (originalFilePath !== cachedType.originalFileName) {
                    throw new Error(
                        `Type name conflict: ${typeName} is defined in both ${originalFilePath} and ${cachedType.originalFileName}`
                    );
                }
                delete inProgressTypes[typeName];
                return cachedType;
            }
            const tc = MetadataGenerator.current.morph.getTypeChecker();

            const properties = type
                .getProperties()
                .map<Property | undefined>((prop) => {
                    const tcType = tc.getTypeOfSymbolAtLocation(prop, declarationNode);
                    const propNode = prop.getDeclarations()[0];

                    const isFunction = isFunctionLikeNode(propNode);
                    if (isFunction) {
                        return undefined;
                    }
                    const propertyType = resolveType(tcType, propNode);

                    let description = getJSDocDescriptionFromProperty(propNode, declarationNode);

                    return {
                        name: prop.getName(),
                        required: !prop.isOptional(),
                        type: propertyType,
                        description
                    };
                })
                .filter((prop): prop is Property => prop !== undefined);

            if (!typeName) {
                const objectType: ObjectType = {
                    typeName: "",
                    properties
                };

                return objectType;
            }

            const referenceType: ReferenceType = {
                properties,
                originalFileName: originalFilePath,
                typeName,
                simpleTypeName: type.getSymbol()?.getName() ?? "",
                description: ""
            };
            MetadataGenerator.current.addReferenceType(referenceType);
            delete inProgressTypes[typeName];
            return referenceType;

        case typeObject.isEnum:
            const declaration = type.getSymbolOrThrow().getValueDeclarationOrThrow();
            if (!(declaration instanceof EnumDeclaration)) {
                throw new Error(
                    `Expected EnumDeclaration, but got ${declaration.getKindName()} for ${type
                        .getSymbolOrThrow()
                        .getName()}`
                );
            }
            const enumMembers = declaration.getMembers().map((member, index) => {
                return member.getValue();
            });
            const uniqueTypes = enumMembers
                .map((a) => typeof a)
                .reduce((curr, next) => {
                    if (!curr.includes(next)) {
                        curr.push(next.toString());
                    }
                    return curr;
                }, new Array<string>());
            if (uniqueTypes.length > 1) {
                return { typeName: "void" };
            }

            const enumType: EnumerateType = {
                typeName: "enum",
                enumMembers: enumMembers.filter((m) => m !== undefined)
            };
            return enumType;

        case typeObject.isUnion:
            const types = type.getUnionTypes().map(getTypeObject);

            const allTheSameLiteralType = types
                .filter((t) => !t.isUndefined)
                .every((t, i, a) => {
                    return t.isLiteral && JSON.stringify(a[0]) === JSON.stringify(t);
                });

            if (allTheSameLiteralType) {
                const enumType: EnumerateType = {
                    typeName: "enum",
                    enumMembers: type.getUnionTypes().map((t) => t.getLiteralValue())
                };
                return enumType;
            }

            const unionTypes = type.getUnionTypes().map((subType) => {
                return resolveType(subType);
            });

            // Remove duplicate types from union
            const uniqueUnionTypes = unionTypes.filter((unionType, index) => {
                const serializedUnionType = JSON.stringify(unionType);
                return (
                    unionTypes.findIndex((t) => {
                        return JSON.stringify(t) === serializedUnionType;
                    }) === index
                );
            });

            const unionType: UnionType = {
                types: uniqueUnionTypes,
                typeName: ""
            };

            return unionType;
        case typeObject.isBooleanLiteral:
            if (type.getText() !== "true" && type.getText() !== "false") {
                throw new Error(`Unexpected boolean literal value: ${type.getText()}`);
            }
            const literalBooleanType: ConstType = {
                typeName: "const",
                value: type.getText() === "true" ? true : false
            };
            return literalBooleanType;
        case typeObject.isTemplateLiteral:
        case typeObject.isStringLiteral:
        case typeObject.isEnumLiteral:
        case typeObject.isNumberLiteral:
        case typeObject.isBigIntLiteral:
            const typeLiteralValue = type.getLiteralValue();
            if (typeLiteralValue) {
                const literalType: ConstType = {
                    typeName: "const",
                    value: typeLiteralValue
                };
                return literalType;
            }
            if (!node) {
                throw new Error(`Node is required to resolve literal type for ${type.getText()}`);
            }
            if (!Node.isExpression(node) && !Node.isPropertySignature(node) && !Node.isPropertyDeclaration(node)) {
                throw new Error(
                    `Node of type ${node.getKindName()} is not supported to resolve literal type for ${type.getText()}`
                );
            }
            const literalValue = getLiteralValue(node.compilerNode, MetadataGenerator.current.morph);
            const literalType: ConstType = {
                typeName: "const",
                value: literalValue
            };
            return literalType;
        case typeObject.isLiteral:
            debugger;
            break;
        default:
            const apparentType = type.getApparentType();
            if (apparentType) {
                return resolveType(apparentType);
            }
            debugger;
    }
    return resultType;
}

/**
 * Used to identify union types of a primitive and array of the same primitive, e.g. `string | string[]`
 */
export function getCommonPrimitiveAndArrayUnionType(type: MorphType): Type | null {
    if (type && type.isUnion()) {
        const union = type;
        const types = union
            .getUnionTypes()
            .map((t) => {
                return resolveType(t);
            })
            .filter((t) => t.typeName !== "undefined");
        const arrType = types.find((t) => t.typeName === "array") as ArrayType | undefined;
        const primitiveType = types.find((t) => t.typeName !== "array");

        if (
            types.length === 2 &&
            arrType &&
            arrType.elementType &&
            primitiveType &&
            arrType.elementType.typeName === primitiveType.typeName
        ) {
            return arrType;
        }
    }

    return null;
}

export function getLiteralValue(
    expression: ts.Expression | ts.PropertySignature | ts.PropertyDeclaration,
    morph: Project
) {
    const morphNode = getNodeAsTsMorphNode(expression, morph);
    const type = morphNode.getType();
    const literalValue = type.getLiteralValue();
    if (literalValue !== undefined) {
        return literalValue;
    }

    if (Expression.isArrayLiteralExpression(morphNode)) {
        const elements = morphNode.getElements().map((e) => getLiteralValue(e.compilerNode, morph));
        return elements;
    }
    if (Expression.isElementAccessExpression(morphNode)) {
        const identifier = morphNode.getExpression();
        const argumentExpression = morphNode.getArgumentExpression();
        if (
            argumentExpression &&
            (Expression.isStringLiteral(argumentExpression) || Expression.isNumericLiteral(argumentExpression))
        ) {
            const identifierValue = getLiteralValue(identifier.compilerNode, morph);
            const argumentValue = getLiteralValue(argumentExpression.compilerNode, morph);
            if (
                Array.isArray(identifierValue) &&
                (typeof argumentValue === "number" || typeof argumentValue === "string")
            ) {
                return identifierValue[argumentValue as number];
            }
        }
    }

    if (literalValue === undefined) {
        const declaration = morphNode.getSymbol()?.getValueDeclaration();
        const initializer = Node.isInitializerExpressionGetable(declaration) && declaration.getInitializer();
        if (initializer) {
            return getLiteralValue(initializer.compilerNode, morph);
        }
    }

    if (Node.isTrueLiteral(morphNode)) {
        return true;
    }
    if (Node.isFalseLiteral(morphNode)) {
        return false;
    }

    throw new Error(`Could not resolve literal value for expression: ${expression.getText()}`);
}

function getTypeObject(type: MorphType) {
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
        isUnionOrIntersection: type.isUnionOrIntersection()
    };
    const typeKey = Object.fromEntries(Object.entries(typeObject).filter(([_, value]) => value));
    return typeKey;
}

function replaceNameText(text = "") {
    return text
        .replace(/\./g, "_._")
        .replace(/\</g, "-")
        .replace(/\>/g, "-")
        .replace(/\,/g, ".")
        .replace(/\|/g, "_or_")
        .replace(/\[\]/g, "Array")
        .replace(/[^A-Z|a-z|0-9|_|\-|.]/g, "");
}

function getTypeArgumentMap(type: MorphType): Record<string, MorphType> {
    return Object.fromEntries(
        type
            .getTargetType()
            ?.getTypeArguments()
            .map((typeArgument, index) => {
                return [typeArgument.getText(), type.getTypeArguments()[index]] as const;
            }) ?? []
    );
}

function handleSpecialTypes(type: MorphType, node?: Node): Type | undefined {
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
        if (Node.isDecoratable(node)) {
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
        const tagsOrDecorators = [] as string[];

        if (Node.isJSDocable(node)) {
            const jsDocs = node
                .getJsDocs()
                .map((jsDoc) => jsDoc.getTags().map((tag) => tag.getTagName()))
                .flat()
                .filter((tags) => tags.length);
            tagsOrDecorators.push(...jsDocs);
        }

        if (Node.isDecoratable(node)) {
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

function createCircularDependencyResolver(typeName: string) {
    const referenceType: ReferenceType = {
        description: "",
        properties: new Array<Property>(),
        typeName: typeName,
        originalFileName: undefined
    };

    MetadataGenerator.current.onFinish((referenceTypes) => {
        const realReferenceType = referenceTypes[typeName];
        if (!realReferenceType) {
            return;
        }
        referenceType.description = realReferenceType.description;
        referenceType.properties = realReferenceType.properties;
        referenceType.typeName = realReferenceType.typeName;
        referenceType.originalFileName = realReferenceType.originalFileName;
        referenceType.simpleTypeName = realReferenceType.simpleTypeName;
    });

    return referenceType;
}
function isFunctionLikeNode(propNode?: Node): boolean {
    if (Node.isMethodDeclaration(propNode) || Node.isMethodSignature(propNode)) {
        return true;
    }

    if (Node.isPropertyDeclaration(propNode) || Node.isPropertySignature(propNode)) {
        return (
            Node.isFunctionTypeNode(propNode.getTypeNode()) ||
            Node.isArrowFunction(propNode.getInitializer()) ||
            Node.isFunctionExpression(propNode.getInitializer()) ||
            (Node.isTypeReference(propNode.getTypeNode()) && propNode.getTypeNode()?.getText() === "Function")
        );
    }

    return false;
}
