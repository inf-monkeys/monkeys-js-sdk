const assert = require('node:assert/strict');
const test = require('node:test');
const { encodeRuntimeDefinition, expandRuntimeDefinition, runtimeDefinitionEtag } = require('../lib/runtime/runtime-definition-wire');

const reference = { kind: 'capability', id: 'example', revision: 1, contentHash: 'a'.repeat(64) };
const fixture = () => ({ outcome: 'declarative', resolved: { page: {
  initialQueryPolicy: 'explicit',
  queryBindings: [{ bindingId: 'list', loadTiming: 'page-start' }, { bindingId: 'details', loadTiming: 'component-mount' }],
  capabilityInstances: Array.from({ length: 20 }, (_, id) => ({ id, capabilityRevisionRef: { ...reference }, properties: { definition: 0, capabilityRevisionRef: { ...reference } } })),
  programBindings: [1, 2].map(id => ({ id, definition: { script: 'example', dependencies: [reference] }, programRevisionRef: reference, dependencyInputs: { definition: 0 } })),
  renderTree: { nodes: [1, 2].map(id => ({ id, pageRef: reference, lifecycle: { mountPolicy: 'always' }, renderModel: { definition: 0 } })) },
} } });

test('dictionary round trip preserves every opaque business value and does not mutate inputs', () => {
  const input = fixture(), original = structuredClone(input), wire = encodeRuntimeDefinition(input);
  assert.deepEqual(expandRuntimeDefinition(JSON.parse(JSON.stringify(wire))), input);
  assert.deepEqual(input, original);
  assert.ok(JSON.stringify(wire).length < JSON.stringify(input).length * 0.75);
  assert.deepEqual(wire.payload.resolved.page.capabilityInstances[0].properties, input.resolved.page.capabilityInstances[0].properties);
});
test('rejects invalid references, unused entries and unsupported protocol versions', () => {
  for (const index of [-1, 9999, 0.5, '0', null]) {
    const wire = encodeRuntimeDefinition(fixture());
    wire.payload.resolved.page.programBindings[0].definition = index;
    assert.throws(() => expandRuntimeDefinition(wire));
  }
  const unused = encodeRuntimeDefinition(fixture()); unused.values.push({ extra: true });
  assert.throws(() => expandRuntimeDefinition(unused));
  assert.throws(() => expandRuntimeDefinition({ ...unused, schemaVersion: 2 }));
});
test('legacy envelopes pass through and representations use different ETags', () => {
  const input = fixture(); assert.equal(expandRuntimeDefinition(input), input);
  assert.equal(runtimeDefinitionEtag('"v1"'), '"dictionary-v1.v1"');
  assert.throws(() => runtimeDefinitionEtag('bad\nheader'));
});
