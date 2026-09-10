const { test } = require('node:test');
const assert = require('node:assert/strict');
const { QueryBindingSchema } = require('../lib/contracts/declarative-control.js');
const { analyzePageBindingDependencies } = require('../lib/contracts/page-binding-dependencies.js');
const ref = (kind, id) => ({ kind, id, ownerRepo: 'monkeys-server', visibility: 'global', revision: 1, schemaVersion: 1, contentHash: 'a'.repeat(64) });
const read = (root, ...path) => ({ kind: 'read', root, path });
const binding = () => ({ bindingId: 'report', queryDefinitionRevisionRef: ref('domain-query-definition', 'report'), parameters: {}, target: { capabilityInstanceId: 'filters', port: 'model' }, renderModelSchemaRevisionRef: ref('schema', 'raw-report'), targetProjection: { expression: read('model', 'filters'), schemaRevisionRef: ref('schema', 'editor') }, execution: 'server', pagination: 'none', cache: 'none', cancelOnChange: true });
test('query projection pins an independent target schema and only reads the validated raw model', () => {
  const value = binding();
  assert.equal(QueryBindingSchema.parse(value).targetProjection.schemaRevisionRef.id, 'editor');
  for (const root of ['state', 'scope', 'bindings', 'intent', 'result']) assert.equal(QueryBindingSchema.safeParse({ ...value, targetProjection: { ...value.targetProjection, expression: read(root, 'filters') } }).success, false);
  assert.equal(QueryBindingSchema.safeParse({ ...value, targetProjection: { ...value.targetProjection, schemaRevisionRef: ref('page', 'wrong') } }).success, false);
});
test('completion effects have one target each, no side-effect inputs, and participate in dependency cycles', () => {
  const effect = { targetStateId: 'selected', value: read('model', 'rows', '0', 'id'), when: { kind: 'operator', operator: 'equals', arguments: [read('state', 'selected'), { kind: 'literal', value: '' }] } };
  const source = { ...binding(), stateEffects: [effect] };
  assert.equal(QueryBindingSchema.safeParse(source).success, true);
  assert.equal(QueryBindingSchema.safeParse({ ...source, stateEffects: [effect, effect] }).success, false);
  assert.equal(QueryBindingSchema.safeParse({ ...source, pagination: 'cursor' }).success, false);
  assert.equal(QueryBindingSchema.safeParse({ ...source, stateEffects: [{ ...effect, value: read('intent', 'selected') }] }).success, false);
  const dependent = { bindingId: 'models', parameters: { id: { kind: 'page-state', stateId: 'selected' } } };
  assert.deepEqual(analyzePageBindingDependencies([dependent, source]).order, ['report', 'models']);
  assert.ok(analyzePageBindingDependencies([{ ...source, parameters: { id: { kind: 'binding-field', bindingId: 'models' } } }, dependent]).errors.some((error) => error.code === 'CYCLE'));
});

test('query projections bind collection scope lexically without admitting caller scope', () => {
  const value = binding();
  const parse = expression => QueryBindingSchema.safeParse({ ...value, targetProjection: { ...value.targetProjection, expression } }).success;
  const map = child => ({ kind: 'map', source: read('model', 'rows'), value: child });
  assert.equal(parse(map(read('scope', 'item', 'id'))), true);
  assert.equal(parse(map(read('scope', 'index'))), true);
  assert.equal(parse(map(read('scope', 'parent', 'item'))), false);
  assert.equal(parse(map(read('scope'))), false);
  assert.equal(parse({ kind: 'map', source: read('scope', 'item'), value: read('scope', 'item') }), false);
  assert.equal(parse(map({ kind: 'map', source: read('scope', 'item', 'children'), value: read('scope', 'parent', 'item', 'id') })), true);
  assert.equal(parse(map({ kind: 'map', source: read('scope', 'item', 'children'), value: read('scope', 'parent', 'parent', 'item') })), false);
});
