import * as swaggerParser from "@apidevtools/swagger-parser";
import { cloneDeep } from "lodash";
import { MetadataGenerator } from "../src/metadata/metadataGenerator";
import { SpecGenerator } from "../src/swagger/generator";
import { Swagger } from "../src/swagger/swagger";
import { getDefaultOptions } from "./data/defaultOptions";

(async function () {
  const compilerOptions = {
    baseUrl: ".",
    paths: {
      "@/*": ["test/data/*"],
    },
  };
  const metadata = new MetadataGenerator(
    ["./test/data/apidebug.ts"],
    compilerOptions
  ).generate();
  const spec = new SpecGenerator(
    metadata,
    getDefaultOptions()
  ).getOpenApiSpec();
  const specDeRef = (await swaggerParser.dereference(
    cloneDeep(spec) as any
  )) as unknown as Swagger.Spec;
  JSON.stringify(specDeRef);
  debugger;
})();
