const {test} = require('node:test');
const assert = require('node:assert/strict');
const { analyzePageBindingDependencies } = require('../lib/contracts/page-binding-dependencies.js');
const binding = (bindingId, parameters = {}, resultStateBindings = []) => ({ bindingId, parameters, resultStateBindings });
const field = (bindingId) => ({ kind: 'binding-field', bindingId, path: 'record.id' });

test('binding dependency graph orders acyclic result-to-query dependencies', () => {
  const result = analyzePageBindingDependencies([binding('c', { id: field('b') }), binding('b', { id: field('a') }), binding('a')]);
  assert.deepEqual(result.order, ['a', 'b', 'c']);
  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.dependencies.b, ['a']);
});
test('missing dependencies, duplicate identities and direct or indirect cycles are rejected', () => {
  for (const bindings of [
    [binding('a', { id: field('missing') })],
    [binding('a'), binding('a')],
    [binding('a', { id: field('a') })],
    [binding('a', { id: field('b') }), binding('b', { id: field('a') })],
  ]) assert.ok(analyzePageBindingDependencies(bindings).errors.length);
});
test('query result state bridges share the same cycle validation', () => {
  const source = binding('a', {}, [{ targetStateId: 'selected' }]);
  const target = binding('b', { id: { kind: 'page-state', stateId: 'selected' } });
  assert.deepEqual(analyzePageBindingDependencies([target, source]).order, ['a', 'b']);
  source.parameters.id = field('b');
  assert.ok(analyzePageBindingDependencies([source, target]).errors.length);
});
