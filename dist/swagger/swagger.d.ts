import { OpenAPIV3 } from "openapi-types";
export declare namespace Swagger {
    interface Spec extends OpenAPIV3.Document {
    }
}
export type Schema = OpenAPIV3.SchemaObject | OpenAPIV3.ReferenceObject;
export declare function isReferenceObject(schema: Schema): schema is OpenAPIV3.ReferenceObject;
export declare function isArrayObject(schema: Schema): schema is OpenAPIV3.ArraySchemaObject;
//# sourceMappingURL=swagger.d.ts.map