import * as swaggerParser from "@apidevtools/swagger-parser";
import { MetadataGenerator } from "../../src/metadata/metadataGenerator";
import { SpecGenerator } from "../../src/swagger/generator";
import { Swagger } from "../../src/swagger/swagger";
import { getDefaultOptions } from "../data/defaultOptions";

describe("Generic response schemas", () => {
    let spec: Swagger.Spec;

    beforeAll(async () => {
        const metadata = new MetadataGenerator(
            ["./test/data/genericResponses/apis.ts"],
            "./test/tsconfig.json"
        ).generate();
        const generatedSpec = new SpecGenerator(metadata, getDefaultOptions()).getOpenApiSpec();
        spec = (await swaggerParser.dereference(generatedSpec as any)) as unknown as Swagger.Spec;
    });

    test.each(["first", "second"])("preserves both union members of the %s response", (path) => {
        const result = (spec.paths![`/generic-responses/${path}`] as any).get.responses["200"].content[
            "application/json"
        ].schema.properties.result;

        expect(result.oneOf).toHaveLength(2);
        expect(result.oneOf).toEqual(
            expect.arrayContaining([
                expect.objectContaining({ properties: { isSuccess: expect.objectContaining({ const: true }) } }),
                expect.objectContaining({
                    properties: {
                        isSuccess: expect.objectContaining({ const: false }),
                        code: expect.objectContaining({ type: "string" }),
                        message: expect.objectContaining({ type: "string" })
                    }
                })
            ])
        );
    });

    test.each(["string", "number"])("preserves the %s specialization of an inline object", (type) => {
        const result = (spec.paths![`/generic-responses/${type}`] as any).get.responses["200"].content[
            "application/json"
        ].schema.properties.result;

        expect(result.properties.value.type).toEqual(type);
    });
});
