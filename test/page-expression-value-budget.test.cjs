const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  evaluatePageExpression, preparePageExpression, projectPageProperties, preparePagePropertyProjection,
} = require('../lib/runtime/page-expression.js');
const { PAGE_EXPRESSION_LIMITS, PAGE_EXPRESSION_VALUE_LIMITS, PageExpressionSchema } = require('../lib/contracts/page-expression.js');

const read = (root, ...path) => ({ kind: 'read', root, path });
const literal = value => ({ kind: 'literal', value });
const op = (operator, ...args) => ({ kind: 'operator', operator, arguments: args });
const rows = count => Array.from({ length: count }, (_, index) => ({
  id: `task-${index}`, prompt: 'Task prompt',
  outputs: Array.from({ length: 20 }, (_, output) => ({
    id: `image-${output}`, kind: 'media', mediaKind: 'image',
    src: `https://example.test/${index}/${output}.png`, previewSrc: '',
    text: '', filename: '', previewable: true,
  })),
}));

test('ordinary and prepared expressions preserve full task pages beyond AST node and byte limits', () => {
  const expression = op('coalesce', read('bindings', 'feed', 'rows'), literal([]));
  const prepared = preparePageExpression(expression);
  for (const count of [20, 100, 1000]) {
    const tasks = rows(count);
    if (count === 20) tasks.forEach(task => { task.prompt = 'p'.repeat(30000); });
    for (const evaluate of [context => evaluatePageExpression(expression, context), prepared]) {
      const value = evaluate({ bindings: { feed: { rows: tasks } } });
      assert.equal(value, tasks);
      assert.equal(value.at(-1).outputs.length, 20);
      assert.equal(value[0].prompt, tasks[0].prompt);
    }
  }
});

test('nested output filters and POM projections preserve their complete data', () => {
  const outputs = rows(1)[0].outputs;
  const table = Array.from({ length: 1000 }, (_, i) => ({ id: String(i), name: `Measurement ${i}`, size: '42', unit: 'inch' }));
  outputs.push({ id: 'table', kind: 'table', rows: table });
  const expression = { kind: 'filter', source: read('scope', 'item', 'outputs'), value: op('equals', read('scope', 'item', 'kind'), literal('media')) };
  assert.deepEqual(evaluatePageExpression(expression, { scope: { item: { outputs } } }), outputs.slice(0, 20));
  const bindings = [{ targetPath: ['props', 'data'], expression: read('scope', 'item') }];
  for (const project of [(base, context) => projectPageProperties(base, bindings, context), preparePagePropertyProjection(bindings)]) {
    const value = project({ props: {} }, { scope: { item: { rows: table } } });
    assert.equal(value.props.data.rows, table);
    assert.equal(value.props.data.rows.length, 1000);
  }
});

test('large data cannot be embedded in the expression declaration', () => {
  assert.equal(PAGE_EXPRESSION_LIMITS.nodes, 4096);
  assert.equal(PAGE_EXPRESSION_LIMITS.bytes, 1048576);
  for (const value of [rows(100), 'p'.repeat(PAGE_EXPRESSION_LIMITS.bytes / 2 + 1)]) {
    assert.equal(PageExpressionSchema.safeParse(literal(value)).success, false);
    assert.throws(() => preparePageExpression(literal(value)), /PAGE_EXPRESSION_BUDGET/);
  }
});

test('runtime input and computed results retain independent byte, node, depth and collection bounds', () => {
  assert.ok(PAGE_EXPRESSION_VALUE_LIMITS);
  const expression = read('model', 'value');
  const overBytes = 'p'.repeat(PAGE_EXPRESSION_VALUE_LIMITS.bytes / 2 + 1);
  let deep = null;
  for (let i = 0; i <= PAGE_EXPRESSION_VALUE_LIMITS.depth; i++) deep = { child: deep };
  const wide = Object.fromEntries(Array.from({ length: 1000 }, (_, i) => [String(i), Array(1000).fill(null)]));
  for (const value of [overBytes, deep, Array(1001).fill(null), { rows: Array(1001).fill(null) }, wide]) {
    for (const evaluate of [context => evaluatePageExpression(expression, context), preparePageExpression(expression)]) {
      assert.throws(() => evaluate({ model: { value } }), /PAGE_EXPRESSION_BUDGET/);
    }
  }
  const half = 'p'.repeat(PAGE_EXPRESSION_VALUE_LIMITS.bytes / 4 + 1);
  assert.throws(() => evaluatePageExpression(op('concat', read('model', 'left'), read('model', 'right')), { model: { left: half, right: half } }), /PAGE_EXPRESSION_BUDGET/);
  assert.throws(() => evaluatePageExpression(op('array-concat', read('model', 'left'), read('model', 'right')), { model: { left: Array(600).fill(null), right: Array(600).fill(null) } }), /PAGE_EXPRESSION_BUDGET/);
});

test('cycles, unsafe nested keys and operation exhaustion still fail closed', () => {
  const cyclic = {}; cyclic.self = cyclic;
  const expression = read('model', 'value');
  for (const value of [cyclic, JSON.parse('{"nested":{"__proto__":1}}'), { nested: { constructor: 1 } }]) {
    assert.throws(() => evaluatePageExpression(expression, { model: { value } }), /PAGE_EXPRESSION_(BUDGET|UNSAFE_PATH)/);
  }
  const expensive = { kind: 'map', source: read('model', 'rows'), value: { kind: 'map', source: read('scope', 'item'), value: literal(0) } };
  assert.throws(() => evaluatePageExpression(expensive, { model: { rows: Array.from({ length: 150 }, () => Array(150).fill(0)) } }), /PAGE_EXPRESSION_BUDGET/);
});

test('validation is reused within one evaluation and rechecks mutations on every subsequent call', () => {
  let reads = 0;
  const value = { get label() { reads++; return 'A'; } };
  const expression = op('equals', read('model', 'value'), read('model', 'value'));
  assert.equal(preparePageExpression(expression)({ model: { value } }), true);
  assert.equal(reads, 1);
  const evaluate = preparePageExpression(read('model', 'value'));
  const mutable = { child: 'safe' };
  assert.equal(evaluate({ model: { value: mutable } }), mutable);
  mutable.child = 'p'.repeat(PAGE_EXPRESSION_VALUE_LIMITS.bytes / 2 + 1);
  assert.throws(() => evaluate({ model: { value: mutable } }), /PAGE_EXPRESSION_BUDGET/);
  mutable.child = 'safe';
  assert.equal(evaluate({ model: { value: mutable } }), mutable);
});
