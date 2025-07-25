"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizePath = normalizePath;
exports.getNodeAsTsMorphNode = getNodeAsTsMorphNode;
function normalizePath(path) {
    if (!path) {
        return path;
    }
    let parts = path.split("/");
    parts = parts.map((part) => part.startsWith(":") ? `{${part.slice(1)}}` : part);
    return parts.join("/");
}
function getNodeAsTsMorphNode(tsNode, project) {
    let node = project
        .getSourceFileOrThrow(tsNode.getSourceFile().fileName)
        .getDescendantAtPos(tsNode.pos);
    while (node?.getPos() !== tsNode.pos || node?.getEnd() !== tsNode.end) {
        if (!node) {
            break;
        }
        node = node?.getParent();
    }
    if (!node) {
        throw new Error(`Could not find node for ${tsNode.getSourceFile().fileName} at position ${tsNode.pos}.`);
    }
    if (node.getText() !== tsNode.getText()) {
        throw new Error(`Node is not a valid`);
    }
    return node;
}
//# sourceMappingURL=utils.js.map