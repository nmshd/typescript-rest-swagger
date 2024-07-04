"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isReferenceObject = isReferenceObject;
exports.isArrayObject = isArrayObject;
function isReferenceObject(schema) {
    return schema && schema.$ref !== undefined;
}
function isArrayObject(schema) {
    return schema && "items" in schema;
}
//# sourceMappingURL=swagger.js.map