"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDecorators = getDecorators;
exports.getDecoratorName = getDecoratorName;
exports.getDecoratorTextValue = getDecoratorTextValue;
exports.getDecoratorOptions = getDecoratorOptions;
exports.isDecorator = isDecorator;
const ts = require("typescript");
function getDecorators(node, isMatching) {
    const decorators = ts.canHaveDecorators(node) ? ts.getDecorators(node) : [];
    if (!decorators || !decorators.length) {
        return [];
    }
    return decorators
        .map((d) => {
        let x = d.expression;
        let args = [];
        let typeArguments = ts.factory.createNodeArray([]);
        if (ts.isCallExpression(x)) {
            if (x.arguments) {
                args = x.arguments.map((argument) => {
                    if (ts.isStringLiteral(argument)) {
                        return argument.text;
                    }
                    else if (ts.isNumericLiteral(argument)) {
                        return argument.text;
                    }
                    else {
                        return argument;
                    }
                });
                ;
            }
            if (x.typeArguments) {
                typeArguments = x.typeArguments;
            }
            x = x.expression;
        }
        return {
            text: x.text || x.name.text,
            arguments: args,
            typeArguments: typeArguments,
        };
    })
        .filter(isMatching);
}
function getDecorator(node, isMatching) {
    const decorators = getDecorators(node, isMatching);
    if (!decorators || !decorators.length) {
        return undefined;
    }
    return decorators[0];
}
function getDecoratorName(node, isMatching) {
    const decorator = getDecorator(node, isMatching);
    return decorator ? decorator.text : undefined;
}
function getDecoratorTextValue(node, isMatching) {
    const decorator = getDecorator(node, isMatching);
    return decorator && typeof decorator.arguments[0] === "string"
        ? decorator.arguments[0]
        : undefined;
}
function getDecoratorOptions(node, isMatching) {
    const decorator = getDecorator(node, isMatching);
    return decorator && typeof decorator.arguments[1] === "object"
        ? decorator.arguments[1]
        : undefined;
}
function isDecorator(node, isMatching) {
    const decorators = getDecorators(node, isMatching);
    if (!decorators || !decorators.length) {
        return false;
    }
    return true;
}
//# sourceMappingURL=decoratorUtils.js.map