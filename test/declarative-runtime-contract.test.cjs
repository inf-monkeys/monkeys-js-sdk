const assert = require('node:assert/strict');
const { test } = require('node:test');
const {
  canonicalContentHash,
  assertViewProviderContract,
  assertDeclarativeCapabilityContract,
  sameSchemaContract,
  acceptsPreviousSchema,
} = require('../lib');

const ref = (kind, id, revision, body) => ({ kind, id, ownerRepo: 'product', visibility: 'global', revision, schemaVersion: 1, contentHash: canonicalContentHash(body) });
const fixture = (revision, runtimeContractVersion) => {
  const capabilityRef = { kind: 'capability', id: 'example.table', ownerRepo: 'product', version: String(revision) };
  const providerRef = { kind: 'view-provider', id: 'example.table.provider', ownerRepo: 'product', version: String(revision) };
  const manifest = { id: capabilityRef.id, ownerRepo: 'product', capabilityVersion: String(revision), runtime: { providerBindings: [{ providerRef, productContexts: ['kernel'], priority: 1 }] } };
  const provider = { providerId: providerRef.id, ownerRepo: 'product', providerVersion: String(revision), capabilityRef, ...(runtimeContractVersion ? { runtimeContractVersion } : {}) };
  const propertySchemaRevisionRef = ref('schema', 'example.props', revision, { type: 'object' });
  return {
    manifest, provider,
    declarativeRegistration: { capabilityRevisionRef: ref('capability', capabilityRef.id, revision, manifest), providerRevisionRef: ref('view-provider', providerRef.id, revision, provider), propertySchemaRevisionRef },
    node: { capabilityRef, providerRef, ...(runtimeContractVersion ? { runtimeContractVersion } : {}) },
  };
};

test('a frozen declaration survives implementation revisions under one public contract', () => {
  const published = fixture(7, 'table/v1');
  const upgraded = fixture(19, 'table/v1');
  assert.doesNotThrow(() => assertViewProviderContract(published.node, upgraded.provider));
  assert.doesNotThrow(() => assertDeclarativeCapabilityContract(upgraded, { ...published.declarativeRegistration, runtimeContractVersion: 'table/v1' }));
  assert.equal(published.node.providerRef.version, '7');
});

test('input schema evolution permits optional additions and rejects narrowed historical inputs', () => {
  const previous = { type: 'object', additionalProperties: false, properties: { name: { type: 'string' } }, required: ['name'] };
  const compatible = { ...previous, properties: { ...previous.properties, description: { type: 'string' } } };
  assert.equal(acceptsPreviousSchema(previous, compatible), true);
  assert.equal(acceptsPreviousSchema(previous, { ...compatible, required: ['name', 'description'] }), false);
  assert.equal(acceptsPreviousSchema({ ...previous, additionalProperties: true }, compatible), false);
  assert.equal(acceptsPreviousSchema({ enum: ['a'] }, { enum: ['a', 'b'] }), true);
  assert.equal(acceptsPreviousSchema({ enum: ['a', 'b'] }, { enum: ['a'] }), false);
});

test('numeric schema bounds accept only provable range expansions', () => {
  const narrow = { type: 'number', minimum: 0.5, maximum: 3 };
  const wide = { type: 'number', minimum: 0.000001, maximum: 64 };
  assert.equal(acceptsPreviousSchema(narrow, wide), true);
  assert.equal(acceptsPreviousSchema(wide, narrow), false);
  assert.equal(acceptsPreviousSchema({ type: 'number', exclusiveMinimum: 0, maximum: 5 }, { type: 'number', minimum: 0, maximum: 5 }), true);
  assert.equal(acceptsPreviousSchema({ type: 'number', minimum: 0, maximum: 5 }, { type: 'number', exclusiveMinimum: 0, maximum: 5 }), false);
  assert.equal(acceptsPreviousSchema({ type: 'number', exclusiveMinimum: 0, maximum: 5 }, { type: 'number', exclusiveMinimum: -1, maximum: 5 }), true);
  assert.equal(acceptsPreviousSchema({ type: 'number', minimum: 0 }, { type: 'number', minimum: 1 }), false);
  assert.equal(acceptsPreviousSchema({ type: 'number', maximum: 0 }, { type: 'number', maximum: -1 }), false);
});

test('auto or integer gallery columns accepts widening without treating overlapping unions as compatible', () => {
  const columns = maximum => ({ oneOf: [{ const: 'auto' }, { type: 'integer', minimum: 1, maximum }] });
  assert.equal(acceptsPreviousSchema(columns(4), columns(5)), true);
  assert.equal(acceptsPreviousSchema(columns(5), columns(4)), false);
  assert.equal(acceptsPreviousSchema({ type: 'string' }, { oneOf: [{ type: 'string' }, { type: 'integer' }] }), true);
  assert.equal(acceptsPreviousSchema({ type: 'number' }, { oneOf: [{ type: 'number' }, { type: 'integer' }] }), false);
  assert.equal(acceptsPreviousSchema({ const: 1 }, { oneOf: [{ const: 1 }, { type: 'number' }] }), false);
  assert.equal(acceptsPreviousSchema({ enum: ['auto', 1] }, { oneOf: [{ enum: ['auto', 1] }, { type: 'integer' }] }), false);
  assert.equal(acceptsPreviousSchema({ type: ['string', 'null'] }, { oneOf: [{ type: ['string', 'null'] }, { type: 'boolean' }] }), true);
  assert.equal(acceptsPreviousSchema({ type: 'string' }, { oneOf: [{ type: 'string' }, {}] }), false);
});

test('contract matching never permits a different provider, owner or public contract', () => {
  const published = fixture(7, 'table/v1');
  const upgraded = fixture(19, 'table/v1');
  for (const change of [{ runtimeContractVersion: 'table/v2' }, { ownerRepo: 'foreign' }, { providerId: 'different' }]) {
    assert.throws(() => assertViewProviderContract(published.node, { ...upgraded.provider, ...change }));
  }
  assert.throws(() => assertViewProviderContract({ ...published.node, runtimeContractVersion: undefined }, upgraded.provider));
});

test('old snapshots can bind only when their complete manifest and provider hashes prove equivalent', () => {
  const published = fixture(7);
  const upgraded = fixture(19, 'table/v1');
  assert.doesNotThrow(() => assertDeclarativeCapabilityContract(upgraded, published.declarativeRegistration));
  assert.throws(() => assertDeclarativeCapabilityContract(upgraded, { ...published.declarativeRegistration, providerRevisionRef: { ...published.declarativeRegistration.providerRevisionRef, contentHash: '0'.repeat(64) } }));
  assert.throws(() => assertDeclarativeCapabilityContract({ ...upgraded, provider: { ...upgraded.provider, stateOwner: 'provider' } }, published.declarativeRegistration));
});

test('identical schema content tolerates catalog renumbering without ignoring scope or schema changes', () => {
  const left = ref('schema', 'example.model', 1, { type: 'object' });
  assert.equal(sameSchemaContract(left, { ...left, revision: 8 }), true);
  for (const change of [{ contentHash: '0'.repeat(64) }, { ownerRepo: 'other' }, { id: 'other' }, { schemaVersion: 2 }, { visibility: 'tenant' }, { kind: 'capability' }]) {
    assert.equal(sameSchemaContract(left, { ...left, ...change }), false);
  }
});

test('compatible output evolution cannot emit values rejected by published consumers', () => {
  const { assertCompatibleCapabilityUpgrade } = require('../lib');
  const entry = fixture(1, 'table/v1');
  const input = { type: 'object', additionalProperties: false, properties: {} };
  const output = { type: 'string', enum: ['selected', 'cleared'] };
  const inputRef = ref('schema', 'example.input', 1, input);
  const outputRef = ref('schema', 'example.output', 1, output);
  entry.declarativeRegistration = {
    ...entry.declarativeRegistration,
    propertySchemaRevisionRef: inputRef,
    inputPorts: [{ name: 'model', schemaRevisionRef: inputRef, required: true, multiple: false }],
    outputPorts: [{ name: 'change', schemaRevisionRef: outputRef, required: false, multiple: false }],
    schemaDocuments: [{ schemaRevisionRef: inputRef, document: input }, { schemaRevisionRef: outputRef, document: output }],
    ontologyRequirements: [], allowedSideEffects: [], actionRequirements: [], allowedSlots: [], supportedSurfaces: ['kernel'], allowedParentCapabilityRefs: [], allowedChildCapabilityRefs: [],
  };
  const replaceOutput = values => {
    const next = structuredClone(entry);
    const document = { ...output, enum: values };
    const reference = ref('schema', 'example.output', 2, document);
    next.declarativeRegistration.outputPorts[0].schemaRevisionRef = reference;
    next.declarativeRegistration.schemaDocuments[1] = { schemaRevisionRef: reference, document };
    return next;
  };
  assert.doesNotThrow(() => assertCompatibleCapabilityUpgrade(entry, replaceOutput(['selected'])));
  assert.throws(() => assertCompatibleCapabilityUpgrade(entry, replaceOutput(['selected', 'cleared', 'unknown'])), /breaks the published runtime contract/);
  const broken = replaceOutput(['selected']);
  broken.declarativeRegistration.schemaDocuments[1].document.enum = ['forged'];
  assert.throws(() => assertCompatibleCapabilityUpgrade(entry, broken), /schema integrity/);
});

test('numeric output ranges may narrow for existing consumers but may not widen', () => {
  const { assertCompatibleCapabilityUpgrade } = require('../lib');
  const entry = fixture(1, 'table/v1');
  const input = { type: 'object', additionalProperties: false, properties: {} };
  const inputRef = ref('schema', 'example.input', 1, input);
  const makeEntry = (minimum, maximum) => {
    const next = structuredClone(entry);
    const output = { type: 'number', minimum, maximum };
    const outputRef = ref('schema', 'example.output', 1, output);
    next.declarativeRegistration = {
      ...next.declarativeRegistration,
      propertySchemaRevisionRef: inputRef,
      inputPorts: [{ name: 'model', schemaRevisionRef: inputRef, required: true, multiple: false }],
      outputPorts: [{ name: 'change', schemaRevisionRef: outputRef, required: false, multiple: false }],
      schemaDocuments: [{ schemaRevisionRef: inputRef, document: input }, { schemaRevisionRef: outputRef, document: output }],
      ontologyRequirements: [], actionRequirements: [], allowedSideEffects: [], allowedSlots: [], supportedSurfaces: ['kernel'], allowedParentCapabilityRefs: [], allowedChildCapabilityRefs: [],
    };
    return next;
  };
  const uat = makeEntry(0.000001, 64);
  const narrowed = makeEntry(0.5, 3);
  assert.doesNotThrow(() => assertCompatibleCapabilityUpgrade(uat, narrowed));
  assert.throws(() => assertCompatibleCapabilityUpgrade(narrowed, uat), /breaks the published runtime contract/);
});

test('array elements accept additive optional fields without admitting breaking changes', () => {
  const { acceptsPreviousSchema } = require('../lib');
  const previous = { type: 'array', maxItems: 20, items: { type: 'object', additionalProperties: false, required: ['id'], properties: { id: { type: 'string' } } } };
  const next = structuredClone(previous);
  next.items.properties.behavior = { enum: ['intent', 'download'] };
  assert.equal(acceptsPreviousSchema(previous, next), true);
  assert.equal(acceptsPreviousSchema(next, previous), false);
  const required = structuredClone(next);
  required.items.required.push('behavior');
  assert.equal(acceptsPreviousSchema(previous, required), false);
  assert.equal(acceptsPreviousSchema({ type: 'array' }, next), false);
  assert.equal(acceptsPreviousSchema(previous, { ...next, maxItems: 10 }), false);
  assert.equal(acceptsPreviousSchema({ type: 'array', items: { enum: ['a', 'b'] } }, { type: 'array', items: { enum: ['a'] } }), false);
  assert.equal(acceptsPreviousSchema({ type: 'array', items: [{ type: 'string' }] }, { type: 'array', items: [{ type: 'number' }] }), false);
  assert.equal(acceptsPreviousSchema({ type: 'array', items: previous }, { type: 'array', items: next }), true);
});

test('a closed legacy input survives a disjoint union extension inside arrays', () => {
  const previous = {
    type: 'object', additionalProperties: false, required: ['hasMore', 'nextCursor'],
    properties: { hasMore: { type: 'boolean' }, nextCursor: { oneOf: [{ type: 'string' }, { type: 'null' }] } },
    allOf: [{ if: { properties: { hasMore: { const: false } } }, then: { properties: { nextCursor: { type: 'null' } } } }],
  };
  const append = { ...previous, properties: { ...previous.properties, mode: { const: 'append' }, total: { type: 'integer' } } };
  const window = { type: 'object', additionalProperties: false, required: ['mode', 'page'], properties: { mode: { const: 'window' }, page: { type: 'integer' } } };
  const next = { oneOf: [window, append] };
  assert.equal(acceptsPreviousSchema(previous, next), true);
  assert.equal(acceptsPreviousSchema(next, previous), false);
  assert.equal(acceptsPreviousSchema({ type: 'array', items: previous }, { type: 'array', items: next }), true);
  const narrowed = structuredClone(next);
  narrowed.oneOf[1].required.push('mode');
  assert.equal(acceptsPreviousSchema(previous, narrowed), false);
  assert.equal(acceptsPreviousSchema(previous, { ...next, not: previous }), false);
});

test('oneOf inclusion rejects overlapping or unproven branches while anyOf permits overlap', () => {
  const previous = { type: 'object', additionalProperties: false, properties: { id: { type: 'string' } } };
  assert.equal(acceptsPreviousSchema(previous, { oneOf: [previous, previous] }), false);
  assert.equal(acceptsPreviousSchema(previous, { anyOf: [previous, previous] }), true);
  const optionalTag = { type: 'object', properties: { mode: { const: 'new' } } };
  assert.equal(acceptsPreviousSchema(previous, { oneOf: [previous, optionalTag] }), false);
  const requiredTag = { ...optionalTag, required: ['mode'] };
  assert.equal(acceptsPreviousSchema(previous, { oneOf: [previous, requiredTag] }), true);
  for (const open of [{ ...previous, additionalProperties: true }, { ...previous, patternProperties: { '^mode$': {} } }]) {
    assert.equal(acceptsPreviousSchema(open, { oneOf: [open, requiredTag] }), false);
  }
  const referenced = { ...requiredTag, $ref: '#/definitions/unknown' };
  assert.equal(acceptsPreviousSchema(previous, { oneOf: [previous, referenced] }), false);
});

test('required discriminator values prove union exclusion but optional values do not', () => {
  const legacy = { type: 'object', required: ['mode'], properties: { mode: { const: 'legacy' } } };
  const modern = { type: 'object', required: ['mode'], properties: { mode: { enum: ['modern', 'window'] } } };
  assert.equal(acceptsPreviousSchema(legacy, { oneOf: [legacy, modern] }), true);
  const optionalLegacy = { ...legacy, required: [] }, optionalModern = { ...modern, required: [] };
  assert.equal(acceptsPreviousSchema(optionalLegacy, { oneOf: [optionalLegacy, optionalModern] }), false);
  assert.equal(acceptsPreviousSchema({ oneOf: [legacy, modern] }, { anyOf: [legacy, modern] }), true);
});

test('optional ports extend a contract without changing published ports or permissions', () => {
  const { assertCompatibleCapabilityUpgrade } = require('../lib');
  const entry = fixture(1, 'table/v1');
  const model = { type: 'object' };
  const schemaRef = ref('schema', 'example.model', 1, model);
  const port = { name: 'model', schemaRevisionRef: schemaRef, required: true, multiple: false };
  entry.manifest.ports = { inputs: [{ name: 'model', schemaRef: 'example.model', required: true, multiple: false }], outputs: [] };
  entry.declarativeRegistration = { ...entry.declarativeRegistration, propertySchemaRevisionRef: schemaRef,
    inputPorts: [port], outputPorts: [], schemaDocuments: [{ schemaRevisionRef: schemaRef, document: model }],
    ontologyRequirements: [], actionRequirements: [], allowedSideEffects: [], allowedSlots: [], supportedSurfaces: ['kernel'], allowedParentCapabilityRefs: [], allowedChildCapabilityRefs: [],
  };
  for (const direction of ['inputPorts', 'outputPorts']) {
    const next = structuredClone(entry);
    const manifestDirection = direction === 'inputPorts' ? 'inputs' : 'outputs';
    next.declarativeRegistration[direction].push({ ...port, name: 'optional', required: false });
    next.manifest.ports[manifestDirection].push({ name: 'optional', schemaRef: 'example.model', required: false, multiple: false });
    if (direction === 'outputPorts') next.declarativeRegistration.actionRequirements.push({ outputPort: 'optional', allowedCommandKinds: ['domain-command'], requiredPermissionCodes: ['new-action'] });
    assert.doesNotThrow(() => assertCompatibleCapabilityUpgrade(entry, next));
    next.declarativeRegistration[direction].at(-1).required = true;
    assert.throws(() => assertCompatibleCapabilityUpgrade(entry, next), /must be optional/);
  }
  const removed = structuredClone(entry);
  removed.declarativeRegistration.inputPorts = [];
  assert.throws(() => assertCompatibleCapabilityUpgrade(entry, removed), /cardinality/);
  const widened = structuredClone(entry);
  widened.manifest.ports.inputs[0].multiple = true;
  assert.throws(() => assertCompatibleCapabilityUpgrade(entry, widened), /semantics changed/);
});

test('optional composition slots extend a contract while preserving existing slots and placement', () => {
  const { assertCompatibleCapabilityUpgrade } = require('../lib');
  const entry = fixture(1, 'table/v1');
  const model = { type: 'object' };
  const schemaRef = ref('schema', 'example.model', 1, model);
  entry.manifest.placement = { slots: ['media'], surfaces: ['studio'], variants: [], tokenRefs: [] };
  entry.manifest.accessibility = { keyboardModel: 'native', focusModel: 'native', labelContract: 'host' };
  entry.declarativeRegistration = { ...entry.declarativeRegistration, propertySchemaRevisionRef: schemaRef,
    inputPorts: [], outputPorts: [], schemaDocuments: [{ schemaRevisionRef: schemaRef, document: model }],
    ontologyRequirements: [], actionRequirements: [], allowedSideEffects: [], allowedSlots: ['media'], supportedSurfaces: ['studio'], allowedParentCapabilityRefs: [], allowedChildCapabilityRefs: [],
  };
  const next = structuredClone(entry);
  next.manifest.placement.slots = ['children', 'media'];
  next.declarativeRegistration.allowedSlots = ['children', 'media'];
  assert.doesNotThrow(() => assertCompatibleCapabilityUpgrade(entry, next));
  for (const remove of [e => e.manifest.placement.slots.splice(1), e => e.declarativeRegistration.allowedSlots.splice(1)]) {
    const broken = structuredClone(next);
    remove(broken);
    assert.throws(() => assertCompatibleCapabilityUpgrade(entry, broken), /slots cannot be removed/);
  }
  for (const mutate of [
    e => e.manifest.placement.surfaces.push('kernel'),
    e => e.manifest.placement.variants.push('new'),
    e => e.manifest.accessibility.focusModel = 'trapped',
    e => e.declarativeRegistration.allowedSideEffects.push('network'),
  ]) {
    const broken = structuredClone(next);
    mutate(broken);
    assert.throws(() => assertCompatibleCapabilityUpgrade(entry, broken));
  }
});
