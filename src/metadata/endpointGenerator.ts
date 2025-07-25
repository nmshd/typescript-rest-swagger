"use strict";

import * as debug from "debug";
import * as _ from "lodash";
import { ClassDeclaration, MethodDeclaration, Project } from "ts-morph";
import * as ts from "typescript";
import { getDecorators } from "../utils/decoratorUtils";
import { getNodeAsTsMorphNode } from "../utils/utils";
import { ResponseType, Type } from "./metadataGenerator";
import { resolveType } from "./resolveType";

export abstract class EndpointGenerator<T extends ts.Node> {
  protected node: T;
  protected debugger: debug.Debugger;
  protected morph: Project;

  constructor(node: T, morph: Project, name: string) {
    this.morph = morph;
    this.node = node;
    this.debugger = debug(`typescript-rest-swagger:metadata:${name}`);
  }

  protected getDecoratorValues(
    decoratorName: string,
    acceptMultiple: boolean = false
  ) {
    const decorators = getDecorators(
      this.node,
      (decorator) => decorator.text === decoratorName
    );
    if (!decorators || !decorators.length) {
      return [];
    }
    if (!acceptMultiple && decorators.length > 1) {
      throw new Error(
        `Only one ${decoratorName} decorator allowed in ${this.getCurrentLocation()}.`
      );
    }
    let result: Array<any>;
    if (acceptMultiple) {
      result = decorators.map((d) => d.arguments);
    } else {
      const d = decorators[0];
      result = d.arguments;
    }
    this.debugger("Arguments of decorator %s: %j", decoratorName, result);
    return result;
  }

  protected getSecurity() {
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

  protected handleRolesArray(
    argument: ts.ArrayLiteralExpression
  ): Array<string> {
    if (ts.isArrayLiteralExpression(argument)) {
      return argument.elements
        .map((value) => value.getText())
        .map((val) =>
          val && val.startsWith("'") && val.endsWith("'")
            ? val.slice(1, -1)
            : val
        );
    } else {
      return argument;
    }
  }

  protected getExamplesValue(argument: any) {
    let example: any = {};
    this.debugger(argument);
    if (argument.properties) {
      argument.properties.forEach((p: any) => {
        example[p.name.text] = this.getInitializerValue(p.initializer);
      });
    } else {
      example = this.getInitializerValue(argument);
    }
    this.debugger(
      "Example extracted for %s: %j",
      this.getCurrentLocation(),
      example
    );
    return example;
  }

  protected getInitializerValue(initializer: any) {
    switch (initializer.kind as ts.SyntaxKind) {
      case ts.SyntaxKind.ArrayLiteralExpression:
        return initializer.elements.map((e: any) =>
          this.getInitializerValue(e)
        );
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
        const nestedObject: any = {};

        initializer.properties.forEach((p: any) => {
          nestedObject[p.name.text] = this.getInitializerValue(p.initializer);
        });

        return nestedObject;
      default:
        return undefined;
    }
  }

  protected getResponses(): Array<ResponseType> {
    const tsMorphNode = getNodeAsTsMorphNode(this.node, this.morph);

    if (
      !(tsMorphNode instanceof ClassDeclaration) &&
      !(tsMorphNode instanceof MethodDeclaration)
    ) {
      throw new Error(
        `Node at position ${
          this.node.pos
        } is not a valid TypeScript node. Expected a MethodDeclaration or ClassDeclaration, but got ${tsMorphNode.getKindName()}.`
      );
    }

    const decorators = getDecorators(
      this.node,
      (decorator) => decorator.text === "Response"
    );
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
        let schema: Type | undefined = undefined;
        const typeArguments = decorator.getTypeArguments();
        if (typeArguments[0]) {
          schema = resolveType(typeArguments[0].getType());
        }

        const responses = {
          description: description,
          examples: examples,
          schema: schema,
          status: status,
        };
        this.debugger(
          "Generated Responses for %s: %j",
          this.getCurrentLocation(),
          responses
        );

        return responses;
      });
  }

  protected abstract getCurrentLocation(): string;
}
