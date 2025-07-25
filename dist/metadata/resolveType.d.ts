import { Type as MorphType, Node } from "ts-morph";
import * as ts from "typescript";
import { Type } from "./metadataGenerator";
export declare function resolveType(type?: MorphType, parentTypeMap?: Record<string, MorphType>, node?: Node): Type;
/**
 * Used to identify union types of a primitive and array of the same primitive, e.g. `string | string[]`
 */
export declare function getCommonPrimitiveAndArrayUnionType(type: MorphType): Type | null;
export declare function getLiteralValue(expression: ts.Expression): any;
//# sourceMappingURL=resolveType.d.ts.map