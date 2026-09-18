const { test } = require('node:test');
const assert = require('node:assert/strict');
const { evaluatePageExpression, projectPageProperties, compilePageExpression } = require('../lib/runtime/page-expression.js');
const lit = (value) => ({ kind: 'literal', value });
const read = (root, ...path) => ({ kind: 'read', root, path });
const op = (operator, ...arguments_) => ({ kind: 'operator', operator, arguments: arguments_ });

test('declared URL segments preserve Unicode and escape routing delimiters without accepting objects or malformed strings', () => {
  assert.equal(evaluatePageExpression(op('encode-uri-component', lit('团队/a?b#c')), {}), '%E5%9B%A2%E9%98%9F%2Fa%3Fb%23c');
  assert.throws(() => evaluatePageExpression(op('encode-uri-component', lit({ path: 'x' })), {}), /TYPE_STRING/);
  assert.throws(() => evaluatePageExpression(op('encode-uri-component', lit('\ud800')), {}), /INVALID_UNICODE/);
  assert.throws(() => compilePageExpression(op('encode-uri-component', lit('a'), lit('b'))), /ARITY/);
});

test('declarative preview arithmetic has explicit null and type semantics', () => {
  const expression = op('multiply', read('state', 'amount'), read('model', 'rate'));
  assert.equal(evaluatePageExpression(expression, { state: { amount: 12 }, model: { rate: 0.5 } }), 6);
  assert.equal(evaluatePageExpression(op('divide', lit(1), lit(0)), {}), null);
  assert.equal(evaluatePageExpression(op('coalesce', read('state', 'missing'), lit(0)), {}), 0);
  assert.throws(() => evaluatePageExpression(expression, { state: { amount: '12' }, model: { rate: 1 } }), /TYPE/);
});

test('collection filtering and object mapping replace hidden-field payload builders', () => {
  const expression = { kind: 'map', source: { kind: 'filter', source: read('model', 'fields'), value: op('not', read('scope', 'item', 'disabled')) }, value: { kind: 'object', fields: { id: read('scope', 'item', 'id'), value: read('scope', 'item', 'value') } } };
  const model = { fields: [{ id: 'a', value: 3, disabled: false }, { id: 'b', value: 8, disabled: true }] };
  assert.deepEqual(evaluatePageExpression(expression, { model }), [{ id: 'a', value: 3 }]);
  assert.deepEqual(model.fields.length, 2);
});

test('nested property writes preserve sibling assembly props and reject overlapping owners', () => {
  const base = { contract: 'ComponentAssembly', props: { disabled: false, title: 'keep', input: { value: '' } } };
  const bindings = [{ targetPath: ['props', 'input', 'value'], expression: read('state', 'draft', 'name'), valueType: 'string' }];
  const result = projectPageProperties(base, bindings, { state: { draft: { name: 'new' } } });
  assert.deepEqual(result.props, { disabled: false, title: 'keep', input: { value: 'new' } });
  assert.equal(base.props.input.value, '');
  assert.throws(() => projectPageProperties(base, [...bindings, { targetPath: ['props'], expression: lit({}) }], {}), /OVERLAP/);
});

test('missing values are null; conditionals and coalesce evaluate only the chosen branch', () => {
  const bad = op('add', lit('bad'), lit(1));
  assert.equal(evaluatePageExpression({ kind: 'conditional', condition: lit(true), then: lit('ok'), else: bad }, {}), 'ok');
  assert.equal(evaluatePageExpression(op('coalesce', lit(false), bad), {}), false);
  assert.equal(evaluatePageExpression(read('model', 'none'), {}), null);
  assert.equal(evaluatePageExpression(read('model', 'rows', '0', 'id'), { model: { rows: [{ id: 'x' }] } }), 'x');
});

test('forbidden access, expression size, depth, collection and operation budgets fail closed', () => {
  for (const key of ['__proto__', 'constructor', 'prototype']) assert.throws(() => compilePageExpression(read('model', key)));
  assert.throws(() => compilePageExpression({ kind: 'script', source: 'fetch(1)' }));
  let deep = lit(1); for (let i = 0; i < 40; i++) deep = op('coalesce', deep, lit(0));
  assert.throws(() => compilePageExpression(deep), /BUDGET/);
  assert.throws(() => evaluatePageExpression({ kind: 'map', source: read('model', 'rows'), value: read('scope', 'item') }, { model: { rows: Array(1001).fill(1) } }), /BUDGET/);
  assert.throws(() => evaluatePageExpression(op('add', lit(Number.MAX_VALUE), lit(Number.MAX_VALUE)), {}), /NUMBER/);
  assert.throws(() => projectPageProperties({}, [{ targetPath: ['props', '__proto__'], expression: lit({ polluted: true }) }], {}));
  assert.equal({}.polluted, undefined);
});

test('Page validation rejects unknown state references, event-only roots and duplicate property ownership', () => {
  const { ResolvedPageSchema } = require('../lib/contracts/declarative-control.js');
  const { page } = require('./declarative-control-fixtures.cjs');
  for (const expression of [read('state', 'unknown'), read('intent', 'value'), read('result', 'secret')]) {
    const input = structuredClone(page);
    input.capabilityInstances[0].propertyBindings = [{ targetPath: ['props', 'value'], expression }];
    assert.equal(ResolvedPageSchema.safeParse(input).success, false);
  }
  const input = structuredClone(page);
  input.capabilityInstances[0].propertyBindings = [
    { targetPath: ['props'], expression: lit({}) },
    { targetPath: ['props', 'value'], expression: lit('x') },
  ];
  assert.equal(ResolvedPageSchema.safeParse(input).success, false);
});

test('direct expression schema parsing rejects cyclic and oversized AST inputs', () => {
  const { PageExpressionSchema } = require('../lib/contracts/page-expression.js');
  const cyclic = { kind: 'array', items: [] }; cyclic.items.push(cyclic);
  assert.equal(PageExpressionSchema.safeParse(cyclic).success, false);
});

test('nested draft updates and keyed collection edits preserve unrelated values', () => {
  const original = { environment: { skills: [{ id: 'a', enabled: true }, { id: 'b', enabled: false }], label: 'keep' } };
  const expression = op('set-path', read('state', 'draft'), lit(['environment', 'skills']), { kind: 'map', source: read('state', 'draft', 'environment', 'skills'), value: { kind: 'conditional', condition: op('equals', read('scope', 'item', 'id'), read('intent', 'id')), then: op('merge', read('scope', 'item'), { kind: 'object', fields: { enabled: read('intent', 'enabled') } }), else: read('scope', 'item') } });
  const next = evaluatePageExpression(expression, { state: { draft: original }, intent: { id: 'b', enabled: true } });
  assert.deepEqual(next.environment.skills, [{ id: 'a', enabled: true }, { id: 'b', enabled: true }]);
  assert.equal(next.environment.label, 'keep');
  assert.equal(original.environment.skills[1].enabled, false);
  assert.throws(() => evaluatePageExpression(op('set-path', lit({}), lit(['__proto__', 'polluted']), lit(true)), {}));
  assert.throws(() => evaluatePageExpression(op('set-path', lit({ rows: [1] }), lit(['rows', '4']), lit(true)), {}));
});

test('entry projection and fixed decimal preview have deterministic typed results', () => {
  const source = lit({ amount: 4, hidden: 8 });
  const expression = op('from-entries', { kind: 'filter', source: op('entries', source), value: op('not-equals', read('scope', 'item', '0'), lit('hidden')) });
  assert.deepEqual(evaluatePageExpression(expression, {}), { amount: 4 });
  assert.equal(evaluatePageExpression(op('fixed', lit(2.5), lit(2)), {}), '2.50');
  assert.throws(() => evaluatePageExpression(op('from-entries', lit([['a', 1], ['a', 2]])), {}), /DUPLICATE/);
});

test('Action expression context is constrained by the Page and result interactions pin evidence', () => {
  const { ResolvedPageSchema } = require('../lib/contracts/declarative-control.js');
  const { page } = require('./declarative-control-fixtures.cjs');
  const input = structuredClone(page);
  input.actionBindings[0].inputMapping = { value: { kind: 'expression', expression: read('intent', 'value') } };
  assert.equal(ResolvedPageSchema.safeParse(input).success, true);
  input.actionBindings[0].inputMapping.value.expression = read('model', 'secret');
  assert.equal(ResolvedPageSchema.safeParse(input).success, false);
  input.actionBindings[0].inputMapping.value.expression = read('state', 'missing');
  assert.equal(ResolvedPageSchema.safeParse(input).success, false);
});

test('number formatting uses explicit locales, precision and grouping', () => {
  const format = (value, locale = 'en-US', min = 2, max = 2, grouping = true) => op('number-format', ...[value, locale, min, max, grouping].map(lit));
  assert.equal(evaluatePageExpression(format(12345.678), {}), '12,345.68');
  assert.equal(evaluatePageExpression(format(-12.5, 'zh-CN'), {}), '-12.50');
  assert.equal(evaluatePageExpression(format(12345, 'en-US', 0, 0, false), {}), '12345');
  for (const expression of [format(null), format('12'), format(12, 'unknown'), format(12, 'en-US', 3, 2), format(12, 'en-US', 0, 20), op('number-format', lit(12))]) assert.throws(() => evaluatePageExpression(expression, {}));
});
