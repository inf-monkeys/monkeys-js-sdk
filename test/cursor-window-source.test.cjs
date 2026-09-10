const { test } = require('node:test');
const assert = require('node:assert/strict');
const { PageSchema } = require('../lib/contracts/declarative-control.js');
const { page, revision } = require('./declarative-control-fixtures.cjs');
test('cursor window has one declared event owner independent from its query target', () => {
  const original = page.capabilityInstances[0];
  const source = { ...original, instanceId: 'pagination-source', nodeId: 'pagination-source-node' };
  const node = { ...page.renderTree.nodes.find(node => node.nodeId === original.nodeId), nodeId: source.nodeId };
  const binding = { ...page.ontologyBindings[0], cursorWindow: { sourceCapabilityInstanceId: source.instanceId, pageChangePort: 'page.change', pageChangeIntentSchemaRevisionRef: revision('schema', 'page-change') } };
  const value = { ...page, capabilityInstances: [...page.capabilityInstances, source], renderTree: { ...page.renderTree, nodes: [...page.renderTree.nodes, node] }, ontologyBindings: [binding] };
  const parsed = PageSchema.safeParse(value);
  assert.equal(parsed.success, true, parsed.error?.message);
  assert.equal(PageSchema.safeParse({ ...value, ontologyBindings: [{ ...binding, cursorWindow: { ...binding.cursorWindow, sourceCapabilityInstanceId: 'missing' } }] }).success, false);
  assert.equal(PageSchema.safeParse({ ...value, actionBindings: [{ ...page.actionBindings[0], source: { capabilityInstanceId: source.instanceId, port: 'page.change' } }] }).success, false);
  assert.equal(PageSchema.safeParse({ ...value, ontologyBindings: [binding, { ...binding, bindingId: 'duplicate-owner' }] }).success, false);
});
