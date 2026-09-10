const { test } = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');
const { resolve } = require('node:path');
const compiled = new Module(__filename, module); compiled.paths = module.paths;
compiled._compile(require('esbuild').buildSync({ stdin: { contents: "export { ComponentAssemblySchema } from './src/contracts/component-assembly'; export { compileComponentAssemblyValidator } from './src/runtime/component-assembly';", resolveDir: resolve(__dirname, '..') }, bundle: true, packages: 'external', platform: 'node', format: 'cjs', write: false }).outputFiles[0].text, __filename);
const { ComponentAssemblySchema, compileComponentAssemblyValidator } = compiled.exports;
const base = { contract: 'ComponentAssembly', schemaVersion: 1 };
const validate = compileComponentAssemblyValidator({ id: 'Stack', version: 1, source: 'Stack.tsx', exports: [], props: [{ name: 'children', kind: 'slot', type: 'ReactNode', required: true }, { name: 'title', kind: 'property', type: 'string', required: false }] });
test('single slot remains backward compatible and slot arrays preserve explicit names and order', () => {
 assert.equal(validate({ ...base, slots: { children: 'body' } }).slots.children, 'body');
 const input = { ...base, slots: { children: ['heading', 'body', 'footer'] } };
 assert.deepEqual(validate(input).slots.children, ['heading', 'body', 'footer']);
 assert.deepEqual(validate({ ...base, slots: { children: ['footer', 'heading'] } }).slots.children, ['footer', 'heading']);
 assert.deepEqual(input.slots.children, ['heading', 'body', 'footer']);
});
test('slot name arrays reject duplicates, empty or invalid names and bound fanout', () => {
 for (const children of [[], ['body', 'body'], [''], ['body', null], [['body']], Array.from({ length: 257 }, (_, index) => `slot-${index}`)]) {
  assert.equal(ComponentAssemblySchema.safeParse({ ...base, slots: { children } }).success, false);
  assert.throws(() => validate({ ...base, slots: { children } }));
 }
});
test('aggregation does not weaken prop ownership or slot-kind validation', () => {
 assert.throws(() => validate({ ...base, props: { children: 'competing owner' }, slots: { children: ['body'] } }));
 assert.throws(() => validate({ ...base, slots: { children: ['body'], title: ['heading'] } }), /slots member/);
 assert.throws(() => validate({ ...base, slots: { children: ['body'], unknown: ['extra'] } }), /slots member/);
});
