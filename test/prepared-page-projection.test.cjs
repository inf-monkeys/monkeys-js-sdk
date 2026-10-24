const { test } = require('node:test');
const assert = require('node:assert/strict');
const { preparePagePropertyProjection, projectPageProperties } = require('../lib/runtime/page-expression.js');
const { PagePropertyBindingSchema, assertPageValueBudget, PAGE_EXPRESSION_LIMITS } = require('../lib/contracts/page-expression.js');
const lit = value => ({ kind: 'literal', value });
const read = (root, ...path) => ({ kind: 'read', root, path });
const op = (operator, ...args) => ({ kind: 'operator', operator, arguments: args });

test('prepared rows match legacy projection across input, status, action and scope changes', () => {
  const bindings = [
    { targetPath: ['props', 'title'], expression: read('scope', 'item', 'title'), valueType: 'string' },
    { targetPath: ['props', 'hidden'], expression: op('not', read('state', 'shown')) },
    { targetPath: ['status'], expression: read('queries', 'cards', 'status') },
    { targetPath: ['pending'], expression: read('actions', 'save', 'pending') },
    { targetPath: ['ids'], expression: { kind: 'map', source: read('bindings', 'rows'), value: read('scope', 'item', 'id') } },
  ];
  const prepared = preparePagePropertyProjection(bindings);
  const base = { props: { fixed: true } };
  for (let i = 0; i < 5; i++) {
    const context = { scope: { item: { title: `row${i}` } }, state: { shown: i % 2 === 0 }, queries: { cards: { status: i ? 'ready' : 'pending' } }, actions: { save: { pending: !!i } }, bindings: { rows: [{ id: i }] } };
    assert.deepEqual(prepared(base, context), projectPageProperties(base, bindings, context));
  }
  assert.deepEqual(base, { props: { fixed: true } });
});

test('only preparation parses declarations; dynamic evaluation does not', () => {
  const original = PagePropertyBindingSchema.parse;
  let parses = 0;
  PagePropertyBindingSchema.parse = function (...args) { parses++; return original.apply(this, args); };
  try {
    const prepared = preparePagePropertyProjection([{ targetPath: ['title'], expression: read('scope', 'item') }]);
    for (let i = 0; i < 100; i++) assert.equal(prepared({}, { scope: { item: i } }).title, i);
    assert.equal(parses, 1);
  } finally { PagePropertyBindingSchema.parse = original; }
});

test('snapshot cannot be changed by editing the source declaration or previous output literals', () => {
  const bindings = [{ targetPath: ['data'], expression: lit({ nested: [{ name: 'original' }] }) }];
  const prepared = preparePagePropertyProjection(bindings);
  bindings[0].expression.value.nested[0].name = 'source changed';
  bindings[0].targetPath[0] = 'elsewhere';
  prepared({}, {}).data.nested[0].name = 'renderer changed';
  assert.deepEqual(prepared({}, {}), { data: { nested: [{ name: 'original' }] } });
  assert.deepEqual(projectPageProperties({}, bindings, {}), { elsewhere: { nested: [{ name: 'source changed' }] } });
});

test('malformed declarations, unsafe paths, overlaps and arity fail during preparation', () => {
  for (const bindings of [
    [{ targetPath: ['a'], expression: { kind: 'script' } }],
    [{ targetPath: ['__proto__'], expression: lit(1) }],
    [{ targetPath: ['a'], expression: read('state', 'constructor') }],
    [{ targetPath: ['a'], expression: lit(1) }, { targetPath: ['a', 'b'], expression: lit(2) }],
    [{ targetPath: ['a'], expression: op('not', lit(true), lit(false)) }],
  ]) assert.throws(() => preparePagePropertyProjection(bindings));
});

test('dynamic type, path, unsafe data and size errors remain live after a successful evaluation', () => {
  const prepared = preparePagePropertyProjection([{ targetPath: ['props', 'value'], valueType: 'array', expression: read('state', 'value') }]);
  assert.deepEqual(prepared({}, { state: { value: [1] } }), { props: { value: [1] } });
  assert.throws(() => prepared({}, { state: { value: 'bad' } }), /PAGE_PROPERTY_TYPE/);
  assert.throws(() => prepared({ props: false }, { state: { value: [1] } }), /PAGE_PROPERTY_PATH_TYPE/);
  assert.throws(() => prepared({}, { state: { value: Array(5000).fill(1) } }), /BUDGET/);
  assert.throws(() => prepared({}, { state: { value: [JSON.parse('{"__proto__":1}')] } }), /UNSAFE_PATH/);
  assert.deepEqual(prepared({}, { state: { value: [2] } }), { props: { value: [2] } });
});

test('operation budget is shared by bindings and reset for every evaluation, including after errors', () => {
  const expression = { kind: 'map', source: read('state', 'rows'), value: op('add', ...Array.from({ length: 12 }, () => read('scope', 'item'))) };
  const bindings = ['a', 'b'].map(key => ({ targetPath: [key], expression }));
  const prepared = preparePagePropertyProjection(bindings);
  assert.throws(() => prepared({}, { state: { rows: Array(1000).fill(1) } }), /BUDGET/);
  for (let i = 0; i < 4; i++) assert.deepEqual(prepared({}, { state: { rows: [1] } }), { a: [12], b: [12] });
});

test('legacy API still observes in-place declaration edits and preserves evaluation error precedence', () => {
  const bindings = [{ targetPath: ['a'], expression: lit(1) }];
  assert.equal(projectPageProperties({}, bindings, {}).a, 1);
  bindings[0].expression.value = 2;
  assert.equal(projectPageProperties({}, bindings, {}).a, 2);
  assert.throws(() => projectPageProperties({}, [
    { targetPath: ['a'], expression: op('add', lit('bad'), lit(1)) },
    { targetPath: ['b'], expression: op('not', lit(true), lit(false)) },
  ], {}), /TYPE_NUMBER/);
});

test('empty prepared projection retains identity', () => {
  const base = { unchanged: true };
  assert.equal(preparePagePropertyProjection([])(base, {}), base);
});

test('scalar budget shortcut preserves string bounds and nested value checks', () => {
  for (const value of [null, true, false, 0, 100, '']) assert.doesNotThrow(() => assertPageValueBudget(value));
  const atLimit = 'x'.repeat(PAGE_EXPRESSION_LIMITS.bytes / 2);
  assert.doesNotThrow(() => assertPageValueBudget(atLimit));
  assert.throws(() => assertPageValueBudget(atLimit + 'x'), /BUDGET/);
  assert.throws(() => assertPageValueBudget({ value: atLimit }), /BUDGET/);
  assert.throws(() => assertPageValueBudget(JSON.parse('{"constructor":1}')), /UNSAFE_PATH/);
});
