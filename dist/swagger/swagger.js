"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isArrayObject = exports.isReferenceObject = void 0;
function isReferenceObject(schema) {
    return schema && schema.$ref !== undefined;
}
exports.isReferenceObject = isReferenceObject;
function isArrayObject(schema) {
    return schema && "items" in schema;
}
exports.isArrayObject = isArrayObject;
//# sourceMappingURL=swagger.js.map