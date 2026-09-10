import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createRequire } from 'node:module';
import { PageSchema, QueryBindingSchema } from '../src/contracts/declarative-control';
const { page, revision } = createRequire(import.meta.url)('./declarative-control-fixtures.cjs');
const read = (root: string, path: string[]) => ({ kind: 'read', root, path });
const binding = { bindingId: 'status', queryDefinitionRevisionRef: revision('domain-query-definition', 'status'), parameters: {}, target: { capabilityInstanceId: page.capabilityInstances[0].instanceId, port: 'model' }, renderModelSchemaRevisionRef: revision('schema', 'status.model'), execution: 'server', pagination: 'none', cache: 'none', cancelOnChange: true };
const query = (when: unknown) => ({ ...binding, refreshPolicy: { intervalMs: 5000, when } });
test('conditional refresh accepts verified model and public pending but no event, secrets, error or other state roots', () => {
  for (const when of [read('model', ['detail', 'log', 'status']), read('actions', ['favorite', 'pending']), { kind: 'literal', value: false }]) assert.equal(QueryBindingSchema.safeParse(query(when)).success, true);
  for (const when of [read('actions', []), read('actions', ['favorite', 'result']), read('actions', ['favorite', 'errorCode']), read('actions', ['favorite', 'pending', 'nested']), ...['intent', 'result', 'state', 'bindings', 'scope'].map(root => read(root, ['value']))]) assert.equal(QueryBindingSchema.safeParse(query(when)).success, false, JSON.stringify(when));
  assert.equal(QueryBindingSchema.safeParse({ ...query(read('model', ['active'])), pagination: 'cursor' }).success, false);
});
test('Page checks declared action identifiers for polling without requiring an action on the same node', () => {
  const accepted = PageSchema.safeParse({ ...page, queryBindings: [query(read('actions', ['favorite', 'pending']))] });
  assert.equal(accepted.success, true, JSON.stringify(accepted.error?.issues));
  assert.equal(PageSchema.safeParse({ ...page, queryBindings: [query(read('actions', ['missing', 'pending']))] }).success, false);
});
test('polling pending aggregates ancestors while rejecting unrelated repeated branches', () => {
  const root = { ...page.renderTree.nodes[0], children: ['row', 'other'] };
  const row = { ...root, nodeId: 'row', parentNodeId: root.nodeId, children: [], slot: 'rows', repeat: { source: { kind: 'literal', value: [{ id: 'a' }] }, keyPath: ['id'], limit: 10 } };
  const other = { ...row, nodeId: 'other', slot: 'others' };
  const scoped = { ...page, renderTree: { ...page.renderTree, nodes: [root, row, other] }, capabilityInstances: [page.capabilityInstances[0], ...['row', 'other'].map(id => ({ ...page.capabilityInstances[0], instanceId: id, nodeId: id }))], actionBindings: [{ ...page.actionBindings[0], source: { ...page.actionBindings[0].source, capabilityInstanceId: 'row' } }], queryBindings: [query(read('actions', ['favorite', 'pending']))] };
  const accepted = PageSchema.safeParse(scoped); assert.equal(accepted.success, true, JSON.stringify(accepted.error?.issues));
  scoped.queryBindings[0].target = { capabilityInstanceId: 'other', port: 'model' };
  assert.equal(PageSchema.safeParse(scoped).success, false);
});
