const { test } = require('node:test');
const assert = require('node:assert/strict');
const { ResolvedPageSchema, PageStateDefinitionSchema } = require('../lib/contracts/declarative-control.js');
const { BindingSourceSchema } = require('../lib/contracts/declarative-control.js');
const { page } = require('./declarative-control-fixtures.cjs');
const read = (root, ...path) => ({ kind: 'read', root, path });
const fixture = () => {
  const value = structuredClone(page);
  value.renderTree.nodes[0].repeat = { source: { kind: 'literal', value: [{ id: 'one' }] }, keyPath: ['id'], limit: 200 };
  value.ontologyBindings[0].parameters.recordId = { kind: 'scope-field', path: 'item.id' };
  return value;
};
test('repeat scope is published explicitly and scope query parameters require a repeated owner', () => {
  const input = fixture();
  assert.equal(ResolvedPageSchema.safeParse(input).success, true);
  delete input.renderTree.nodes[0].repeat;
  assert.equal(ResolvedPageSchema.safeParse(input).success, false);
  assert.equal(BindingSourceSchema.safeParse({ kind: 'scope-field', path: 'item.__proto__.secret' }).success, false);
});
test('a repeat cannot consume the query it instantiates, and empty/unsafe keys are rejected by schema', () => {
  const input = fixture();
  input.renderTree.nodes[0].repeat.source = read('bindings', input.ontologyBindings[0].bindingId, 'items');
  assert.equal(ResolvedPageSchema.safeParse(input).success, false);
  input.renderTree.nodes[0].repeat.source = { kind: 'literal', value: [] };
  input.renderTree.nodes[0].repeat.keyPath = [];
  assert.equal(ResolvedPageSchema.safeParse(input).success, false);
});
