import * as ts from "typescript";
import { Type } from "./metadataGenerator";
type UsableDeclaration = ts.InterfaceDeclaration | ts.ClassDeclaration | ts.TypeAliasDeclaration;
export declare function resolveType(typeNode?: ts.TypeNode, genericTypeMap?: Map<String, ts.TypeNode>): Type;
export declare function getSuperClass(node: ts.ClassDeclaration, typeArguments?: Map<String, ts.TypeNode>): {
    type: UsableDeclaration;
    typeArguments: Map<String, ts.TypeNode>;
};
/**
 * Used to identify union types of a primitive and array of the same primitive, e.g. `string | string[]`
 */
export declare function getCommonPrimitiveAndArrayUnionType(typeNode?: ts.TypeNode): Type | null;
export declare function getLiteralValue(expression: ts.Expression): any;
export declare function resolveImports<T>(node: T): T;
export {};
//# sourceMappingURL=resolveType.d.ts.map