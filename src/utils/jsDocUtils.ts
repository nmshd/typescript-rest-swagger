import { ExpressionWithTypeArguments, Node } from "ts-morph";
import * as ts from "typescript";

export function getJSDocDescription(node: ts.Node) {
  const jsDocs = (node as any).jsDoc as Array<ts.JSDoc>;
  if (!jsDocs || !jsDocs.length) {
    return "";
  }

  return (jsDocs[0].comment as string) || "";
}

export function getJSDocTag(node: ts.Node, tagName: string) {
  const tags = getJSDocTags(node, tagName);
  if (!tags || !tags.length) {
    return undefined;
  }
  return tags[0].comment as string;
}

export function isExistJSDocTag(node: ts.Node, tagName: string) {
  const tags = getJSDocTags(node, tagName);
  if (!tags || !tags.length) {
    return false;
  }
  return true;
}

function getJSDocTags(node: ts.Node, tagName: string) {
  return getMatchingJSDocTags(node, (t) => t.tagName.text === tagName);
}

function getMatchingJSDocTags(
  node: ts.Node,
  isMatching: (t: ts.JSDocTag) => boolean
) {
  const jsDocs = (node as any).jsDoc as Array<ts.JSDoc>;
  if (!jsDocs || !jsDocs.length) {
    return undefined;
  }

  const jsDoc = jsDocs[0];
  if (!jsDoc.tags) {
    return undefined;
  }

  return jsDoc.tags.filter(isMatching);
}

export function getJSDocDescriptionFromProperty(
  propNode: Node,
  parentNode?: Node
) {
  let description = "";
  const name = propNode.getSymbol()?.getName();
  if (Node.isJSDocable(propNode)) {
    const jsDocs = propNode.getJsDocs().map((jsDoc) => jsDoc.getCommentText());
    description += "\n"+jsDocs.join("\n").trim();
  }
  if (!parentNode) {
    return description.trim();
  }
  if (!name) {
    return description.trim();
  }

  const expressionsWithTypeArguments: ExpressionWithTypeArguments[] = [];

  if (Node.isClassLikeDeclarationBase(parentNode)) {
    const extendsClause = parentNode.getExtends();
    if (extendsClause) {
      expressionsWithTypeArguments.push(extendsClause);
    }
    const implementsClause = parentNode.getImplements();
    expressionsWithTypeArguments.push(...implementsClause);
  }

  if (Node.isInterfaceDeclaration(parentNode)) {
    const extendsClause = parentNode.getExtends();
    expressionsWithTypeArguments.push(...extendsClause);
  }

  if (expressionsWithTypeArguments.length > 0) {
    for (const expression of expressionsWithTypeArguments) {
      const propOfExtendsOrImplements = expression.getType().getProperty(name);
      if (propOfExtendsOrImplements) {
        const node = propOfExtendsOrImplements.getDeclarations().at(0);
        if (node) {
          description += "\n"+getJSDocDescriptionFromProperty(node);
        }
      }
    }
  }

  return description.trim();
}
