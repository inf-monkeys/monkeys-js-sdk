const { test } = require('node:test');
const assert = require('node:assert/strict');
const { prepareMaterializedModelProjection: prepare, collectMaterializedModelPages: collect } = require('../lib/runtime/materialized-model');
const { MaterializedModelProjectionSchema: schema } = require('../lib/contracts/materialized-model');
const { evaluatePageExpression } = require('../lib/runtime/page-expression');
const config = () => ({ kind: 'chunks', rowsPath: ['rows'], valuePath: ['cell'], modelPath: ['model'], batchPath: ['batch'], indexPath: ['index'], countPath: ['count'], collections: [{ path: ['series', 'values'], totalPath: ['total'], keyPath: ['id'] }], pagination: { maxPages: 4 } });
const chunk = (index, values = [{ id: index, value: index * 2 }]) => ({ cell: { batch: 'snapshot', index, count: 2, total: 2, model: { title: 'Generic series', series: { values } } } });
const raw = () => ({ rows: [chunk(1), chunk(0)] });

test('merges configured nested arrays in chunk order without changing inputs or sharing output', () => {
  const input = raw(), before = structuredClone(input), project = prepare(config());
  const result = project(input);
  assert.deepEqual(result.series.values.map(item => item.id), [0, 1]);
  result.series.values[0].value = -1;
  assert.deepEqual(input, before);
  assert.equal(project(input).series.values[0].value, 0);
  input.rows[0].cell.model = { series: { values: [{ id: 1, value: 2 }] }, title: 'Generic series' };
  assert.equal(project(input).series.values.length, 2);
});

test('direct JSON transport supports 2416 values without changing expression execution limits', () => {
  const source = { prepared: { rows: Array.from({ length: 2416 }, (_, id) => ({ id, x: id / 2 })) } };
  assert.throws(() => evaluatePageExpression({ kind: 'read', root: 'model', path: ['prepared'] }, { model: source }), /BUDGET/);
  assert.equal(prepare({ kind: 'value', path: ['prepared'] })(source).rows.length, 2416);
  assert.throws(() => prepare({ kind: 'value', path: ['prepared'], budget: { maxItems: 100 } })(source), /BUDGET/);
});

test('rejects incomplete, mixed, duplicate or inconsistent snapshots', () => {
  const cases = [
    [data => data.rows.pop(), /INCOMPLETE/],
    [data => data.rows[0].cell.batch = 'other', /BATCH_MISMATCH/],
    [data => data.rows[0].cell.index = 0, /DUPLICATE_CHUNK/],
    [data => data.rows[0].cell.model.title = 'other', /HEADER_MISMATCH/],
    [data => data.rows[0].cell.total = 3, /COUNT_MISMATCH/],
    [data => data.rows[0].cell.model.series.values[0].id = 0, /DUPLICATE_ITEM/],
  ];
  for (const [mutate, error] of cases) { const input = raw(); mutate(input); assert.throws(() => prepare(config())(input), error); }
  const overlap = config(); overlap.collections.push({ path: ['series'], totalPath: ['total'] });
  assert.throws(() => prepare(overlap), /COLLECTION_OVERLAP/);
});

test('validates author declarations and bounds unsafe or non-JSON data', () => {
  for (const path of [['__proto__'], ['constructor'], ['prototype']]) assert.equal(schema.safeParse({ kind: 'value', path }).success, false);
  assert.equal(schema.safeParse({ kind: 'value', path: [], budget: { maxBytes: 16777217 } }).success, false);
  const project = prepare({ kind: 'value', path: [] });
  for (const value of [{ x: NaN }, { x: undefined }, { x: new Date() }, JSON.parse('{"__proto__":1}')]) assert.throws(() => project(value), /INVALID|UNSAFE_PATH/);
  const cycle = {}; cycle.self = cycle; assert.throws(() => project(cycle), /BUDGET/);
  assert.throws(() => prepare({ kind: 'value', path: [], budget: { maxBytes: 1024 } })({ x: 'x'.repeat(1024) }), /BUDGET/);
});

test('collects bounded cursor pages before projecting, with the same abort signal', async () => {
  const first = { model: { rows: [chunk(0)] }, pageInfo: { hasMore: true, nextCursor: 'next' } };
  const signal = new AbortController().signal;
  const result = await collect({ first, projection: schema.parse(config()), signal, query: async (cursor, supplied) => {
    assert.equal(cursor, 'next'); assert.equal(supplied, signal);
    return { model: { rows: [chunk(1)] }, pageInfo: { hasMore: false } };
  } });
  assert.equal(result.pageInfo.hasMore, false);
  assert.equal(prepare(config())(result.model).series.values.length, 2);
  assert.equal(first.model.rows.length, 1);
});

test('pagination rejects repeated cursors, missing pages, row/page limits and cancellation', async () => {
  const signal = new AbortController().signal;
  const first = { model: { rows: [chunk(0)] }, pageInfo: { hasMore: true, nextCursor: 'next' } };
  await assert.rejects(collect({ first, projection: schema.parse(config()), signal, query: async () => first }), /CURSOR_INVALID/);
  const limited = config(); limited.pagination.maxPages = 1;
  await assert.rejects(collect({ first, projection: schema.parse(limited), signal, query: async () => assert.fail() }), /PAGE_LIMIT/);
  limited.budget = { maxRows: 1 };
  await assert.rejects(collect({ first: { ...first, model: raw() }, projection: schema.parse(limited), signal, query: async () => assert.fail() }), /BUDGET/);
  const controller = new AbortController(); let calls = 0;
  await assert.rejects(collect({ first, projection: schema.parse(config()), signal: controller.signal, query: async () => { calls++; controller.abort(); return first; } }), /abort/i);
  assert.equal(calls, 1);
  await assert.rejects(collect({ first, projection: schema.parse(config()), signal, query: async () => { throw Error('unavailable'); } }), /unavailable/);
});
