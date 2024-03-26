import { OpenAPIV3 } from "openapi-types";

export namespace Swagger {
  export interface Spec extends OpenAPIV3.Document {}
}

export type Schema = OpenAPIV3.SchemaObject | OpenAPIV3.ReferenceObject;

export function isReferenceObject(
  schema: Schema
): schema is OpenAPIV3.ReferenceObject {
  return schema && (schema as OpenAPIV3.ReferenceObject).$ref !== undefined;
}

export function isArrayObject(
  schema: Schema
): schema is OpenAPIV3.ArraySchemaObject {
  return schema && "items" in schema;
}
