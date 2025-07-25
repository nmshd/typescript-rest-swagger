import { Project } from "ts-morph";
import * as ts from "typescript";
import { EndpointGenerator } from "./endpointGenerator";
import { Method } from "./metadataGenerator";
export declare class MethodGenerator extends EndpointGenerator<ts.MethodDeclaration> {
    private readonly controllerPath;
    classNode: ts.ClassDeclaration;
    private method;
    private path;
    constructor(node: ts.MethodDeclaration, morph: Project, controllerPath: string, classNode: ts.ClassDeclaration);
    isValid(): boolean;
    getMethodName(): string;
    generate(): Method;
    protected getCurrentLocation(): string;
    private buildParameters;
    private processMethodDecorators;
    private getMethodSuccessResponse;
    private getMethodSuccessResponseData;
    private getMethodSuccessExamples;
    private mergeResponses;
    private supportsPathMethod;
}
//# sourceMappingURL=methodGenerator.d.ts.map