'use strict';
const assert = require('node:assert/strict');
const test = require('node:test');
const { parseWorkflowColumnBinding, resolveWorkflowColumnResult } = require('../lib/runtime');
const { WorkflowColumnBindingSchema } = require('../lib/contracts');

const fixture = () => ({
  contract: 'WorkflowColumnBinding',
  version: 1,
  enabled: true,
  workflow: { id: 'fixed-algorithm', version: 3, inputSchemaHash: 'a'.repeat(64) },
  inputs: { value: { kind: 'field', field: { ontologyId: 'source', fieldKey: 'amount' } } },
  output: { type: 'number', path: ['result'], nullable: false },
});

test('binds a pinned workflow directly without a model, prompt or AI Shortcut', () => {
  const binding = parseWorkflowColumnBinding(fixture());
  assert.equal(binding.workflow.version, 3);
  assert.equal(binding.policy.debounceMs, 5000);
  assert.equal(binding.policy.maxDelayMs, 30000);
  assert.equal(binding.paused, false);
  assert.deepEqual(resolveWorkflowColumnResult(binding, { result: 0 }), { value: 0 });
  assert.equal(
    WorkflowColumnBindingSchema.safeParse({ ...fixture(), shortcutId: 'hidden' }).success,
    false,
  );
});

test('validates explicit one-hop dependencies and rejects unrecognized binding forms', () => {
  const config = fixture();
  config.dependencies = [
    {
      kind: 'relation',
      relation: { ontologyId: 'source', fieldKey: 'links' },
      direction: 'incoming',
      fields: [{ ontologyId: 'source', fieldKey: 'amount' }],
    },
  ];
  assert.equal(parseWorkflowColumnBinding(config).dependencies[0].direction, 'incoming');
  config.dependencies[0].direction = 'automatic';
  assert.throws(() => parseWorkflowColumnBinding(config));
  assert.throws(
    () =>
      parseWorkflowColumnBinding({
        ...fixture(),
        policy: { debounceMs: 5000, maxDelayMs: 1000, concurrency: 1 },
      }),
    /maxDelayMs/,
  );
});

test('opts into indexed-source readiness without changing existing bindings', () => {
  assert.equal(parseWorkflowColumnBinding(fixture()).policy.requireSearchProjection, undefined);
  assert.equal(
    parseWorkflowColumnBinding({ ...fixture(), policy: { requireSearchProjection: true } }).policy.requireSearchProjection,
    true,
  );
  assert.throws(() => parseWorkflowColumnBinding({ ...fixture(), policy: { requireSearchProjection: 'true' } }));
});

test('distinguishes missing, null, zero and wrongly typed outputs', () => {
  const binding = parseWorkflowColumnBinding(fixture());
  for (const payload of [
    {},
    { result: undefined },
    { result: null },
    { result: '0' },
    { result: NaN },
    { result: Infinity },
  ]) {
    assert.throws(() => resolveWorkflowColumnResult(binding, payload));
  }
  binding.output.nullable = true;
  assert.deepEqual(resolveWorkflowColumnResult(binding, { result: null }), { value: null });
  assert.throws(() => resolveWorkflowColumnResult(binding, {}), /missing/);
  binding.output.type = 'text';
  assert.deepEqual(resolveWorkflowColumnResult(binding, { result: '' }), { value: '' });
  assert.throws(() => resolveWorkflowColumnResult(binding, { result: 5 }), /text/);
  binding.output.type = 'json';
  assert.deepEqual(resolveWorkflowColumnResult(binding, { result: { rows: [0, null] } }), {
    value: { rows: [0, null] },
  });
  assert.throws(() => resolveWorkflowColumnResult(binding, { result: { amount: NaN } }));
});

test('does not follow prototype properties or evaluate output paths', () => {
  const binding = parseWorkflowColumnBinding(fixture());
  assert.throws(
    () => resolveWorkflowColumnResult(binding, Object.create({ result: 8 })),
    /missing/,
  );
  binding.output.path = ['result.value'];
  assert.throws(() => resolveWorkflowColumnResult(binding, { result: { value: 5 } }), /missing/);
  assert.deepEqual(resolveWorkflowColumnResult(binding, { 'result.value': 5 }), { value: 5 });
});

test('accepts a workflow-provided future expiry without a business schedule', () => {
  const binding = parseWorkflowColumnBinding({ ...fixture(), expiry: { path: ['expiresAt'] } });
  const now = Date.parse('2026-09-09T00:00:00Z');
  assert.deepEqual(
    resolveWorkflowColumnResult(
      binding,
      { result: 5, expiresAt: '2026-10-01T00:00:00+08:00' },
      now,
    ),
    { value: 5, expiresAt: '2026-10-01T00:00:00+08:00' },
  );
  for (const expiresAt of [undefined, 'tomorrow', '2026-10-01T00:00:00', '2026-09-09T00:00:00Z']) {
    assert.throws(() => resolveWorkflowColumnResult(binding, { result: 5, expiresAt }, now));
  }
});
