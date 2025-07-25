import { Project } from "ts-morph";
import * as ts from "typescript";
import {
  getDecoratorName,
  getDecoratorOptions,
  getDecoratorTextValue,
} from "../utils/decoratorUtils";
import { getNodeAsTsMorphNode } from "../utils/utils";
import { MetadataGenerator, Parameter, Type } from "./metadataGenerator";
import {
  getCommonPrimitiveAndArrayUnionType,
  getLiteralValue,
  resolveType,
} from "./resolveType";

export class ParameterGenerator {
  constructor(
    private readonly parameter: ts.ParameterDeclaration,
    private readonly method: string,
    private readonly path: string,
    private readonly morph: Project
  ) {}

  public generate(): Parameter | undefined {
    const decoratorName = getDecoratorName(this.parameter, (identifier) =>
      this.supportParameterDecorator(identifier.text)
    );

    switch (decoratorName) {
      case "Param":
        return this.getRequestParameter(this.parameter);
      case "CookieParam":
        return this.getCookieParameter(this.parameter);
      case "HeaderParam":
        return this.getHeaderParameter(this.parameter);
      case "QueryParam":
        return this.getQueryParameter(this.parameter);
      case "PathParam":
        return this.getPathParameter(this.parameter);
      case "Context":
      case "ContextRequest":
      case "ContextResponse":
      case "ContextNext":
      case "ContextLanguage":
      case "ContextAccept":
        return this.getContextParameter(this.parameter);
      default:
        return this.getBodyParameter(this.parameter);
    }
  }

  private getCurrentLocation() {
    const methodId = (this.parameter.parent as ts.MethodDeclaration)
      .name as ts.Identifier;
    const controllerId = (
      (this.parameter.parent as ts.MethodDeclaration)
        .parent as ts.ClassDeclaration
    ).name as ts.Identifier;
    return `${controllerId.text}.${methodId.text}`;
  }

  private getRequestParameter(parameter: ts.ParameterDeclaration): Parameter {
    const parameterName = (parameter.name as ts.Identifier).text;
    const type = this.getValidatedType(parameter);

    if (!this.supportsBodyParameters(this.method)) {
      throw new Error(
        `Param can't support '${this.getCurrentLocation()}' method.`
      );
    }
    return {
      description: this.getParameterDescription(parameter),
      in: "param",
      name:
        getDecoratorTextValue(
          this.parameter,
          (ident) => ident.text === "Param"
        ) || parameterName,
      parameterName: parameterName,
      required: this.isRequired(parameter),
      type: type,
    };
  }

  private getContextParameter(parameter: ts.ParameterDeclaration): Parameter {
    const parameterName = (parameter.name as ts.Identifier).text;

    return {
      description: this.getParameterDescription(parameter),
      in: "context",
      name: parameterName,
      parameterName: parameterName,
      required: this.isRequired(parameter),
      type: { typeName: "" },
    };
  }

  private getCookieParameter(parameter: ts.ParameterDeclaration): Parameter {
    const parameterName = (parameter.name as ts.Identifier).text;
    //        const type = this.getValidatedType(parameter);

    // if (!this.supportPathDataType(type)) {
    //     throw new Error(`Cookie can't support '${this.getCurrentLocation()}' method.`);
    // }

    return {
      description: this.getParameterDescription(parameter),
      in: "cookie",
      name:
        getDecoratorTextValue(
          this.parameter,
          (ident) => ident.text === "CookieParam"
        ) || parameterName,
      parameterName: parameterName,
      required: this.isRequired(parameter),
      type: { typeName: "" },
    };
  }

  private getBodyParameter(parameter: ts.ParameterDeclaration): Parameter {
    const parameterName = (parameter.name as ts.Identifier).text;
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

  private getHeaderParameter(parameter: ts.ParameterDeclaration): Parameter {
    const parameterName = (parameter.name as ts.Identifier).text;
    const type = this.getValidatedType(parameter);

    if (!this.supportPathDataType(type)) {
      throw new InvalidParameterException(
        `Parameter '${parameterName}' can't be passed as a header parameter in '${this.getCurrentLocation()}'.`
      );
    }

    return {
      description: this.getParameterDescription(parameter),
      in: "header",
      name:
        getDecoratorTextValue(
          this.parameter,
          (ident) => ident.text === "HeaderParam"
        ) || parameterName,
      parameterName: parameterName,
      required: this.isRequired(parameter),
      type: type,
    };
  }

  private getQueryParameter(parameter: ts.ParameterDeclaration): Parameter {
    const parameterName = (parameter.name as ts.Identifier).text;
    const parameterOptions =
      getDecoratorOptions(
        this.parameter,
        (ident) => ident.text === "QueryParam"
      ) || {};
    let type = this.getValidatedType(parameter);

    if (!this.supportQueryDataType(type)) {
      const arrayType = getCommonPrimitiveAndArrayUnionType(
        getNodeAsTsMorphNode(parameter, this.morph).getType()
      );
      if (arrayType && this.supportQueryDataType(arrayType)) {
        type = arrayType;
      } else {
        throw new InvalidParameterException(
          `Parameter '${parameterName}' can't be passed as a query parameter in '${this.getCurrentLocation()}'.`
        );
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
      name:
        getDecoratorTextValue(
          this.parameter,
          (ident) => ident.text === "QueryParam"
        ) || parameterName,
      parameterName: parameterName,
      required: this.isRequired(parameter),
      type: type,
    };
  }
  isRequired(parameter: ts.ParameterDeclaration): boolean {
    let isUndefinedUnion =
      parameter.type?.kind === ts.SyntaxKind.UnionType &&
      (parameter.type as ts.UnionTypeNode).types.some(
        (t: any) => t.kind === ts.SyntaxKind.UndefinedKeyword
      );
    return (
      !parameter.questionToken && !parameter.initializer && !isUndefinedUnion
    );
  }

  private getPathParameter(parameter: ts.ParameterDeclaration): Parameter {
    const parameterName = (parameter.name as ts.Identifier).text;
    const type = this.getValidatedType(parameter);
    const pathName =
      getDecoratorTextValue(
        this.parameter,
        (ident) => ident.text === "PathParam"
      ) || parameterName;

    if (!this.supportPathDataType(type)) {
      throw new InvalidParameterException(
        `Parameter '${parameterName}:${type}' can't be passed as a path parameter in '${this.getCurrentLocation()}'.`
      );
    }
    if (
      !this.path.includes(`{${pathName}}`) &&
      !this.path.includes(`:${pathName}`)
    ) {
      throw new Error(
        `Parameter '${parameterName}' can't match in path: '${this.path}'`
      );
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

  private getParameterDescription(node: ts.ParameterDeclaration) {
    const symbol = MetadataGenerator.current.typeChecker.getSymbolAtLocation(
      node.name
    );

    if (symbol) {
      const comments = symbol.getDocumentationComment(
        MetadataGenerator.current.typeChecker
      );
      if (comments.length) {
        return ts.displayPartsToString(comments);
      }
    }

    return "";
  }

  private supportsBodyParameters(method: string) {
    return ["delete", "post", "put", "patch"].some((m) => m === method);
  }

  private supportParameterDecorator(decoratorName: string) {
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

  private supportPathDataType(parameterType: Type) {
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

  private supportQueryDataType(parameterType: Type) {
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

  private getValidatedType(parameter: ts.ParameterDeclaration) {
    if (!parameter.type) {
      throw new Error(
        `Parameter ${
          parameter.name
        } doesn't have a valid type assigned in '${this.getCurrentLocation()}'.`
      );
    }
    const nodeAsTsMorphNode = getNodeAsTsMorphNode(parameter, this.morph);
    return resolveType(
      nodeAsTsMorphNode.getType(),
      undefined,
      nodeAsTsMorphNode
    );
  }

  private getDefaultValue(initializer?: ts.Expression) {
    if (!initializer) {
      return;
    }
    return getLiteralValue(initializer);
  }
}

class InvalidParameterException extends Error {}
