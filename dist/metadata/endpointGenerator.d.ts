import * as debug from "debug";
import { Project } from "ts-morph";
import * as ts from "typescript";
import { ResponseType } from "./metadataGenerator";
export declare abstract class EndpointGenerator<T extends ts.Node> {
    protected node: T;
    protected debugger: debug.Debugger;
    protected morph: Project;
    constructor(node: T, morph: Project, name: string);
    protected getDecoratorValues(decoratorName: string, acceptMultiple?: boolean): any[];
    protected getSecurity(): {
        name: any;
        scopes: string[];
    }[] | undefined;
    protected handleRolesArray(argument: ts.ArrayLiteralExpression): Array<string>;
    protected getExamplesValue(argument: any): any;
    protected getInitializerValue(initializer: any): any;
    protected getResponses(): Array<ResponseType>;
    protected abstract getCurrentLocation(): string;
}
//# sourceMappingURL=endpointGenerator.d.ts.map