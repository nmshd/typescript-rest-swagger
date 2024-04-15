"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SpecGenerator = void 0;
const debug = require("debug");
const fs = require("fs");
const fs_extra_promise_1 = require("fs-extra-promise");
const _ = require("lodash");
const pathUtil = require("path");
const YAML = require("yamljs");
const swagger_1 = require("./swagger");
class SpecGenerator {
    metadata;
    config;
    debugger = debug("typescript-rest-swagger:spec-generator");
    constructor(metadata, config) {
        this.metadata = metadata;
        this.config = config;
    }
    async generate() {
        this.debugger("Generating swagger files.");
        this.debugger("Swagger Config: %j", this.config);
        this.debugger("Services Metadata: %j", this.metadata);
        let spec = this.getSwaggerSpec();
        // if (this.config.outputFormat === Specification.OpenApi_3) {
        //     spec = await this.convertToOpenApiSpec(spec);
        // }
        return new Promise((resolve, reject) => {
            const swaggerDirs = _.castArray(this.config.outputDirectory);
            this.debugger("Saving specs to folders: %j", swaggerDirs);
            swaggerDirs.forEach((swaggerDir) => {
                (0, fs_extra_promise_1.mkdirp)(swaggerDir)
                    .then(() => {
                    this.debugger("Saving specs json file to folder: %j", swaggerDir);
                    fs.writeFile(`${swaggerDir}/swagger.json`, JSON.stringify(spec, null, "\t"), (err) => {
                        if (err) {
                            return reject(err);
                        }
                        if (this.config.yaml) {
                            this.debugger("Saving specs yaml file to folder: %j", swaggerDir);
                            fs.writeFile(`${swaggerDir}/swagger.yaml`, YAML.stringify(spec, 1000), (errYaml) => {
                                if (errYaml) {
                                    return reject(errYaml);
                                }
                                this.debugger("Generated files saved to folder: %j", swaggerDir);
                                resolve();
                            });
                        }
                        else {
                            this.debugger("Generated files saved to folder: %j", swaggerDir);
                            resolve();
                        }
                    });
                })
                    .catch(reject);
            });
        });
    }
    getSwaggerSpec() {
        let spec = {
            components: {
                schemas: this.buildDefinitions(),
            },
            info: {
                title: "",
                version: "",
            },
            paths: this.buildPaths(),
            openapi: "3.0.1",
        };
        spec.security = this.config.securityDefinitions;
        spec.security = this.config.securityDefinitions
            ? this.config.securityDefinitions
            : [];
        if (this.config.description) {
            spec.info.description = this.config.description;
        }
        if (this.config.license) {
            spec.info.license = { name: this.config.license };
        }
        if (this.config.name) {
            spec.info.title = this.config.name;
        }
        if (this.config.version) {
            spec.info.version = this.config.version;
        }
        if (this.config.servers) {
            spec.servers = this.config.servers;
        }
        if (this.config.spec) {
            spec = require("merge").recursive(spec, this.config.spec);
        }
        this.debugger("Generated specs: %j", spec);
        return spec;
    }
    getOpenApiSpec() {
        return this.getSwaggerSpec();
    }
    // private async convertToOpenApiSpec(spec: Swagger.Spec) {
    //     this.debugger('Converting specs to openapi 3.0');
    //     const converter = require('swagger2openapi');
    //     const options = {
    //         patch: true,
    //         warnOnly: true,
    //     };
    //     const openapi = await converter.convertObj(spec, options);
    //     this.debugger('Converted to openapi 3.0: %j', openapi);
    //     return openapi.openapi;
    // }
    buildDefinitions() {
        const definitions = {};
        Object.keys(this.metadata.referenceTypes).map((typeName) => {
            this.debugger("Generating definition for type: %s", typeName);
            const referenceType = this.metadata.referenceTypes[typeName];
            this.debugger("Metadata for referenced Type: %j", referenceType);
            definitions[referenceType.typeName] = {
                description: referenceType.description,
                properties: this.buildProperties(referenceType.properties),
                type: "object",
            };
            const requiredFields = referenceType.properties
                .filter((p) => p.required)
                .map((p) => p.name);
            if (requiredFields && requiredFields.length) {
                definitions[referenceType.typeName].required = requiredFields;
            }
            // if (referenceType.additionalProperties) {
            //     definitions[referenceType.typeName].additionalProperties = this.buildAdditionalProperties(referenceType.additionalProperties);
            // }
            this.debugger("Generated Definition for type %s: %j", typeName, definitions[referenceType.typeName]);
        });
        return definitions;
    }
    buildPaths() {
        const paths = {};
        this.debugger("Generating paths declarations");
        this.metadata.controllers.forEach((controller) => {
            this.debugger("Generating paths for controller: %s", controller.name);
            controller.methods.forEach((method) => {
                this.debugger("Generating paths for method: %s", method.name);
                const path = pathUtil.posix.join("/", controller.path ? controller.path : "", method.path);
                paths[path] = paths[path] || {};
                method.consumes = _.union(controller.consumes, method.consumes);
                method.produces = _.union(controller.produces, method.produces);
                method.tags = _.union(controller.tags, method.tags);
                // method.security = method.security || controller.security;
                method.responses = _.union(controller.responses, method.responses);
                const pathObject = paths[path];
                pathObject[method.method] = this.buildPathMethod(controller.name, method);
                this.debugger("Generated path for method %s: %j", method.name, pathObject[method.method]);
            });
        });
        return paths;
    }
    buildPathMethod(controllerName, method) {
        const pathMethod = this.buildOperation(controllerName, method);
        pathMethod.description = method.description;
        if (method.summary) {
            pathMethod.summary = method.summary;
        }
        if (method.deprecated) {
            pathMethod.deprecated = method.deprecated;
        }
        if (method.tags.length) {
            pathMethod.tags = method.tags;
        }
        // if (method.security) {
        //   pathMethod.security = method.security.map((s) => ({
        //     [s.name]: s.scopes || [],
        //   }));
        // }
        const [bodyParam, noBodyParameter] = method.parameters.reduce(([pass, fail], elem) => {
            return elem.in === "body"
                ? [[...pass, elem], fail]
                : [pass, [...fail, elem]];
        }, [[], []]);
        pathMethod.parameters = noBodyParameter
            .filter((p) => p.in !== "param")
            .map((p) => this.buildParameter(p));
        noBodyParameter
            .filter((p) => p.in === "param")
            .forEach((p) => {
            pathMethod.parameters.push(this.buildParameter({
                description: p.description,
                in: "query",
                name: p.name,
                parameterName: p.parameterName,
                required: false,
                type: p.type,
            }));
            // pathMethod.parameters.push(
            //   this.buildParameter({
            //     description: p.description,
            //     in: "formData",
            //     name: p.name,
            //     parameterName: p.parameterName,
            //     required: false,
            //     type: p.type,
            //   })
            // );
        });
        if (bodyParam.length > 1) {
            throw new Error("Only one body parameter allowed per controller method.");
        }
        if (bodyParam.length > 0) {
            pathMethod.requestBody = {
                content: {
                    "application/json": {
                        schema: this.getSwaggerType(bodyParam[0].type),
                    },
                },
                description: bodyParam[0].description,
            };
        }
        return pathMethod;
    }
    buildParameter(parameter) {
        const swaggerParameter = {
            description: parameter.description,
            in: parameter.in,
            name: parameter.name,
            required: parameter.required,
        };
        const parameterType = this.getSwaggerType(parameter.type);
        swaggerParameter.schema = parameterType;
        return swaggerParameter;
    }
    buildProperties(properties) {
        const swaggerProperties = {};
        properties.forEach((property) => {
            const swaggerType = this.getSwaggerType(property.type);
            if (!swaggerType) {
                return;
            }
            if (!(0, swagger_1.isReferenceObject)(swaggerType)) {
                swaggerType.description = property.description;
            }
            swaggerProperties[property.name] = swaggerType;
        });
        return swaggerProperties;
    }
    buildOperation(controllerName, method) {
        const operation = {
            operationId: this.getOperationId(controllerName, method.name),
            responses: {},
        };
        method.responses.forEach((res) => {
            operation.responses[res.status] = {
                description: res.description,
                content: {},
            };
            if (res.schema) {
                const swaggerType = this.getSwaggerType(res.schema);
                const mimeType = this.getMimeType(swaggerType);
                const codeObject = operation.responses[res.status];
                if (!(0, swagger_1.isReferenceObject)(codeObject)) {
                    if (swaggerType) {
                        codeObject.content[mimeType] = {
                            schema: swaggerType,
                        };
                    }
                    // if (res.examples && mimeType) {
                    //   codeObject.content[mimeType].examples = res.examples;
                    // }
                }
            }
        });
        return operation;
    }
    getMimeType(swaggerType) {
        if ((0, swagger_1.isReferenceObject)(swaggerType)) {
            return "application/json";
        }
        if (swaggerType === undefined) {
            return undefined;
        }
        if (swaggerType.type === "array" || swaggerType.type === "object") {
            return "application/json";
        }
        else if (swaggerType.type === "string" &&
            swaggerType.format === "binary") {
            return "application/octet-stream";
        }
        else {
            return "text/html";
        }
    }
    getOperationId(controllerName, methodName) {
        const controllerNameWithoutSuffix = controllerName.replace(new RegExp("Controller$"), "");
        return `${controllerNameWithoutSuffix}${methodName.charAt(0).toUpperCase() + methodName.substr(1)}`;
    }
    getSwaggerType(type) {
        if (type.typeName === "void") {
            return undefined;
        }
        const swaggerType = this.getSwaggerTypeForPrimitiveType(type);
        if (swaggerType) {
            return swaggerType;
        }
        const arrayType = type;
        if (arrayType.elementType) {
            return this.getSwaggerTypeForArrayType(arrayType);
        }
        const enumType = type;
        if (enumType.enumMembers) {
            return this.getSwaggerTypeForEnumType(enumType);
        }
        const refType = type;
        if (refType.properties && refType.description !== undefined) {
            return this.getSwaggerTypeForReferenceType(type);
        }
        const unionType = type;
        if (unionType.types && unionType.types.length > 0) {
            let map = unionType.types.map((t) => this.getSwaggerType(t));
            let [enums, nonEnums] = _.partition(map, (m) => {
                return m.hasOwnProperty("enum");
            });
            map = [...nonEnums];
            let groupedEnums = _.groupBy(enums, (e) => "type" in e && e.type);
            _.each(groupedEnums, (enums, type) => {
                let enumValues = _.flatten(enums.map((e) => "enum" in e && e.enum));
                map.push({ type: type, enum: enumValues });
            });
            if (map.length === 1) {
                return map[0];
            }
            return { oneOf: map };
        }
        const objectType = type;
        return this.getSwaggerTypeForObjectType(objectType);
    }
    getSwaggerTypeForPrimitiveType(type) {
        const typeMap = {
            binary: { type: "string", format: "binary" },
            boolean: { type: "boolean" },
            buffer: { type: "string", format: "binary" },
            //            buffer: { type: 'string', format: 'base64' },
            byte: { type: "string", format: "byte" },
            date: { type: "string", format: "date" },
            datetime: { type: "string", format: "date-time" },
            double: { type: "number", format: "double" },
            file: { type: "string", format: "binary" },
            float: { type: "number", format: "float" },
            integer: { type: "integer", format: "int32" },
            long: { type: "integer", format: "int64" },
            object: { type: "object" },
            string: { type: "string" },
            void: undefined,
        };
        return typeMap[type.typeName];
    }
    getSwaggerTypeForObjectType(objectType) {
        return {
            type: "object",
            properties: this.buildProperties(objectType.properties),
        };
    }
    getSwaggerTypeForArrayType(arrayType) {
        return { type: "array", items: this.getSwaggerType(arrayType.elementType) };
    }
    getSwaggerTypeForEnumType(enumType) {
        return {
            enum: enumType.enumMembers,
            type: "string",
        };
    }
    getSwaggerTypeForReferenceType(referenceType) {
        return { $ref: `#/components/schemas/${referenceType.typeName}` };
    }
}
exports.SpecGenerator = SpecGenerator;
//# sourceMappingURL=generator.js.map