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
