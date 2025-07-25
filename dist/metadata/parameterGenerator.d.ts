import { Project } from "ts-morph";
import * as ts from "typescript";
import { Parameter } from "./metadataGenerator";
export declare class ParameterGenerator {
    private readonly parameter;
    private readonly method;
    private readonly path;
    private readonly morph;
    constructor(parameter: ts.ParameterDeclaration, method: string, path: string, morph: Project);
    generate(): Parameter | undefined;
    private getCurrentLocation;
    private getRequestParameter;
    private getContextParameter;
    private getCookieParameter;
    private getBodyParameter;
    private getHeaderParameter;
    private getQueryParameter;
    isRequired(parameter: ts.ParameterDeclaration): boolean;
    private getPathParameter;
    private getParameterDescription;
    private supportsBodyParameters;
    private supportParameterDecorator;
    private supportPathDataType;
    private supportQueryDataType;
    private getValidatedType;
    private getDefaultValue;
}
//# sourceMappingURL=parameterGenerator.d.ts.map