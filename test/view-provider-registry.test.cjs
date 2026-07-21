const assert = require('node:assert/strict');
const test = require('node:test');

const { compileViewProviderRegistry } = require('../lib/runtime');

const capability = (overrides = {}) => ({
  contract: 'CapabilityManifest',
  id: 'studio.capability.enhanced-view.prompt',
  capabilityVersion: '1',
  ownerRepo: 'monkeys-studio',
  kind: 'view',
  displayName: 'Prompt',
  ports: {
    inputs: [{ name: 'renderModel', schemaRef: 'studio.enhanced-view.prompt.render-model', required: true, multiple: false }],
    outputs: [{ name: 'intent', schemaRef: 'studio.enhanced-view.prompt.intent', required: false, multiple: true }],
  },
  runtime: {
    providerBindings: [{
      providerRef: {
        kind: 'view-provider',
        id: 'studio.provider.enhanced-view.prompt',
        version: 1,
        ownerRepo: 'monkeys-studio',
      },
      productContexts: ['studio'],
      priority: 100,
    }],
    loading: 'eager',
    stateOwner: 'host',
    sideEffects: ['storage'],
  },
  placement: {
    surfaces: ['view'],
    slots: ['enhanced-view.layout.component'],
    variants: ['prompt'],
    tokenRefs: ['ThemeTokens'],
  },
  accessibility: {
    keyboardModel: 'multiline-text-control',
    focusModel: 'host-managed',
    labelContract: 'studio.enhanced-component.title',
  },
  observability: {
    eventNamespace: 'studio.enhanced-view.prompt',
    metrics: ['render'],
    evidenceRefs: [],
  },
  ...overrides,
});

const provider = (overrides = {}) => ({
  contract: 'ViewProviderDescriptor',
  providerId: 'studio.provider.enhanced-view.prompt',
  providerVersion: '1',
  ownerRepo: 'monkeys-studio',
  capabilityRef: {
    kind: 'capability',
    id: 'studio.capability.enhanced-view.prompt',
    version: 1,
    ownerRepo: 'monkeys-studio',
  },
  rendererKey: 'studio.enhanced-view.prompt',
  renderModelSchemaRef: 'studio.enhanced-view.prompt.render-model',
  intentSchemaRef: 'studio.enhanced-view.prompt.intent',
  loading: 'eager',
  stateOwner: 'host',
  supportedPageTypes: ['enhanced'],
  supportedSurfaces: ['view'],
  frameOwner: 'host',
  sideEffects: ['storage'],
  sideEffectAdapterRef: {
    kind: 'side-effect-adapter', id: 'studio.enhanced-view.prompt.effects', version: 1, ownerRepo: 'monkeys-studio',
  },
  lifecycle: { preserveMount: true, preserveScroll: true, focusModel: 'host-managed' },
  performance: { lazy: false, virtualized: false, budgetMs: 100 },
  ...overrides,
});

test('compiles a page-independent capability-to-provider registry', () => {
  const registry = compileViewProviderRegistry({
    capabilities: [capability()],
    providers: [provider()],
  });

  assert.equal(
    registry.resolveProvider('studio.capability.enhanced-view.prompt', 'studio').providerId,
    'studio.provider.enhanced-view.prompt',
  );
  assert.equal(
    registry.providersByRendererKey.get('studio.enhanced-view.prompt')[0].capabilityRef.id,
    'studio.capability.enhanced-view.prompt',
  );
});

test('rejects descriptors that only look valid in isolation', () => {
  assert.throws(
    () => compileViewProviderRegistry({
      capabilities: [capability({ kind: 'composite' })],
      providers: [provider()],
    }),
    /view or professional-provider/,
  );
  assert.throws(
    () => compileViewProviderRegistry({
      capabilities: [capability()],
      providers: [provider({ supportedSurfaces: ['workspace'] })],
    }),
    /surfaces must be declared/,
  );
  assert.throws(
    () => compileViewProviderRegistry({
      capabilities: [capability()],
      providers: [],
    }),
    /missing provider/,
  );
});
