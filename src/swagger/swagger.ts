import { OpenAPIV3_1 } from "openapi-types";

export namespace Swagger {
  export type Spec = OpenAPIV3_1.Document;
}

export type Schema =  OpenAPIV3_1.SchemaObject | OpenAPIV3_1.ReferenceObject;

export function isReferenceObject(
  schema: Schema
): schema is OpenAPIV3_1.ReferenceObject | OpenAPIV3_1.ReferenceObject {
  return schema && (schema as OpenAPIV3_1.ReferenceObject).$ref !== undefined;
}

export function isArrayObject(
  schema: Schema
): schema is OpenAPIV3_1.ArraySchemaObject {
  return schema && "items" in schema;
}
