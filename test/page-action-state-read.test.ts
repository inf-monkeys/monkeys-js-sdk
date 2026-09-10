import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createRequire } from 'node:module';
import { ActionBindingSchema, PageSchema } from '../src/contracts/declarative-control';
import { evaluatePageExpression } from '../src/runtime/page-expression';
const { page } = createRequire(import.meta.url)('./declarative-control-fixtures.cjs');
const read = (path: string[]) => ({ kind: 'read' as const, root: 'actions' as const, path });
const withProperty = (expression = read(['favorite', 'pending'])) => ({ ...page, capabilityInstances: [{ ...page.capabilityInstances[0], propertyBindings: [{ targetPath: ['disabled'], expression }] }] });
test('properties can read declared public pending or safe error state', () => {
  assert.equal(PageSchema.safeParse(withProperty()).success, true);
  assert.equal(PageSchema.safeParse(withProperty(read(['favorite', 'errorCode']))).success, true);
  assert.equal(evaluatePageExpression(read(['favorite', 'pending']), { actions: { favorite: { pending: true } } }), true);
  for (const path of [[], ['missing', 'pending'], ['favorite'], ['favorite', 'result'], ['favorite', 'pending', 'nested']]) assert.equal(PageSchema.safeParse(withProperty(read(path))).success, false);
});
test('action status never becomes command input, action condition, repeated data or event payload', () => {
  const expression = read(['favorite', 'pending']);
  assert.equal(ActionBindingSchema.safeParse({ ...page.actionBindings[0], inputMapping: { recordId: { kind: 'expression', expression } } }).success, false);
  assert.equal(ActionBindingSchema.safeParse({ ...page.actionBindings[0], when: expression }).success, false);
  assert.equal(PageSchema.safeParse({ ...page, capabilityInstances: [{ ...page.capabilityInstances[0], eventPayloadBindings: [{ port: 'favorite', expression }] }] }).success, false);
  assert.equal(PageSchema.safeParse({ ...page, renderTree: { ...page.renderTree, nodes: [{ ...page.renderTree.nodes[0], repeat: { source: expression, keyPath: ['id'], limit: 10 } }] } }).success, false);
});
test('a parent can aggregate pending but cannot read a repeated row error', () => {
  const row = { ...page.renderTree.nodes[0], nodeId: 'row', parentNodeId: 'gallery', slot: 'rows', repeat: { source: { kind: 'literal', value: [{ id: 'a' }] }, keyPath: ['id'], limit: 10 } };
  const scoped = { ...withProperty(), renderTree: { ...page.renderTree, nodes: [{ ...page.renderTree.nodes[0], children: ['row'] }, row] }, capabilityInstances: [...withProperty().capabilityInstances, { ...page.capabilityInstances[0], instanceId: 'row', nodeId: 'row' }], actionBindings: [{ ...page.actionBindings[0], source: { ...page.actionBindings[0].source, capabilityInstanceId: 'row' } }] };
  assert.equal(PageSchema.safeParse(scoped).success, true);
  scoped.capabilityInstances[0].propertyBindings[0].expression = read(['favorite', 'errorCode']);
  assert.equal(PageSchema.safeParse(scoped).success, false);
  scoped.capabilityInstances[1].propertyBindings = scoped.capabilityInstances[0].propertyBindings;
  delete scoped.capabilityInstances[0].propertyBindings;
  const parsed = PageSchema.safeParse(scoped); assert.equal(parsed.success, true, JSON.stringify(parsed.error?.issues));
});

test('pending aggregation permits a nested ancestor and rejects an unrelated repeated branch', () => {
  const base = structuredClone(page);
  const root = { ...base.renderTree.nodes[0], children: ['parent', 'other'] };
  const parent = { ...root, nodeId: 'parent', parentNodeId: root.nodeId, slot: 'rows', children: ['child'], repeat: { source: { kind: 'literal', value: [{ id: 'p' }] }, keyPath: ['id'], limit: 10 } };
  const child = { ...parent, nodeId: 'child', parentNodeId: 'parent', children: [] };
  const other = { ...parent, nodeId: 'other', parentNodeId: root.nodeId, children: [] };
  base.renderTree.nodes = [root, parent, child, other];
  base.capabilityInstances = [base.capabilityInstances[0], ...['parent', 'child', 'other'].map(id => ({ ...base.capabilityInstances[0], instanceId: id, nodeId: id }))];
  base.actionBindings[0].source.capabilityInstanceId = 'child';
  base.capabilityInstances[1].propertyBindings = [{ targetPath: ['disabled'], expression: read(['favorite', 'pending']) }];
  const accepted = PageSchema.safeParse(base);
  assert.equal(accepted.success, true, JSON.stringify(accepted.error?.issues));
  base.capabilityInstances[3].propertyBindings = base.capabilityInstances[1].propertyBindings;
  assert.equal(PageSchema.safeParse(base).success, false);
});
