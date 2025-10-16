#!/usr/bin/env node
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const argparse_1 = require("argparse");
const debug = require("debug");
const fs = require("fs-extra-promise");
const _ = require("lodash");
const path = require("path");
const path_1 = require("path");
const ts = require("typescript");
const YAML = require("yamljs");
const config_1 = require("./config");
const metadataGenerator_1 = require("./metadata/metadataGenerator");
const generator_1 = require("./swagger/generator");
const debugLog = debug("typescript-rest-swagger");
const workingDir = process.cwd();
const versionDefault = getPackageJsonValue("version");
const nameDefault = getPackageJsonValue("name");
const descriptionDefault = getPackageJsonValue("description");
const licenseDefault = getPackageJsonValue("license");
const parser = new argparse_1.ArgumentParser({
    add_help: true,
    description: "Typescript-REST Swagger tool",
});
parser.add_argument("-c", "--config", {
    help: "The swagger config file (swagger.json or swagger.yml or swaggerCongig.js).",
});
parser.add_argument("-t", "--tsconfig", {
    action: "store_true",
    default: false,
    help: "Load tsconfig.json file",
});
parser.add_argument("-p", "--tsconfig_path", {
    help: "The tsconfig file (tsconfig.json) path. Default to {cwd}/tsconfig.json.",
});
const parameters = parser.parse_args();
const config = getConfig(parameters.config);
const compilerOptions = getCompilerOptions(parameters.tsconfig, parameters.tsconfig_path);
debugLog("Starting Swagger generation tool");
debugLog("Compiler Options: %j", compilerOptions);
const swaggerConfig = validateSwaggerConfig(config.swagger);
debugLog("Swagger Config: %j", swaggerConfig);
debugLog("Processing Services Metadata");
const metadata = new metadataGenerator_1.MetadataGenerator(swaggerConfig.entryFile, parameters.tsconfig_path, swaggerConfig.ignore).generate();
debugLog("Generated Metadata: %j", metadata);
new generator_1.SpecGenerator(metadata, swaggerConfig)
    .generate()
    .then(() => {
    console.info("Generation completed.");
})
    .catch((err) => {
    console.error(`Error generating swagger. ${err.stack}`);
});
function getPackageJsonValue(key) {
    try {
        const projectPackageJson = require(`${workingDir}/package.json`);
        return projectPackageJson[key] || "";
    }
    catch (err) {
        return "";
    }
}
function getConfig(configPath = "swagger.json") {
    const configFile = `${workingDir}/${configPath}`;
    if (_.endsWith(configFile, ".yml") || _.endsWith(configFile, ".yaml")) {
        return YAML.load(configFile);
    }
    else if (_.endsWith(configFile, ".js")) {
        return require(path.join(configFile));
    }
    else {
        return fs.readJSONSync(configFile);
    }
}
function validateSwaggerConfig(conf) {
    if (!conf.outputDirectory) {
        throw new Error("Missing outputDirectory: onfiguration most contain output directory");
    }
    if (!conf.entryFile) {
        throw new Error("Missing entryFile: Configuration must contain an entry point file.");
    }
    conf.version = conf.version || versionDefault;
    conf.name = conf.name || nameDefault;
    conf.description = conf.description || descriptionDefault;
    conf.license = conf.license || licenseDefault;
    conf.yaml = conf.yaml === false ? false : true;
    conf.outputFormat = conf.outputFormat
        ? config_1.Specification[conf.outputFormat]
        : config_1.Specification.Swagger_2;
    return conf;
}
function getCompilerOptions(loadTsconfig, tsconfigPath) {
    if (!loadTsconfig && tsconfigPath) {
        loadTsconfig = true;
    }
    if (!loadTsconfig) {
        return {};
    }
    const cwd = process.cwd();
    const defaultTsconfigPath = (0, path_1.join)(cwd, "tsconfig.json");
    tsconfigPath = tsconfigPath
        ? getAbsolutePath(tsconfigPath, cwd)
        : defaultTsconfigPath;
    try {
        const tsConfig = require(tsconfigPath);
        if (!tsConfig) {
            throw new Error("Invalid tsconfig");
        }
        return tsConfig.compilerOptions
            ? ts.convertCompilerOptionsFromJson(tsConfig.compilerOptions, cwd).options
            : {};
    }
    catch (err) {
        if (err.code === "MODULE_NOT_FOUND") {
            throw Error(`No tsconfig file found at '${tsconfigPath}'`);
        }
        else if (err.name === "SyntaxError") {
            throw Error(`Invalid JSON syntax in tsconfig at '${tsconfigPath}': ${err.message}`);
        }
        else {
            throw Error(`Unhandled error encountered loading tsconfig '${tsconfigPath}': ${err.message}`);
        }
    }
}
function getAbsolutePath(p, basePath) {
    if ((0, path_1.isAbsolute)(p)) {
        return p;
    }
    else {
        return (0, path_1.join)(basePath, p);
    }
}
//# sourceMappingURL=cli.js.map