"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getJSDocDescription = getJSDocDescription;
exports.getJSDocTag = getJSDocTag;
exports.isExistJSDocTag = isExistJSDocTag;
exports.getJSDocDescriptionFromProperty = getJSDocDescriptionFromProperty;
const ts_morph_1 = require("ts-morph");
function getJSDocDescription(node) {
    const jsDocs = node.jsDoc;
    if (!jsDocs || !jsDocs.length) {
        return "";
    }
    return jsDocs[0].comment || "";
}
function getJSDocTag(node, tagName) {
    const tags = getJSDocTags(node, tagName);
    if (!tags || !tags.length) {
        return undefined;
    }
    return tags[0].comment;
}
function isExistJSDocTag(node, tagName) {
    const tags = getJSDocTags(node, tagName);
    if (!tags || !tags.length) {
        return false;
    }
    return true;
}
function getJSDocTags(node, tagName) {
    return getMatchingJSDocTags(node, (t) => t.tagName.text === tagName);
}
function getMatchingJSDocTags(node, isMatching) {
    const jsDocs = node.jsDoc;
    if (!jsDocs || !jsDocs.length) {
        return undefined;
    }
    const jsDoc = jsDocs[0];
    if (!jsDoc.tags) {
        return undefined;
    }
    return jsDoc.tags.filter(isMatching);
}
function getJSDocDescriptionFromProperty(propNode, parentNode) {
    let description = "";
    const name = propNode.getSymbol()?.getName();
    if (ts_morph_1.Node.isJSDocable(propNode)) {
        const jsDocs = propNode.getJsDocs().map((jsDoc) => jsDoc.getCommentText());
        description += "\n" + jsDocs.join("\n").trim();
    }
    if (!parentNode) {
        return description.trim();
    }
    if (!name) {
        return description.trim();
    }
    const expressionsWithTypeArguments = [];
    if (ts_morph_1.Node.isClassLikeDeclarationBase(parentNode)) {
        const extendsClause = parentNode.getExtends();
        if (extendsClause) {
            expressionsWithTypeArguments.push(extendsClause);
        }
        const implementsClause = parentNode.getImplements();
        expressionsWithTypeArguments.push(...implementsClause);
    }
    if (ts_morph_1.Node.isInterfaceDeclaration(parentNode)) {
        const extendsClause = parentNode.getExtends();
        expressionsWithTypeArguments.push(...extendsClause);
    }
    if (expressionsWithTypeArguments.length > 0) {
        for (const expression of expressionsWithTypeArguments) {
            const propOfExtendsOrImplements = expression.getType().getProperty(name);
            if (propOfExtendsOrImplements) {
                const node = propOfExtendsOrImplements.getDeclarations().at(0);
                if (node) {
                    description += "\n" + getJSDocDescriptionFromProperty(node);
                }
            }
        }
    }
    return description.trim();
}
//# sourceMappingURL=jsDocUtils.js.map