import * as swaggerParser from '@apidevtools/swagger-parser';
import { cloneDeep } from 'lodash';
import { Metadata, MetadataGenerator } from '../../src/metadata/metadataGenerator';
import { SpecGenerator } from '../../src/swagger/generator';
import { Swagger } from '../../src/swagger/swagger';
import { getDefaultOptions } from '../data/defaultOptions';
import YAML = require('yamljs');

const jsonata = require('jsonata');

describe('Definition generation', () => {
    let spec: Swagger.Spec;
    let specDeRef: Swagger.Spec;
    let specString: string;
    let metadata: Metadata;
    beforeAll(async () => {
        metadata = new MetadataGenerator(['./test/data/apis.ts'], './test/tsconfig.json').generate();
        spec = new SpecGenerator(metadata, getDefaultOptions()).getSwaggerSpec();
        specString = YAML.stringify(spec, 10, 4);
        specDeRef = (await swaggerParser.dereference(cloneDeep(spec) as any)) as unknown as Swagger.Spec;
    });

    describe('MyService', () => {
        it('should generate paths for decorated services', () => {
            expect(spec.paths).toHaveProperty('/mypath');
            expect(spec.paths).toHaveProperty('/mypath/secondpath');
        });

        it('should generate paths for decorated services, declared on superclasses', () => {
            expect(spec.paths).toHaveProperty('/promise');
            expect(spec.paths).toHaveProperty('/promise/{id}');
        });

        it('should generate examples for object parameter', async () => {
            expect(spec.paths).toHaveProperty('/mypath/secondpath');
            const expression = jsonata(
                'paths."/mypath/secondpath".get.responses."200".content."application/json".example.name'
            );
            expect(await expression.evaluate(spec)).toEqual('Joe');
        });

        it('should generate examples for array parameter', async () => {
            expect(spec.paths).toHaveProperty('/mypath');
            const expression = jsonata('paths."/mypath".post.responses."200".content."application/json".example.name');
            expect(await expression.evaluate(spec)).toEqual('Joe');
        });

        it('should generate optional parameters for params with question marks, default or undefined union initializers', async () => {
            let expression = jsonata('paths."/mypath/secondpath".get.parameters[0].required');
            expect(await expression.evaluate(spec)).toEqual(true);
            expression = jsonata('paths."/mypath/secondpath".get.parameters[1].required');
            expect(await expression.evaluate(spec)).toEqual(false);
            expression = jsonata('paths."/mypath/secondpath".get.parameters[2].required');
            expect(await expression.evaluate(spec)).toEqual(false);
            expression = jsonata('paths."/mypath/secondpath".get.parameters[3].schema.enum');
            expect(await expression.evaluate(spec)).toEqual(['option1', 'option2']);
            expression = jsonata('paths."/mypath/secondpathundefined".get.parameters[0].required');
            expect(await expression.evaluate(spec)).toEqual(false);
        });

        it('should generate specs for enum params based on it values types', async () => {
            let expression = jsonata('paths."/mypath/secondpath".get.parameters[3]');
            let paramSpec = await expression.evaluate(spec);
            expect(paramSpec.schema.type).toEqual('string');
            expect(paramSpec.schema.enum).toEqual(['option1', 'option2']);

            expression = jsonata('paths."/mypath/secondpath".get.parameters[4]');
            paramSpec = await expression.evaluate(spec);
            expect(paramSpec.schema.type).toEqual('number');
            expect(paramSpec.schema.enum).toEqual([0, 1]);
        });

        it('should generate description for methods and parameters', async () => {
            let expression = jsonata('paths."/mypath/secondpath".get.parameters[0].description');
            expect(await expression.evaluate(spec)).toEqual('This is the test param description');
            expression = jsonata('paths."/mypath/secondpath".get.description');
            expect(await expression.evaluate(spec)).toEqual('This is the method description');
        });

        it('should support multiple response decorators', async () => {
            let expression = jsonata('paths."/mypath".get.responses."400".description');
            expect(await expression.evaluate(spec)).toEqual('The request format was incorrect.');
            expression = jsonata('paths."/mypath".get.responses."500".description');
            expect(await expression.evaluate(spec)).toEqual('There was an unexpected error.');
            expression = jsonata('paths."/mypath/secondpath".get.responses."200".description');
            expect(await expression.evaluate(spec)).toEqual('The success test.');
            expression = jsonata(
                'paths."/mypath/secondpath".get.responses."200".content."application/json".schema."$ref"'
            );
            expect(await expression.evaluate(spec)).toEqual('#/components/schemas/Person');
            expression = jsonata(
                'paths."/mypath/secondpath".get.responses."200".content."application/json"[0].example.name'
            );
            expect(await expression.evaluate(spec)).toEqual('Joe');
        });

        it('should include default response if a non-conflicting response is declared with a decorator', async () => {
            let expression = jsonata('paths."/promise".get.responses');
            expect(Object.keys(await expression.evaluate(spec)).length).toEqual(2);
            expression = jsonata('paths."/promise".get.responses."200".description');
            expect(await expression.evaluate(spec)).toEqual('Ok');
            expression = jsonata('paths."/promise".get.responses."401".description');
            expect(await expression.evaluate(spec)).toEqual('Unauthorized');
        });

        it('should not include default response if it conflicts with a declared response', async () => {
            let expression = jsonata('paths."/promise".post.responses');
            expect(Object.keys(await expression.evaluate(spec)).length).toEqual(2);
            expression = jsonata('paths."/promise".post.responses."201".description');
            expect(await expression.evaluate(spec)).toEqual('Person Created');
            expression = jsonata('paths."/promise".post.responses."201".content."application/json".example.name');
            expect(await expression.evaluate(spec)).toEqual('Test Person');
            expression = jsonata('paths."/promise".post.responses."401".description');
            expect(await expression.evaluate(spec)).toEqual('Unauthorized');
        });

        it("should update a declared response with the declared default response example if response annotation doesn't specify one", async () => {
            let expression = jsonata('paths."/promise/{id}".get.responses');
            expect(Object.keys(await expression.evaluate(spec)).length).toEqual(2);
            expression = jsonata('paths."/promise/{id}".get.responses."200".description');
            expect(await expression.evaluate(spec)).toEqual('All Good');
            expression = jsonata('paths."/promise/{id}".get.responses."200".content."application/json".example.name');
            expect(await expression.evaluate(spec)).toEqual('Test Person');
            expression = jsonata('paths."/promise/{id}".get.responses."401".description');
            expect(await expression.evaluate(spec)).toEqual('Unauthorized');
        });

        it('should generate a definition with a referenced type', async () => {
            const expression = jsonata('components.schemas.Person.properties.address."$ref"');
            expect(await expression.evaluate(spec)).toEqual('#/components/schemas/Address');
        });

        it('should generate a body param with string schema type', async () => {
            let expression = jsonata('paths."/mypath".post.requestBody.content."application/json".schema.type');
            expect(await expression.evaluate(spec)).toEqual('string');
        });

        it('should generate a body param with object schema type', async () => {
            let expression = jsonata('paths."/mypath/obj".post.requestBody.content."application/json".schema.type');
            expect(await expression.evaluate(spec)).toEqual('object');
        });

        it('should generate a query param with array type', async () => {
            const param = await jsonata('paths."/mypath/multi-query".get.parameters[0]').evaluate(spec);
            expect(param.name).toEqual('id');
            expect(param.required).toEqual(true);
            expect(param.schema.type).toEqual('array');
            expect(param.schema.items).toBeDefined;
            expect(param.schema.items.type).toEqual('string');
        });

        it('should generate an array query param for parameter with compatible array and primitive intersection type', async () => {
            const param = await jsonata('paths."/mypath/multi-query".get.parameters[1]').evaluate(spec);
            expect(param.name).toEqual('name');
            expect(param.required).toEqual(false);
            expect(param.schema.type).toEqual('array');
            expect(param.schema.items).toBeDefined;
            expect(param.schema.items.type).toEqual('string');
        });

        it('should generate default value for a number query param', async () => {
            const param = await jsonata('paths."/mypath/default-query".get.parameters[0]').evaluate(spec);
            expect(param.name).toEqual('num');
            expect(param.required).toEqual(false);
            expect(param.schema.type).toEqual('number');
            expect(param.schema.default).toEqual(5);
        });

        it('should generate default value for a string query param', async () => {
            const param = await jsonata('paths."/mypath/default-query".get.parameters[1]').evaluate(spec);
            expect(param.name).toEqual('str');
            expect(param.required).toEqual(false);
            expect(param.schema.type).toEqual('string');
            expect(param.schema.default).toEqual('default value');
        });

        it('should generate default value for a true boolean query param', async () => {
            const param = await jsonata('paths."/mypath/default-query".get.parameters[2]').evaluate(spec);
            expect(param.name).toEqual('bool1');
            expect(param.required).toEqual(false);
            expect(param.schema.type).toEqual('boolean');
            expect(param.schema.default).toEqual(true);
        });

        it('should generate default value for a false boolean query param', async () => {
            const param = await jsonata('paths."/mypath/default-query".get.parameters[3]').evaluate(spec);
            expect(param.name).toEqual('bool2');
            expect(param.required).toEqual(false);
            expect(param.schema.type).toEqual('boolean');
            expect(param.schema.default).toEqual(false);
        });

        it('should generate default value for a string array query param', async () => {
            const param = await jsonata('paths."/mypath/default-query".get.parameters[4]').evaluate(spec);
            expect(param.name).toEqual('arr');
            expect(param.required).toEqual(false);
            expect(param.schema.type).toEqual('array');
            expect(param.schema.items).toBeDefined;
            expect(param.schema.items.type).toEqual('string');
            expect(param.schema.default).toStrictEqual(['a', 'b', 'c']);
        });
    });

    describe('TypeEndpoint', () => {
        it('should generate definitions for type aliases', async () => {
            expect(spec.paths).toHaveProperty('/type/{param}');
            let expression = jsonata('components.schemas.SimpleHelloType.properties.greeting.description');
            expect(await expression.evaluate(spec)).toEqual('Description for greeting property');

            // expression = jsonata("components.schemas.UUID");
            // expect(await expression.evaluate(spec)).toEqual({
            //   description: "",
            //   properties: {},
            //   type: "object",
            // });
        });

        it('should generate nested object types in definitions', async () => {
            let expression = jsonata('components.schemas.SimpleHelloType.properties.profile.type');
            expect(await expression.evaluate(spec)).toEqual('object');
            expression = jsonata('components.schemas.SimpleHelloType.properties.profile.description');
            expect(await expression.evaluate(spec)).toEqual('Description for profile');
            expression = jsonata('components.schemas.SimpleHelloType.properties.profile.properties.name.type');
            expect(await expression.evaluate(spec)).toEqual('string');
            expression = jsonata('components.schemas.SimpleHelloType.properties.profile.properties.name.description');
            expect(await expression.evaluate(spec)).toEqual('Description for profile name');
        });

        it('should ignore properties that are functions', async () => {
            const expression = jsonata('components.schemas.SimpleHelloType.properties.comparePassword');
            expect(await expression.evaluate(spec)).toBeUndefined;
        });

        it('should support compilerOptions', async () => {
            let expression = jsonata('components.schemas.TestInterface');
            expect(await expression.evaluate(spec)).toEqual({
                description: '',
                properties: {
                    a: { type: 'string', description: '' },
                    b: { type: 'number', format: 'double', description: '' }
                },
                required: ['a', 'b'],
                type: 'object'
            });
            expect(spec.paths).toHaveProperty('/mypath/test-compiler-options');
            expression = jsonata(
                'paths."/mypath/test-compiler-options".post.responses."200".content."application/json".schema'
            );
            expect(await expression.evaluate(spec)).toEqual({
                $ref: '#/components/schemas/TestInterface'
            });
            expression = jsonata(
                'paths."/mypath/test-compiler-options".post.requestBody.content."application/json".schema'
            );
            expect(await expression.evaluate(spec)).toEqual({
                $ref: '#/components/schemas/TestInterface'
            });
        });
        it('should support formparam', async () => {
            expect(spec.paths).toHaveProperty('/mypath/test-form-param');
            let expression = jsonata('paths."/mypath/test-form-param".post.responses."200".content."text/html".schema');
            expect(await expression.evaluate(spec)).toEqual({ type: 'string' });
            expression = jsonata('paths."/mypath/test-form-param".post.requestBody');
            expect(await expression.evaluate(spec)).toEqual({
                required: true,
                content: {
                    'multipart/form-data': {
                        schema: {
                            type: 'object',
                            properties: {
                                id: {
                                    type: 'string',
                                    description: ''
                                }
                            }
                        }
                    }
                }
            });
        });
    });

    describe('PrimitiveEndpoint', () => {
        it('should generate integer type for @IsInt decorator declared on class property', async () => {
            let expression = jsonata('components.schemas.PrimitiveClassModel.properties.int.type');
            expect(await expression.evaluate(spec)).toEqual('integer');
            expression = jsonata('components.schemas.PrimitiveClassModel.properties.int.format');
            expect(await expression.evaluate(spec)).toEqual('int32');
            expression = jsonata('components.schemas.PrimitiveClassModel.properties.int.description');
            expect(await expression.evaluate(spec)).toEqual('An integer');
        });

        it('should generate integer type for @IsLong decorator declared on class property', async () => {
            let expression = jsonata('components.schemas.PrimitiveClassModel.properties.long.type');
            expect(await expression.evaluate(spec)).toEqual('integer');
            expression = jsonata('components.schemas.PrimitiveClassModel.properties.long.format');
            expect(await expression.evaluate(spec)).toEqual('int64');
            expression = jsonata('components.schemas.PrimitiveClassModel.properties.long.description');
            expect(await expression.evaluate(spec)).toEqual('');
        });

        it('should generate number type for @IsFloat decorator declared on class property', async () => {
            let expression = jsonata('components.schemas.PrimitiveClassModel.properties.float.type');
            expect(await expression.evaluate(spec)).toEqual('number');
            expression = jsonata('components.schemas.PrimitiveClassModel.properties.float.format');
            expect(await expression.evaluate(spec)).toEqual('float');
            expression = jsonata('components.schemas.PrimitiveClassModel.properties.float.description');
            expect(await expression.evaluate(spec)).toEqual('');
        });

        it('should generate number type for @IsDouble decorator declared on class property', async () => {
            let expression = jsonata('components.schemas.PrimitiveClassModel.properties.double.type');
            expect(await expression.evaluate(spec)).toEqual('number');
            expression = jsonata('components.schemas.PrimitiveClassModel.properties.double.format');
            expect(await expression.evaluate(spec)).toEqual('double');
            expression = jsonata('components.schemas.PrimitiveClassModel.properties.double.description');
            expect(await expression.evaluate(spec)).toEqual('');
        });

        it('should generate integer type for jsdoc @IsInt tag on interface property', async () => {
            let expression = jsonata('components.schemas.PrimitiveInterfaceModel.properties.int.type');
            expect(await expression.evaluate(spec)).toEqual('integer');
            expression = jsonata('components.schemas.PrimitiveInterfaceModel.properties.int.format');
            expect(await expression.evaluate(spec)).toEqual('int32');
            expression = jsonata('components.schemas.PrimitiveInterfaceModel.properties.int.description');
            expect(await expression.evaluate(spec)).toEqual('An integer');
        });

        it('should generate integer type for jsdoc @IsLong tag on interface property', async () => {
            let expression = jsonata('components.schemas.PrimitiveInterfaceModel.properties.long.type');
            expect(await expression.evaluate(spec)).toEqual('integer');
            expression = jsonata('components.schemas.PrimitiveInterfaceModel.properties.long.format');
            expect(await expression.evaluate(spec)).toEqual('int64');
            expression = jsonata('components.schemas.PrimitiveInterfaceModel.properties.long.description');
            expect(await expression.evaluate(spec)).toEqual('');
        });

        it('should generate number type for jsdoc @IsFloat tag on interface property', async () => {
            let expression = jsonata('components.schemas.PrimitiveInterfaceModel.properties.float.type');
            expect(await expression.evaluate(spec)).toEqual('number');
            expression = jsonata('components.schemas.PrimitiveInterfaceModel.properties.float.format');
            expect(await expression.evaluate(spec)).toEqual('float');
            expression = jsonata('components.schemas.PrimitiveInterfaceModel.properties.float.description');
            expect(await expression.evaluate(spec)).toEqual('');
        });

        it('should generate number type for jsdoc @IsDouble tag on interface property', async () => {
            let expression = jsonata('components.schemas.PrimitiveInterfaceModel.properties.double.type');
            expect(await expression.evaluate(spec)).toEqual('number');
            expression = jsonata('components.schemas.PrimitiveInterfaceModel.properties.double.format');
            expect(await expression.evaluate(spec)).toEqual('double');
            expression = jsonata('components.schemas.PrimitiveInterfaceModel.properties.double.description');
            expect(await expression.evaluate(spec)).toEqual('');
        });

        it('should generate number type decorated path params', async () => {
            let expression = jsonata('paths."/primitives/{id}".get.parameters[0].schema.type');
            const evaluation = await expression.evaluate(spec);
            expect(evaluation).toEqual('integer');
            expression = jsonata('paths."/primitives/{id}".get.parameters[0].schema.format');
            expect(await expression.evaluate(spec)).toEqual('int64');
        });

        it('should generate array type names as type + Array', async () => {
            let expression = jsonata('components.schemas.ResponseBodystringArray');
            expect(await expression.evaluate(spec)).toBeUndefined;
            expression = jsonata(
                'paths."/primitives/arrayNative".get.responses."200".content."application/json".schema."$ref"'
            );
            expect(await expression.evaluate(spec)).toEqual('#/components/schemas/ResponseBody-stringArray-');
            expression = jsonata(
                'paths."/primitives/array".get.responses."200".content."application/json".schema."$ref"'
            );
            expect(await expression.evaluate(spec)).toEqual('#/components/schemas/ResponseBody-stringArray-');
        });
    });

    describe('ParameterizedEndpoint', () => {
        it('should generate path param for params declared on class', async () => {
            const expression = jsonata('paths."/parameterized/{objectId}/test".get.parameters[0].in');
            expect(await expression.evaluate(spec)).toEqual('path');
        });
    });

    describe('AbstractEntityEndpoint', () => {
        it('should not duplicate inherited properties in the required list', async () => {
            const expression = jsonata('components.schemas.NamedEntity.required');
            expect(await expression.evaluate(spec)).toStrictEqual(['id', 'name']);
        });

        it('should use property description from base class if not defined in child', async () => {
            let expression = jsonata('components.schemas.NamedEntity.properties.id.description');
            expect(await expression.evaluate(spec)).toEqual('A numeric identifier');
            expression = jsonata('components.schemas.NamedExtendEntity.properties.id.description');
            expect(await expression.evaluate(spec)).toEqual('A numeric identifier');
            expression = jsonata('components.schemas.NamedBothEntity.properties.id.description');
            expect(await expression.evaluate(spec)).toEqual('A numeric identifier\nA numeric identifier2');
        });
    });

    // describe("SecureEndpoint", () => {
    //   it.skip("should apply controller security to request", async () => {
    //     const expression = jsonata('paths."/secure".get.security');
    //     const res = await expression.evaluate(spec);
    //     expect(res).toStrictEqual([{ access_token: ["ROLE_1", "ROLE_2"] }]);
    //   });

    //   it("method security should override controller security", async () => {
    //     const expression = jsonata('paths."/secure".post.security');
    //     expect(await expression.evaluate(spec)).toStrictEqual([
    //       { user_email: [] },
    //     ]);
    //   });
    // });

    // describe("SuperSecureEndpoint", () => {
    //   it("should apply two controller securities to request", async () => {
    //     const expression = jsonata('paths."/supersecure".get.security');
    //     expect(await expression.evaluate(spec)).toStrictEqual([
    //       { default: ["access_token"] },
    //       { default: ["user_email"] },
    //       { default: [] },
    //     ]);
    //   });
    // });

    describe('ResponseController', () => {
        it('should support multiple response decorators on controller', async () => {
            let expression = jsonata('paths."/response".get.responses."400".description');
            expect(await expression.evaluate(spec)).toEqual('The request format was incorrect.');
            expression = jsonata('paths."/response".get.responses."500".description');
            expect(await expression.evaluate(spec)).toEqual('There was an unexpected error.');
        });

        it('should support decorators on controller and method', async () => {
            let expression = jsonata('paths."/response/test".get.responses."400".description');
            expect(await expression.evaluate(spec)).toEqual('The request format was incorrect.');
            expression = jsonata('paths."/response/test".get.responses."500".description');
            expect(await expression.evaluate(spec)).toEqual('There was an unexpected error.');
            expression = jsonata('paths."/response/test".get.responses."502".description');
            expect(await expression.evaluate(spec)).toEqual('Internal server error.');
            expression = jsonata('paths."/response/test".get.responses."401".description');
            expect(await expression.evaluate(spec)).toEqual('Unauthorized.');
        });
    });

    describe('SpecGenerator', () => {
        it('should be able to generate open api 3.0 outputs', async () => {
            const openapi = await new SpecGenerator(metadata, getDefaultOptions()).getOpenApiSpec();
            // const expression = jsonata('paths."/supersecure".get.security');
            // expect(await expression.evaluate(openapi)).toStrictEqual([
            //   { default: ["access_token"] },
            //   { default: ["user_email"] },
            //   { default: [] },
            // ]);
            expect(openapi.openapi).toEqual('3.0.1');
        });
    });

    describe('TestUnionType', () => {
        it('should support union types', async () => {
            const expression = jsonata('paths."/unionTypes".post.requestBody.content."application/json"');
            const paramSpec = await expression.evaluate(spec);
            const definitionExpression = jsonata('components.schemas.MytypeWithUnion.properties.property');
            const myTypeDefinition = await definitionExpression.evaluate(spec);
            expect(paramSpec.schema.$ref).toEqual('#/components/schemas/MytypeWithUnion');
            expect(myTypeDefinition.type).toEqual('string');
            expect(myTypeDefinition.enum).toEqual(['value1', 'value2']);
        });
    });

    describe('deep generic object', () => {
        test('TestDeepGenericObject', async () => {
            const expression = jsonata(
                'paths."/mypath/generic".get.responses."200".content."application/json".schema."$ref"'
            );

            const res = await expression.evaluate(spec);
            expect(res).toEqual('#/components/schemas/GenericA-Deep-EndArray.Error-.Error-');
        });
    });

    describe('Body decorator', () => {
        test('should support @Body decorator', async () => {
            let expression = jsonata(
                'paths."/mypath/dedicated-body".post.requestBody.content."application/json".schema'
            );
            let reqBodySpec = await expression.evaluate(spec);
            expect(reqBodySpec).toEqual({
                $ref: '#/components/schemas/MyDatatype'
            });
        });
    });

    describe('Literal types', () => {
        test('should support literal types in definitions', async () => {
            let expression = jsonata('components.schemas.MyLiteralDatatype.properties.propertyA');
            let propSpec = await expression.evaluate(spec);
            expect(propSpec.type).toEqual('string');
            expect(propSpec.enum).toEqual(['value1', 'value2']);

            expression = jsonata('components.schemas.MyLiteralDatatype.properties.propertyB');
            propSpec = await expression.evaluate(spec);
            expect(propSpec.type).toEqual('number');
            expect(propSpec.enum).toEqual([1, 2]);

            expression = jsonata('components.schemas.MyLiteralDatatype.properties.propertyC');
            propSpec = await expression.evaluate(spec);
            expect(propSpec.const).toEqual(true);

            expression = jsonata('components.schemas.MyLiteralDatatype.properties.propertyD');
            propSpec = await expression.evaluate(spec);
            expect(propSpec.const).toEqual(false);

            expression = jsonata('components.schemas.MyLiteralDatatype.properties.propertyE');
            propSpec = await expression.evaluate(spec);
            expect(propSpec.const).toEqual('fixedString');

            expression = jsonata('components.schemas.MyLiteralDatatype.properties.propertyF');
            propSpec = await expression.evaluate(spec);
            expect(propSpec.const).toEqual(42);

            expression = jsonata('components.schemas.MyLiteralDatatype.properties.propertyG.properties.subProperty');
            propSpec = await expression.evaluate(spec);
            expect(propSpec.const).toEqual('subValue1');
        });
    });
});
