const assert = require('node:assert/strict');
const test = require('node:test');
const { compilePageComposition } = require('../lib/runtime/page-composition');
const f = require('./declarative-control-fixtures.cjs');
const source = () => ({ contract: 'PageComposition', schemaVersion: 1,
  page: { pageId: 'example', tenantScope: f.tenantScope, identity: f.page.identity, surface: 'studio', route: '/example', access: f.page.pageAccessPolicy, managementAccess: f.managementAccess },
  components: { card: { root: { id: 'card', component: 'example.card', model: { title: '' }, children: [{ id: 'content', component: 'example.box' }] }, inputs: { title: { path: ['model', 'title'] } }, slots: { content: 'content' } } },
  body: { id: 'root', component: 'example.box', children: [
    { id: 'first', use: 'card', inputs: { title: 'First' }, slots: { content: [{ id: 'action', component: 'example.button' }] } },
    { id: 'second', use: 'card', inputs: { title: 'Second' } },
  ] },
});
test('expands reusable trees with independent inputs, stable node identities and explicit slots', () => {
  const input = source(), original = structuredClone(input), page = compilePageComposition(input);
  assert.equal(page.body.children[0].model.title, 'First');
  assert.equal(page.body.children[1].model.title, 'Second');
  assert.equal(page.body.children[0].children[0].id, 'first.content');
  assert.equal(page.body.children[0].children[0].children[0].id, 'action');
  assert.equal(page.body.children[1].children[0].id, 'second.content');
  assert.deepEqual(input, original);
});
test('rejects missing inputs, unknown components, duplicate identities and unsafe input paths', () => {
  for (const mutate of [
    input => delete input.body.children[0].inputs.title,
    input => input.body.children[0].use = 'missing',
    input => input.body.children[1].id = 'first',
    input => input.components.card.inputs.title.path = ['constructor', 'prototype', 'bad'],
    input => input.body.children[0].slots.unknown = [],
  ]) { const input = source(); mutate(input); assert.throws(() => compilePageComposition(input)); }
  assert.equal({}.bad, undefined);
});
