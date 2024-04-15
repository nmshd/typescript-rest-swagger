import { SwaggerConfig } from "../config";
import { Metadata } from "../metadata/metadataGenerator";
import { Swagger } from "./swagger";
export declare class SpecGenerator {
    private readonly metadata;
    private readonly config;
    private debugger;
    constructor(metadata: Metadata, config: SwaggerConfig);
    generate(): Promise<void>;
    getSwaggerSpec(): Swagger.Spec;
    getOpenApiSpec(): Swagger.Spec;
    private buildDefinitions;
    private buildPaths;
    private buildPathMethod;
    private buildParameter;
    private buildProperties;
    private buildOperation;
    private getMimeType;
    private getOperationId;
    private getSwaggerType;
    private getSwaggerTypeForPrimitiveType;
    private getSwaggerTypeForObjectType;
    private getSwaggerTypeForArrayType;
    private getSwaggerTypeForEnumType;
    private getSwaggerTypeForReferenceType;
}
//# sourceMappingURL=generator.d.ts.map