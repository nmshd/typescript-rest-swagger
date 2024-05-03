import * as _ from "lodash";
import { dirname } from "path";
import * as ts from "typescript";
import { getDecoratorName } from "../utils/decoratorUtils";
import { getFirstMatchingJSDocTagName } from "../utils/jsDocUtils";
import {
  ArrayType,
  EnumerateType,
  MetadataGenerator,
  ObjectType,
  Property,
  ReferenceType,
  Type,
  UnionType,
} from "./metadataGenerator";

const syntaxKindMap: { [kind: number]: string } = {};
syntaxKindMap[ts.SyntaxKind.NumberKeyword] = "number";
syntaxKindMap[ts.SyntaxKind.StringKeyword] = "string";
syntaxKindMap[ts.SyntaxKind.BooleanKeyword] = "boolean";
syntaxKindMap[ts.SyntaxKind.VoidKeyword] = "void";
syntaxKindMap[ts.SyntaxKind.UndefinedKeyword] = "undefined";

type UsableDeclaration =
  | ts.InterfaceDeclaration
  | ts.ClassDeclaration
  | ts.TypeAliasDeclaration;
export function resolveType(
  typeNode?: ts.TypeNode,
  genericTypeMap?: Map<String, ts.TypeNode>
): Type {
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
    const arrayType = typeNode as ts.ArrayTypeNode;
    return {
      elementType: resolveType(arrayType.elementType, genericTypeMap),
      typeName: "array",
    } as ArrayType;
  }

  if (
    typeNode.kind === ts.SyntaxKind.AnyKeyword ||
    typeNode.kind === ts.SyntaxKind.ObjectKeyword ||
    typeNode.kind === ts.SyntaxKind.UnknownKeyword
  ) {
    return { typeName: "object" };
  }

  if (typeNode.kind === ts.SyntaxKind.TypeLiteral) {
    return getInlineObjectType(typeNode);
  }

  if (typeNode.kind === ts.SyntaxKind.LiteralType) {
    return resolveLiteralType(
      (typeNode as ts.LiteralTypeNode).literal,
      genericTypeMap
    );
  }

  if (typeNode.kind === ts.SyntaxKind.UnionType) {
    return getUnionType(typeNode);
  }

  if (typeNode.kind === ts.SyntaxKind.ParenthesizedType) {
    return getUnionType((typeNode as ts.ParenthesizedTypeNode).type);
  }

  if (
    typeNode.kind !== ts.SyntaxKind.TypeReference &&
    typeNode.kind !== ts.SyntaxKind.ExpressionWithTypeArguments &&
    typeNode.kind !== ts.SyntaxKind.ExpressionStatement
  ) {
    throw new Error(
      `Unknown type: ${
        ts.SyntaxKind[typeNode.kind]
      } with name ${typeNode.getText()}`
    );
  }

  const typeReference = typeNode as ts.TypeReferenceNode;
  const typeNameNode =
    "expression" in typeReference
      ? (typeReference.expression as ts.EntityName)
      : (typeReference.typeName as ts.EntityName);
  const typeName = resolveSimpleTypeName(typeNameNode as ts.EntityName);

  const namedType = resolveSpecialTypesByName(
    typeName,
    typeNode,
    genericTypeMap
  );
  if (namedType) {
    return namedType;
  }

  const enumType = getEnumerateType(typeNameNode);
  if (enumType) {
    return enumType;
  }

  let referenceType: ReferenceType;

  let parent: any = typeNode;

  while (!ts.isSourceFile(parent)) {
    parent = parent.parent;
  }
  let sourceFile = parent as ts.SourceFile;

  let tmpFileName = _.uniqueId("__tmp_") + ".ts";

  let fullTypeName = typeNode.getText();

  const newTmpSourceFile = `
  
  ${sourceFile.getFullText()}
  
  type __Simplify<T> = { [KeyType in keyof T]: T[KeyType] } & {};
  
  type __Result = __Simplify<${fullTypeName}>;

  type __Original = ${fullTypeName};
  
  `;
  const tmpSourceFile = MetadataGenerator.current.morph.createSourceFile(
    dirname(sourceFile.fileName) + "/" + tmpFileName,
    newTmpSourceFile
  );

  const statement = tmpSourceFile.getStatements().at(-2);
  const originalStatement = tmpSourceFile.getStatements().at(-1);
  const type = statement.getType();

  if (type.isUnion()) {
    let unionType = {
      types: (
        (
          originalStatement.getType().compilerType.aliasSymbol
            .declarations[0] as ts.TypeAliasDeclaration
        ).type as ts.UnionTypeNode
      ).types
        .map((t) => {
          return resolveType(t);
        })
        .filter((p) => p !== undefined),
      typeName: typeName,
    } as UnionType;
    return unionType;
  }

  if (!type.isObject()) {
    const declaration =
      MetadataGenerator.current.typeChecker.getSymbolAtLocation(typeNameNode)
        .declarations[0];
    if ("type" in declaration) {
      return resolveType(declaration.type as ts.TypeNode);
    }
  }

  const specialTypeNameAfterReference =
    type.compilerType.symbol?.escapedName.toString();
  const checker = MetadataGenerator.current.typeChecker;
  const typeNodeType = checker.getTypeAtLocation(typeNode);
  if ("node" in typeNodeType) {
    const specialTypeAfterReference = resolveSpecialTypesByName(
      specialTypeNameAfterReference,
      typeNodeType.node as ts.TypeNode,
      genericTypeMap
    );
    if (specialTypeAfterReference) {
      return specialTypeAfterReference;
    }
  }

  const typeArguments = typeReference.typeArguments;

  const originalType =
    MetadataGenerator.current.typeChecker.getTypeAtLocation(typeReference);
  const typeArgumentsMap: Record<string, any> = {};
  if (typeArguments?.length > 0) {
    const typeParameter = (
      originalType.symbol.declarations[0] as ts.SignatureDeclarationBase
    ).typeParameters;

    const typeParameterNames = typeParameter.map((typeParam) =>
      typeParam.name.getText()
    );

    typeParameterNames.forEach((param, index) => {
      typeArgumentsMap[param] =
        typeArguments[index] ?? typeParameter[index].default;
    });
  }
  const typeProperties = type.getProperties();
  const properties = typeProperties
    .map((property): Property | undefined => {
      const declaration = property.getDeclarations()[0]
        .compilerNode as ts.IndexSignatureDeclaration;
      if (declaration.kind) {
        const name = property.getName();

        let type;
        if (ts.isTypeReferenceNode(declaration.type)) {
          type = resolveType(
            typeArgumentsMap[declaration.type.typeName.getText()] ??
              declaration.type
          );
        } else {
          type = resolveType(declaration.type);
        }

        const questionMark = !!declaration.questionToken;
        const undefinedUnion =
          declaration.type.kind === ts.SyntaxKind.UnionType &&
          (declaration.type as ts.UnionTypeNode).types.some(
            (t: any) => t.kind === ts.SyntaxKind.UndefinedKeyword
          );
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
    .filter((p) => p !== undefined || p.type.typeName === "void");
  referenceType = {
    description: "",
    properties,
    typeName: replaceNameText(fullTypeName),
    simpleTypeName: typeName,
  };

  MetadataGenerator.current.morph.removeSourceFile(tmpSourceFile);

  MetadataGenerator.current.addReferenceType(referenceType);

  return referenceType;
}

function resolveSpecialTypesByName(
  typeName: string,
  typeNode?: ts.TypeNode,
  genericTypeMap?: Map<String, ts.TypeNode>
): Type | undefined {
  const typeReference = typeNode as ts.TypeReferenceNode;
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
    return resolveType(typeReference.typeArguments[0], genericTypeMap);
  }
  if (typeName === "Array") {
    return {
      elementType: resolveType(typeReference.typeArguments[0], genericTypeMap),
      typeName: "array",
    } as ArrayType;
  }

  if (typeName === "Record") {
    return { typeName: "object" };
  }
  return undefined;
}

function getPrimitiveType(typeNode: ts.TypeNode): Type | undefined {
  const primitiveType = syntaxKindMap[typeNode.kind];
  if (!primitiveType) {
    return undefined;
  }

  if (primitiveType === "number") {
    const parentNode = typeNode.parent as ts.Node;
    if (!parentNode) {
      return { typeName: "double" };
    }

    const validDecorators = ["IsInt", "IsLong", "IsFloat", "IsDouble"];

    // Can't use decorators on interface/type properties, so support getting the type from jsdoc too.
    const jsdocTagName = getFirstMatchingJSDocTagName(parentNode, (tag) => {
      return validDecorators.some((t) => t === tag.tagName.text);
    });

    const decoratorName = getDecoratorName(parentNode, (identifier) => {
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

function getDateType(typeNode: ts.TypeNode): Type {
  const parentNode = typeNode.parent as ts.Node;
  if (!parentNode) {
    return { typeName: "datetime" };
  }
  const decoratorName = getDecoratorName(parentNode, (identifier) => {
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

function getEnumerateType(
  typeNameNode: ts.EntityName
): EnumerateType | undefined {
  let enumDeclaration =
    MetadataGenerator.current.typeChecker.getSymbolAtLocation(typeNameNode)
      ?.declarations[0] as ts.EnumDeclaration;
  enumDeclaration = resolveImports(enumDeclaration);
  if (enumDeclaration?.kind !== ts.SyntaxKind.EnumDeclaration) {
    return undefined;
  }

  function getEnumValue(member: any) {
    const initializer = member.initializer;
    if (initializer) {
      if (initializer.expression) {
        return parseEnumValueByKind(
          initializer.expression.text,
          initializer.kind
        );
      }
      return parseEnumValueByKind(initializer.text, initializer.kind);
    }
    return;
  }
  return {
    enumMembers: enumDeclaration.members.map((member: any, index) => {
      return getEnumValue(member) || index;
    }),
    typeName: "enum",
  } as EnumerateType;
}

function parseEnumValueByKind(value: string, kind: ts.SyntaxKind): any {
  return kind === ts.SyntaxKind.NumericLiteral ? parseFloat(value) : value;
}

function getUnionType(typeNode: ts.TypeNode) {
  const union = typeNode as ts.UnionTypeNode;
  let baseType: any;
  let isObject = false;
  const types = union.types.filter(
    (t) => t.kind !== ts.SyntaxKind.UndefinedKeyword
  );
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
    return { typeName: "", types: mapedTypes } as UnionType;
  }
  return {
    enumMembers: union.types.map((type, index) => {
      return type.getText() ? removeQuotes(type.getText()) : index;
    }),
    typeName: "enum",
  } as EnumerateType;
}

function removeQuotes(str: string) {
  return str.replace(/^["']|["']$/g, "");
}

function getInlineObjectType(typeNode: ts.TypeNode): ObjectType {
  const type: ObjectType = {
    properties: getModelTypeProperties(typeNode),
    typeName: "",
  };
  return type;
}

function resolveLiteralType(
  literalTypeNode: any,
  genericTypeMap: Map<String, ts.TypeNode>
): EnumerateType {
  return {
    enumMembers: [literalTypeNode.text],
    typeName: "enum",
  };
}

function resolveSimpleTypeName(type: ts.EntityName): string {
  if (type.kind === ts.SyntaxKind.Identifier) {
    return (type as ts.Identifier).text;
  }

  const qualifiedType = type as ts.QualifiedName;
  return (qualifiedType.right as ts.Identifier).text;
}

function getTypeName(typeName: ts.EntityName): string {
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

function getModelTypeProperties(
  node: any,
  genericTypes?: Array<ts.TypeNode>
): Array<Property> {
  if (
    node.kind === ts.SyntaxKind.TypeLiteral ||
    node.kind === ts.SyntaxKind.InterfaceDeclaration
  ) {
    const interfaceDeclaration = node as ts.InterfaceDeclaration;
    return interfaceDeclaration.members
      .filter((member) => {
        if (
          (member as any).type &&
          (member as any).type.kind === ts.SyntaxKind.FunctionType
        ) {
          return false;
        }
        return member.kind === ts.SyntaxKind.PropertySignature;
      })
      .map((member: any) => {
        const propertyDeclaration = member as ts.PropertyDeclaration;
        const identifier = propertyDeclaration.name as ts.Identifier;

        if (!propertyDeclaration.type) {
          throw new Error("No valid type found for property declaration.");
        }

        // Declare a variable that can be overridden if needed
        let aType = propertyDeclaration.type;

        // aType.kind will always be a TypeReference when the property of Interface<T> is of type T
        if (
          aType.kind === ts.SyntaxKind.TypeReference &&
          genericTypes &&
          genericTypes.length &&
          node.typeParameters
        ) {
          // The type definitions are conviently located on the object which allow us to map -> to the genericTypes
          const typeParams = _.map(
            node.typeParameters,
            (typeParam: ts.TypeParameterDeclaration) => {
              return typeParam.name.text;
            }
          );

          // I am not sure in what cases
          const typeIdentifier = (aType as ts.TypeReferenceNode).typeName;
          let typeIdentifierName: string;

          // typeIdentifier can either be a Identifier or a QualifiedName
          if ((typeIdentifier as ts.Identifier).text) {
            typeIdentifierName = (typeIdentifier as ts.Identifier).text;
          } else {
            typeIdentifierName = (typeIdentifier as ts.QualifiedName).right
              .text;
          }

          // I could not produce a situation where this did not find it so its possible this check is irrelevant
          const indexOfType = _.indexOf<string>(typeParams, typeIdentifierName);
          if (indexOfType >= 0) {
            aType = genericTypes[indexOfType] as ts.TypeNode;
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

  let classDeclaration = node as ts.ClassDeclaration;

  let properties = classDeclaration.members.filter((member: any) => {
    if (member.kind !== ts.SyntaxKind.PropertyDeclaration) {
      return false;
    }

    const propertySignature = member as ts.PropertySignature;
    return propertySignature && hasPublicMemberModifier(propertySignature);
  }) as Array<ts.PropertyDeclaration | ts.ParameterDeclaration>;

  const classConstructor = classDeclaration.members.find(
    (member: any) => member.kind === ts.SyntaxKind.Constructor
  ) as ts.ConstructorDeclaration;

  if (classConstructor && classConstructor.parameters) {
    properties = properties.concat(
      classConstructor.parameters.filter((parameter) =>
        hasPublicConstructorModifier(parameter)
      ) as any
    );
  }

  return properties.map((declaration) => {
    const identifier = declaration.name as ts.Identifier;

    if (!declaration.type) {
      throw new Error("No valid type found for property declaration.");
    }

    return {
      description: getNodeDescription(declaration),
      name: identifier.text,
      required: !declaration.questionToken,
      type: resolveType(
        resolveTypeParameter(declaration.type, classDeclaration, genericTypes)
      ),
    };
  });
}

function resolveTypeParameter(
  type: any,
  classDeclaration: ts.ClassDeclaration,
  genericTypes?: Array<ts.TypeNode>
) {
  if (
    genericTypes &&
    classDeclaration.typeParameters &&
    classDeclaration.typeParameters.length
  ) {
    for (let i = 0; i < classDeclaration.typeParameters.length; i++) {
      if (
        type.typeName &&
        classDeclaration.typeParameters[i].name.text === type.typeName.text
      ) {
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

function getModifiers(node: ts.Node) {
  if (ts.canHaveModifiers(node)) {
    return ts.getModifiers(node) ?? [];
  }
  return [];
}

function hasPublicMemberModifier(node: ts.Node) {
  return (
    getModifiers(node).length > 0 &&
    getModifiers(node).every((modifier) => {
      return (
        modifier.kind !== ts.SyntaxKind.ProtectedKeyword &&
        modifier.kind !== ts.SyntaxKind.PrivateKeyword
      );
    })
  );
}

function hasPublicConstructorModifier(node: ts.Node) {
  return (
    getModifiers(node).length > 0 &&
    getModifiers(node).some((modifier) => {
      return modifier.kind === ts.SyntaxKind.PublicKeyword;
    })
  );
}

function getNodeDescription(
  node: UsableDeclaration | ts.PropertyDeclaration | ts.ParameterDeclaration
) {
  let symbol = MetadataGenerator.current.typeChecker.getSymbolAtLocation(
    node.name as ts.Node
  );
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

    const comments = symbol.getDocumentationComment(
      MetadataGenerator.current.typeChecker
    );
    if (comments.length) {
      return ts.displayPartsToString(comments);
    }
  }

  return "";
}

export function getSuperClass(
  node: ts.ClassDeclaration,
  typeArguments?: Map<String, ts.TypeNode>
) {
  const clauses = node.heritageClauses;
  if (clauses) {
    const filteredClauses = clauses.filter(
      (clause) => clause.token === ts.SyntaxKind.ExtendsKeyword
    );
    if (filteredClauses.length > 0) {
      const clause: ts.HeritageClause = filteredClauses[0];
      if (clause.types && clause.types.length) {
        let type = MetadataGenerator.current.typeChecker.getSymbolAtLocation(
          clause.types[0].expression
        ).declarations[0] as UsableDeclaration;
        type = resolveImports(type);
        return {
          type: type,
          typeArguments: resolveTypeArguments(
            type,
            clause.types[0].typeArguments,
            typeArguments
          ),
        };
      }
    }
  }
  return undefined;
}

function buildGenericTypeMap(
  node: UsableDeclaration,
  typeArguments?: ReadonlyArray<ts.TypeNode>
) {
  const result: Map<String, ts.TypeNode> = new Map<String, ts.TypeNode>();
  if (node.typeParameters && typeArguments) {
    node.typeParameters.forEach((typeParam, index) => {
      const paramName = typeParam.name.text;
      result.set(paramName, typeArguments[index]);
    });
  }
  return result;
}

function resolveTypeArguments(
  node: UsableDeclaration,
  typeArguments?: ReadonlyArray<ts.TypeNode>,
  parentTypeArguments?: Map<String, ts.TypeNode>
) {
  const result = buildGenericTypeMap(node, typeArguments);
  if (parentTypeArguments) {
    result.forEach((value: any, key) => {
      const typeName = getTypeName(value);
      if (parentTypeArguments.has(typeName)) {
        result.set(key, parentTypeArguments.get(typeName) as ts.TypeNode);
      }
    });
  }
  return result;
}

/**
 * Used to identify union types of a primitive and array of the same primitive, e.g. `string | string[]`
 */
export function getCommonPrimitiveAndArrayUnionType(
  typeNode?: ts.TypeNode
): Type | null {
  if (typeNode && typeNode.kind === ts.SyntaxKind.UnionType) {
    const union = typeNode as ts.UnionTypeNode;
    const types = union.types
      .map((t) => resolveType(t))
      .filter((t) => t.typeName !== "undefined");
    const arrType = types.find((t) => t.typeName === "array") as
      | ArrayType
      | undefined;
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

export function getLiteralValue(expression: ts.Expression): any {
  if (expression.kind === ts.SyntaxKind.StringLiteral) {
    return (expression as ts.StringLiteral).text;
  }
  if (expression.kind === ts.SyntaxKind.NumericLiteral) {
    return parseFloat((expression as ts.NumericLiteral).text);
  }
  if (expression.kind === ts.SyntaxKind.TrueKeyword) {
    return true;
  }
  if (expression.kind === ts.SyntaxKind.FalseKeyword) {
    return false;
  }
  if (expression.kind === ts.SyntaxKind.ArrayLiteralExpression) {
    return (expression as ts.ArrayLiteralExpression).elements.map((e) =>
      getLiteralValue(e)
    );
  }
  return;
}

export function resolveImports<T>(node: T) {
  let nodeAsImportSpecifier = node as ts.ImportSpecifier;
  if (nodeAsImportSpecifier?.kind === ts.SyntaxKind.ImportSpecifier) {
    let checker = MetadataGenerator.current.typeChecker;
    const symbol = checker.getSymbolAtLocation(nodeAsImportSpecifier.name);
    const aliasedSymbol = checker.getAliasedSymbol(symbol);
    const declaration = aliasedSymbol.getDeclarations()[0];
    return declaration as T;
  }
  return node;
}
