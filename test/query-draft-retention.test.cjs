const assert = require('node:assert/strict');
const { test } = require('node:test');
const { QueryBindingSchema, PageDataSchema } = require('../lib/contracts/declarative-control.js');
const { revision } = require('./declarative-control-fixtures.cjs');

const binding = {
  bindingId: 'editor', queryDefinitionRevisionRef: revision('domain-query-definition', 'editor.query'),
  parameters: { recordId: { kind: 'page-state', stateId: 'selected' }, search: { kind: 'page-state', stateId: 'search' } },
  target: { capabilityInstanceId: 'editor', port: 'model' }, renderModelSchemaRevisionRef: revision('schema', 'editor.model'),
  execution: 'server', pagination: 'cursor', cache: 'none', cancelOnChange: true,
  draftRetention: { identityParameters: ['recordId'] },
};

test('draft retention names the query identity independently from option search and pagination', () => {
  assert.deepEqual(QueryBindingSchema.parse(binding).draftRetention, binding.draftRetention);
  const { queryDefinitionRevisionRef, target, renderModelSchemaRevisionRef, ...source } = binding;
  assert.deepEqual(PageDataSchema.parse({ ...source, query: 'editor.query', port: 'model' }).draftRetention, binding.draftRetention);
});

test('unknown, duplicate, empty, and local query retention identities are rejected', () => {
  for (const identityParameters of [[], ['missing'], ['constructor'], ['recordId', 'recordId']]) {
    assert.equal(QueryBindingSchema.safeParse({ ...binding, draftRetention: { identityParameters } }).success, false);
  }
  assert.equal(QueryBindingSchema.safeParse({ ...binding, execution: 'local-state' }).success, false);
});
