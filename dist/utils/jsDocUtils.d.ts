import * as ts from "typescript";
export declare function getJSDocDescription(node: ts.Node): string;
export declare function getJSDocTag(node: ts.Node, tagName: string): string | undefined;
export declare function isExistJSDocTag(node: ts.Node, tagName: string): boolean;
export declare function getFirstMatchingJSDocTagName(node: ts.Node, isMatching: (t: ts.JSDocTag) => boolean): string | undefined;
//# sourceMappingURL=jsDocUtils.d.ts.map