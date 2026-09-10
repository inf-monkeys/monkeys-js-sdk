const { test } = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');
const compiled = new Module(__filename, module); compiled.paths = module.paths;
compiled._compile(require('esbuild').buildSync({ entryPoints: [require('node:path').resolve(__dirname, '../src/runtime/target-render-model.ts')], bundle: true, packages: 'external', platform: 'node', format: 'cjs', write: false }).outputFiles[0].text, __filename);
test('target model validation resolves supplied schemas without coercing or leaking values', () => {
 const schema = { $id: 'https://test.example/model', type: 'object', additionalProperties: false, required: ['count'], properties: { count: { $ref: 'https://test.example/count' } } };
 const validate = compiled.exports.compileTargetRenderModelValidator(schema, [{ $id: 'https://test.example/count', type: 'number', minimum: 0 }]);
 const input = { count: 4 }; assert.deepEqual(validate(input), input);
 for (const bad of [{ count: '4' }, { count: -1 }, { count: 1, extra: 'private-value' }, [], null]) assert.throws(() => validate(bad), error => !String(error.message).includes('private-value'));
 assert.deepEqual(input, { count: 4 });
 assert.throws(() => compiled.exports.compileTargetRenderModelValidator({ type: 'object', properties: { count: { $ref: 'https://unavailable.example/schema' } } }));
});
