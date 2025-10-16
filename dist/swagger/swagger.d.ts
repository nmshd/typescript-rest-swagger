import { OpenAPIV3_1 } from "openapi-types";
export declare namespace Swagger {
    type Spec = OpenAPIV3_1.Document;
}
export type Schema = OpenAPIV3_1.SchemaObject | OpenAPIV3_1.ReferenceObject;
export declare function isReferenceObject(schema: Schema): schema is OpenAPIV3_1.ReferenceObject | OpenAPIV3_1.ReferenceObject;
export declare function isArrayObject(schema: Schema): schema is OpenAPIV3_1.ArraySchemaObject;
//# sourceMappingURL=swagger.d.ts.map