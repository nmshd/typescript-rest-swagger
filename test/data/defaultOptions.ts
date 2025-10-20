import { SwaggerConfig } from "./../../src/config";
export function getDefaultOptions(): SwaggerConfig {
    return {
        basePath: "/",
        collectionFormat: "multi",
        description: "Description of a test API",
        entryFile: "",
        servers: [
            {
                url: "http://localhost:3000"
            }
        ],
        license: "MIT",
        name: "Test API",
        outputDirectory: "",
        version: "1.0.0",
        yaml: false
    };
}
