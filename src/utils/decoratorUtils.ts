import * as ts from "typescript";

export function getDecorators(node: ts.Node, isMatching: (identifier: DecoratorData) => boolean): Array<DecoratorData> {
    const decorators = ts.canHaveDecorators(node) ? ts.getDecorators(node) : [];
    if (!decorators || !decorators.length) {
        return [];
    }

    return decorators
        .map((d): DecoratorData => {
            let x: any = d.expression;
            let args: Array<string | ts.Expression> = [];
            let typeArguments: ts.NodeArray<ts.TypeNode> = ts.factory.createNodeArray([]);
            if (ts.isCallExpression(x)) {
                if (x.arguments) {
                    args = x.arguments.map((argument) => {
                        if (ts.isStringLiteral(argument)) {
                            return argument.text;
                        } else if (ts.isNumericLiteral(argument)) {
                            return argument.text;
                        } else {
                            return argument;
                        }
                    });
                }
                if (x.typeArguments) {
                    typeArguments = x.typeArguments;
                }
                x = x.expression;
            }
            return {
                text: x.text || x.name.text,
                arguments: args,
                typeArguments: typeArguments
            };
        })
        .filter(isMatching);
}

function getDecorator(node: ts.Node, isMatching: (identifier: DecoratorData) => boolean) {
    const decorators = getDecorators(node, isMatching);
    if (!decorators || !decorators.length) {
        return undefined;
    }

    return decorators[0];
}

export function getDecoratorName(node: ts.Node, isMatching: (identifier: DecoratorData) => boolean) {
    const decorator = getDecorator(node, isMatching);
    return decorator ? decorator.text : undefined;
}

export function getDecoratorTextValue(node: ts.Node, isMatching: (identifier: DecoratorData) => boolean) {
    const decorator = getDecorator(node, isMatching);
    return decorator && typeof decorator.arguments[0] === "string" ? (decorator.arguments[0] as string) : undefined;
}

export function getDecoratorOptions(node: ts.Node, isMatching: (identifier: DecoratorData) => boolean) {
    const decorator = getDecorator(node, isMatching);
    return decorator && typeof decorator.arguments[1] === "object"
        ? (decorator.arguments[1] as { [key: string]: any })
        : undefined;
}

export function isDecorator(node: ts.Node, isMatching: (identifier: DecoratorData) => boolean) {
    const decorators = getDecorators(node, isMatching);
    if (!decorators || !decorators.length) {
        return false;
    }
    return true;
}

export interface DecoratorData {
    text: string;
    arguments: Array<string | ts.Expression>;
    typeArguments: ts.NodeArray<ts.TypeNode>;
}
