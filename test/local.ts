import * as SwaggerParser from "@apidevtools/swagger-parser";
import { cloneDeep } from "lodash";
import { MetadataGenerator } from "../src/metadata/metadataGenerator";
import { SpecGenerator } from "../src/swagger/generator";
import { Swagger } from "../src/swagger/swagger";
import { getDefaultOptions } from "./data/defaultOptions";
import YAML = require("yamljs");

(async function () {
  const metadata = new MetadataGenerator(
    ["./test/data/apidebug.ts"],
    "./test/tsconfig.json",
  ).generate();
  const spec = new SpecGenerator(
    metadata,
    getDefaultOptions()
  ).getOpenApiSpec();
  const specDeRef = (await SwaggerParser.dereference(
    cloneDeep(spec) as any
  )) as unknown as Swagger.Spec;
  const yamlString = YAML.stringify(spec, 100, 2);
  debugger;
})();
