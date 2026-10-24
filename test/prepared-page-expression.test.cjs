const { test } = require('node:test');
const assert = require('node:assert/strict');
const { preparePageExpression, evaluatePageExpression } = require('../lib/runtime/page-expression.js');
const { PageExpressionSchema } = require('../lib/contracts/page-expression.js');
const read = (root, ...path) => ({ kind: 'read', root, path });
const lit = value => ({ kind: 'literal', value });
const op = (operator, ...args) => ({ kind: 'operator', operator, arguments: args });

test('prepared nested collections read current item, index, parent and state across updates', () => {
  const expression = { kind: 'map', source: read('state', 'rows'), value: {
    kind: 'object', fields: { id: read('scope', 'item', 'id'), index: read('scope', 'index'),
      parent: read('scope', 'parent', 'item', 'name') },
  } };
  const prepared = preparePageExpression(expression);
  for (const rows of [[{ id: 'a' }, { id: 'b' }], [{ id: 'b' }], [{ id: 'c' }, { id: 'b' }], []]) {
    for (const name of ['first', 'changed']) {
      const context = { state: { rows }, scope: { item: { name } } };
      assert.deepEqual(prepared(context), evaluatePageExpression(expression, context));
    }
  }
});

test('preparation parses once and isolates declaration and mutable literal outputs', () => {
  const parse = PageExpressionSchema.parse;
  let calls = 0;
  PageExpressionSchema.parse = function (...args) { calls++; return parse.apply(this, args); };
  try {
    const expression = lit({ items: [{ id: 'original' }] });
    const prepared = preparePageExpression(expression);
    expression.value.items[0].id = 'changed';
    prepared({}).items[0].id = 'renderer changed';
    for (let i = 0; i < 10; i++) assert.deepEqual(prepared({}), { items: [{ id: 'original' }] });
    assert.equal(calls, 1);
    assert.equal(evaluatePageExpression(expression, {}).items[0].id, 'changed');
  } finally { PageExpressionSchema.parse = parse; }
});

test('preparation rejects unsafe paths, malformed syntax and invalid arity', () => {
  for (const expression of [read('state', '__proto__'), { kind: 'script' }, op('not', lit(true), lit(false))]) {
    assert.throws(() => preparePageExpression(expression));
  }
});

test('dynamic types, unsafe values, collection and operation budgets remain checked and reset after errors', () => {
  const expression = { kind: 'map', source: read('state', 'rows'), value: op('add', ...Array.from({ length: 25 }, () => read('scope', 'item'))) };
  const prepared = preparePageExpression(expression);
  for (const rows of ['bad', Array(5000).fill(1), Array(1000).fill(1), [JSON.parse('{"__proto__":1}')]]) {
    assert.throws(() => prepared({ state: { rows } }));
    assert.deepEqual(prepared({ state: { rows: [2] } }), [50]);
  }
});
