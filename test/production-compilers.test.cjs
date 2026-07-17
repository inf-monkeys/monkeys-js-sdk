'use strict';

const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const test = require('node:test');
const runtime = require('../lib/runtime');
const schemas = require('../lib/schemas');

const ref = (kind, id, version) => ({ kind, id, ...(version === undefined ? {} : { version }) });
const color = (hex, components) => ({ colorSpace: 'srgb', components, hex });

const manifest = {
  contract: 'CapabilityManifest',
  id: 'image.generate',
  capabilityVersion: '1.0.0',
  ownerRepo: 'monkey-tools-agentkits',
  kind: 'tool',
  displayName: 'Generate image',
  ports: { inputs: [], outputs: [] },
  runtime: { providerRef: ref('tool', 'image.generate'), loading: 'lazy', stateOwner: 'provider', sideEffects: ['network'] },
  placement: { surfaces: ['workflow'], slots: [], variants: [], tokenRefs: [] },
  accessibility: { keyboardModel: 'form', focusModel: 'managed', labelContract: 'visible-label' },
  observability: { eventNamespace: 'capability.image', metrics: [], evidenceRefs: [] },
};

const pageCapability = {
  contract: 'CapabilityManifest',
  id: 'studio.application-shell',
  capabilityVersion: '1.0.0',
  ownerRepo: 'monkeys-studio',
  kind: 'view',
  displayName: 'Studio application shell',
  ports: { inputs: [], outputs: [] },
  runtime: {
    providerRef: { kind: 'view-provider', id: 'application-shell-provider', version: '1.0.0', ownerRepo: 'monkeys-studio' },
    loading: 'lazy', stateOwner: 'host', sideEffects: ['navigation'],
  },
  placement: { surfaces: ['workspace'], slots: [], variants: [], tokenRefs: [] },
  accessibility: { keyboardModel: 'application', focusModel: 'host-managed', labelContract: 'page-title' },
  observability: { eventNamespace: 'studio.page', metrics: [], evidenceRefs: [] },
};

const representativeProductConfig = JSON.parse(readFileSync(
  resolve(__dirname, 'fixtures/tenant-product-config.public.json'),
  'utf8',
));
const applicationConfig = representativeProductConfig.applicationConfig;

test('compiles desired tenant config into a resolved, source-free browser contract', () => {
  const productConfig = schemas.TenantProductConfigSchema.parse({
    ...representativeProductConfig,
    authBinding: {
      primary: { kind: 'auth-provider', providerId: 'oidc', policyRef: 'tenant-login' },
    },
    dataBinding: {
      assets: { kind: 'data-provider', providerId: 'monkey-data', domainRef: 'assets' },
      analytics: { kind: 'projection', projectionRef: 'usage-summary' },
    },
  });
  const runtimeConfig = runtime.compileTenantRuntimeConfig({
    productConfig,
    resolvedDesignTokens: {
      palette: { primary: { $type: 'color', $value: color('#336699', [0.2, 0.4, 0.6]) } },
      semantic: { accent: { $type: 'color', $value: '{palette.primary}' } },
    },
  });

  assert.equal(runtimeConfig.contract, 'TenantRuntimeConfig');
  assert.deepEqual(runtimeConfig.designTokens.semantic.accent.$value, color('#336699', [0.2, 0.4, 0.6]));
  assert.equal(JSON.stringify(runtimeConfig).includes('tokenSources'), false);
  assert.equal(runtimeConfig.applicationConfig.theme.headbar.theme, 'glassy');
  assert.equal(runtimeConfig.authBinding.primary.providerId, 'oidc');
  assert.equal(runtimeConfig.dataBinding.analytics.projectionRef, 'usage-summary');
  assert.throws(() => schemas.TenantRuntimeConfigSchema.parse({
    ...runtimeConfig,
    designTokens: { semantic: { accent: { $type: 'color', $value: '{palette.primary}' } } },
  }), /invalid|Unknown token|aliases/i);
  assert.throws(() => schemas.TenantRuntimeConfigSchema.parse({
    ...runtimeConfig,
    designTokens: { alias: { $ref: '#/palette/primary' } },
  }), /invalid|\$ref|Pointer/i);
  assert.throws(() => schemas.TenantApplicationConfigSchema.parse({ ...applicationConfig, undeclared: true }));
  assert.throws(() => schemas.TenantProductConfigSchema.parse({
    ...productConfig,
    authBinding: {
      primary: { kind: 'auth-provider', providerId: 'oidc', token: 'must-not-reach-the-browser' },
    },
  }), /unrecognized|unsupported/i);
  assert.throws(() => schemas.TenantProductConfigSchema.parse({
    ...productConfig,
    dataBinding: {
      assets: { kind: 'data-provider', providerId: 'monkey-data', connectionString: 'postgres://private' },
    },
  }), /unrecognized|unsupported/i);
  assert.doesNotThrow(() => schemas.TenantApplicationConfigSchema.parse({
    ...applicationConfig,
    theme: {
      ...applicationConfig.theme,
      modules: {
        ...applicationConfig.theme.modules,
        monkeysSpaceHeadbar: '*',
      },
    },
  }));
});

test('requires canonical PageDefinition envelopes for tenant workbench pages', () => {
  const definition = {
    contract: 'PageDefinition',
    pageId: 'tenant-tool',
    ownerRepo: 'monkeys-server',
    title: { 'zh-CN': '租户工具', 'en-US': 'Tenant Tool' },
    pageType: 'iframe',
    ownership: { builtIn: true },
    record: { deleted: false },
    surface: 'view',
    routeId: 'studio.workbench.tenant-tool',
    routePath: '/:teamId/workbench?activePage=tenant-tool',
    rendererKey: 'studio.workflow-page.iframe',
    capabilityRef: {
      kind: 'capability',
      id: 'studio.capability.workflow-page.iframe',
      version: 1,
      ownerRepo: 'monkeys-studio',
    },
    capabilityRefs: [],
    binding: { sourceRef: 'tenant-tool', stateRef: 'studio.workbench.tenant-tool' },
    access: { actions: ['read'] },
    rendererConfig: { schemaRef: 'workflow-page.iframe', value: {} },
    navigation: { label: 'Tenant Tool', hidden: false, pinned: true },
    visibility: {
      authenticated: true,
      permissionAllOf: [],
      permissionAnyOf: [],
      featureFlags: [],
      productContexts: ['studio'],
    },
  };
  const canonicalPage = {
    definition,
    context: {
      iframeUrl: 'https://tools.example.test',
      info: { displayName: 'Tenant Tool', iconUrl: 'lucide:bot' },
    },
  };

  assert.equal(schemas.TenantWorkbenchPageEnvelopeSchema.parse(canonicalPage).definition.pageId, 'tenant-tool');
  assert.doesNotThrow(() => schemas.TenantApplicationConfigSchema.parse({
    ...applicationConfig,
    theme: {
      ...applicationConfig.theme,
      workbench: {
        pages: [canonicalPage],
        pageGroups: [{
          id: 'tenant-tools',
          pageIds: ['tenant-tool'],
          displayName: 'Tenant tools',
          isBuiltIn: true,
        }],
      },
    },
  }));
  assert.throws(() => schemas.TenantApplicationConfigSchema.parse({
    ...applicationConfig,
    theme: {
      ...applicationConfig.theme,
      workbench: {
        pages: [{ id: 'tenant-tool', type: 'iframe' }],
        pageGroups: [],
      },
    },
  }), /definition|unrecognized|invalid/i);
  assert.throws(() => schemas.TenantApplicationConfigSchema.parse({
    ...applicationConfig,
    theme: {
      ...applicationConfig.theme,
      workbench: {
        pages: [canonicalPage],
        pageGroups: [{
          id: 'tenant-tools',
          pageIds: ['undeclared-page'],
          displayName: 'Tenant tools',
          isBuiltIn: true,
        }],
      },
    },
  }), /undeclared page/i);
});

test('compiles multiple capability sources into one conflict-free registry', () => {
  const openapi = { paths: { '/image': { post: {
    'x-monkey-tool-name': 'image.generate',
    'x-monkeys-capability-manifest': manifest,
  } } } };
  const registry = runtime.compileCapabilityRegistry([
    runtime.createCapabilityRegistrySource('tool-manifest', 'agentkits', manifest.ownerRepo, [manifest]),
    runtime.createOpenApiCapabilityRegistrySource('agentkits-openapi', manifest.ownerRepo, openapi),
  ]);
  assert.equal(registry.manifests.length, 1);
  assert.equal(registry.sourcesByCapabilityId.get(manifest.id).length, 2);
  assert.equal(registry.require(ref('capability', manifest.id, '1.0.0')).id, manifest.id);
  assert.throws(() => registry.require(ref('capability', manifest.id, '2.0.0')), /not active/);
  assert.throws(() => runtime.compileCapabilityRegistry([
    runtime.createCapabilityRegistrySource('tool-manifest', 'one', manifest.ownerRepo, [manifest]),
    runtime.createCapabilityRegistrySource('plugin-manifest', 'two', manifest.ownerRepo, [{ ...manifest, displayName: 'Conflicting' }]),
  ]), /Conflicting capability/);
  assert.throws(() => runtime.extractOpenApiCapabilityManifests({
    paths: { '/broken': { post: { 'x-monkey-tool-name': 'broken' } } },
  }), /without x-monkeys-capability-manifest/);
});

test('round-trips production workflow tasks, parameters and outputs without deriving nested control flow from edges', () => {
  const nestedTask = {
    name: 'image.generate', taskReferenceName: 'nested-image', type: 'GENERATE_IMAGE', inputParameters: { prompt: '${workflow.input.Prompt}' },
    callbackFromWorker: true,
  };
  const task = {
    name: 'system.switch', taskReferenceName: 'route', type: 'SWITCH', inputParameters: { value: '${workflow.input.Mode}' },
    decisionCases: { image: [nestedTask] }, defaultCase: [], evaluatorType: 'value-param', expression: '${workflow.input.Mode}',
    permissive: false,
  };
  const variables = [{
    displayName: { 'en-US': 'Prompt', 'zh-CN': '提示词' }, name: 'Prompt', type: 'string', required: true,
    typeOptions: { editor: 'code', multipleValues: false, designAnalysisFieldPrefix: 'analysis.' },
  }];
  const output = [{ key: 'image', value: '${route.output.image}' }];
  const conductor = {
    name: 'workflow-1', description: 'Production workflow', version: 3, tasks: [task],
    inputParameters: ['Prompt'], outputParameters: { image: '${route.output.image}' },
    timeoutPolicy: 'TIME_OUT_WF', timeoutSeconds: 60,
  };
  const definition = runtime.compileWorkflowDefinitionFromConductor({
    metadata: { id: 'workflow-1', version: 3, name: { 'en-US': 'Production workflow' }, description: 'Production workflow', role: 'workflow', teamId: 'team-1', creatorRef: ref('user', 'user-1'), tags: [] },
    revision: { kind: 'release', recordVersion: 3 }, presentation: { iconUrl: 'https://assets.example.test/workflow.svg' },
    conductor, variables, output,
    execution: { retries: 0, idempotency: 'required', rateLimit: { enabled: false, max: 0, windowMs: 0 } },
    triggers: [{ id: 'manual', type: 'manual', enabled: true }], views: [], dataContracts: { reads: [], writes: [], emits: [] },
    governance: { activated: true, validated: true, validationIssues: [] },
    interfaces: { openai: { enabled: true, modelName: 'workflow-1' }, preferredAppId: 'studio' },
  });

  assert.deepEqual(runtime.compileConductorWorkflowDefinition(definition), conductor);
  assert.deepEqual(runtime.compileWorkflowPersistenceProjection(definition), { tasks: [task], variables, output });
  assert.equal(definition.graph.nodes[0].configuration.task.decisionCases.image[0].type, 'GENERATE_IMAGE');
  assert.throws(() => schemas.WorkflowDefinitionSchema.parse({
    ...definition,
    execution: { ...definition.execution, rateLimit: { enabled: true, max: 0, windowMs: 0 } },
  }), /positive/);
  assert.throws(() => schemas.ConductorTaskDefinitionSchema.parse({ ...task, unknownTaskField: true }));
});

const page = (overrides = {}) => ({
  contract: 'PageDefinition', pageId: 'workflow-page', ownerRepo: 'monkeys-studio', title: { 'en-US': 'Workflows' }, pageType: 'process',
  ownership: { teamId: 'team-1', builtIn: false }, record: { deleted: false }, surface: 'workspace', routeId: 'workflow', routePath: '/$teamId/workflows/:workflowId', rendererKey: 'workflow-workspace',
  capabilityRef: { ...ref('capability', pageCapability.id, pageCapability.capabilityVersion), ownerRepo: pageCapability.ownerRepo }, capabilityRefs: [], workflowRef: ref('workflow', 'workflow-1'),
  binding: {}, access: { actions: ['read', 'execute'] }, rendererConfig: { schemaRef: 'schema://workflow-workspace', value: { view: 'editor' } },
  navigation: { label: { 'en-US': 'Workflows' }, order: 10, hidden: false, pinned: true },
  visibility: { authenticated: true, permissionAllOf: ['workflow.read'], permissionAnyOf: [], featureFlags: ['workflow-ui'], productContexts: ['studio'] },
  ...overrides,
});

test('generates route, navigation, guard and renderer projections from PageDefinition', () => {
  const provider = {
    contract: 'ViewProviderDescriptor', providerId: 'application-shell-provider', ownerRepo: 'monkeys-studio',
    capabilityRef: { ...ref('capability', pageCapability.id, pageCapability.capabilityVersion), ownerRepo: pageCapability.ownerRepo }, rendererKey: 'workflow-workspace', loading: 'lazy', stateOwner: 'host', supportedPageTypes: ['process', 'page'], supportedSurfaces: ['workspace'], frameOwner: 'host', sideEffects: ['navigation'],
    lifecycle: { preserveMount: true, preserveScroll: true, focusModel: 'host-managed' }, performance: { lazy: true, virtualized: false },
  };
  const applicationPage = page({
    pageId: 'catalog', routeId: 'catalog', routePath: '/catalog', pageType: 'page', title: 'Catalog',
    workflowRef: undefined,
    navigation: { label: 'Catalog', order: 1, hidden: false, pinned: false },
    visibility: { authenticated: true, permissionAllOf: [], permissionAnyOf: [], featureFlags: [], productContexts: ['studio'] },
  });
  const compiled = runtime.compilePageRuntimeProjection({ product: 'studio', pages: [page(), applicationPage], capabilities: [pageCapability], providers: [provider] });
  assert.equal(compiled.document.routes.length, 2);
  assert.equal(compiled.matchRoute('/catalog').pageType, 'page');
  assert.equal(compiled.matchRoute('/team-1/workflows/workflow-1').pageId, 'workflow-page');
  assert.equal(compiled.requireRenderer('workflow-page').providerRef.id, 'application-shell-provider');
  assert.deepEqual(compiled.evaluateAccess('workflow-page', { authenticated: true, permissionCodes: ['workflow.read'], featureFlags: { 'workflow-ui': true } }), { allowed: true, reasons: [] });
  assert.deepEqual(compiled.evaluateAccess('workflow-page', { authenticated: false, permissionCodes: [], featureFlags: {} }).reasons, ['authentication', 'permission-all', 'feature-flag']);
  assert.deepEqual(compiled.visibleNavigation({ authenticated: true, permissionCodes: [], featureFlags: { 'workflow-ui': true } }).map((item) => item.pageId), ['catalog']);
  assert.throws(() => runtime.compilePageRuntimeProjection({ product: 'studio', pages: [page(), page({ pageId: 'other', routeId: 'other' })], capabilities: [pageCapability], providers: [provider] }), /Duplicate route path/);
});

test('keeps the exact capability-owned provider reference in renderer projections', () => {
  const capability = {
    ...pageCapability,
    runtime: {
      ...pageCapability.runtime,
      providerRef: {
        ...pageCapability.runtime.providerRef,
        version: 'provider-release-2026-07',
      },
    },
  };
  const provider = {
    contract: 'ViewProviderDescriptor', providerId: 'application-shell-provider', ownerRepo: 'monkeys-studio',
    capabilityRef: { ...ref('capability', capability.id, capability.capabilityVersion), ownerRepo: capability.ownerRepo },
    rendererKey: 'workflow-workspace', loading: 'lazy', stateOwner: 'host',
    supportedPageTypes: ['process'], supportedSurfaces: ['workspace'], frameOwner: 'host', sideEffects: ['navigation'],
    lifecycle: { preserveMount: true, preserveScroll: true, focusModel: 'host-managed' },
    performance: { lazy: true, virtualized: false },
  };
  const compiled = runtime.compilePageRuntimeProjection({
    product: 'studio', pages: [page()], capabilities: [capability], providers: [provider],
  });

  assert.deepEqual(compiled.requireRenderer('workflow-page').providerRef, capability.runtime.providerRef);
});

test('fails closed when capability, provider and page runtime facts drift', () => {
  const provider = {
    contract: 'ViewProviderDescriptor', providerId: 'application-shell-provider', ownerRepo: 'monkeys-studio',
    capabilityRef: { ...ref('capability', pageCapability.id, pageCapability.capabilityVersion), ownerRepo: pageCapability.ownerRepo },
    rendererKey: 'workflow-workspace', loading: 'lazy', stateOwner: 'host',
    supportedPageTypes: ['process'], supportedSurfaces: ['workspace'], frameOwner: 'host', sideEffects: ['navigation'],
    lifecycle: { preserveMount: true, preserveScroll: true, focusModel: 'host-managed' },
    performance: { lazy: true, virtualized: false },
  };
  const compile = (overrides = {}) => runtime.compilePageRuntimeProjection({
    product: 'studio', pages: [page()], capabilities: [pageCapability], providers: [{ ...provider, ...overrides }],
  });

  assert.throws(() => compile({ loading: 'eager' }), /loading and state ownership/);
  assert.throws(() => compile({ sideEffects: [] }), /side effects/);
  assert.throws(() => compile({ lifecycle: { ...provider.lifecycle, focusModel: 'provider-managed' } }), /focus model/);
  assert.throws(() => runtime.compilePageRuntimeProjection({
    product: 'studio', pages: [page({ record: { deleted: true } })], capabilities: [pageCapability], providers: [provider],
  }), /Deleted page/);
  assert.throws(() => runtime.compilePageRuntimeProjection({
    product: 'studio', pages: [page({ capabilityRefs: [page().capabilityRef] })], capabilities: [pageCapability], providers: [provider],
  }), /Duplicate page capability reference/);
});

test('rejects incomplete or divergent route, navigation, guard and renderer documents', () => {
  const provider = {
    contract: 'ViewProviderDescriptor', providerId: 'application-shell-provider', ownerRepo: 'monkeys-studio',
    capabilityRef: { ...ref('capability', pageCapability.id, pageCapability.capabilityVersion), ownerRepo: pageCapability.ownerRepo },
    rendererKey: 'workflow-workspace', loading: 'lazy', stateOwner: 'host',
    supportedPageTypes: ['process'], supportedSurfaces: ['workspace'], frameOwner: 'host', sideEffects: ['navigation'],
    lifecycle: { preserveMount: true, preserveScroll: true, focusModel: 'host-managed' },
    performance: { lazy: true, virtualized: false },
  };
  const document = runtime.compilePageRuntimeProjection({
    product: 'studio', pages: [page()], capabilities: [pageCapability], providers: [provider],
  }).document;

  assert.throws(() => schemas.PageRuntimeProjectionSchema.parse({
    ...document,
    guards: [],
  }), /Missing guard projection/);
  assert.throws(() => schemas.PageRuntimeProjectionSchema.parse({
    ...document,
    navigation: document.navigation.map((item) => ({ ...item, path: '/different' })),
  }), /does not match its route table entry/);
  assert.throws(() => schemas.PageRuntimeProjectionSchema.parse({
    ...document,
    renderers: document.renderers.map((renderer) => ({
      ...renderer,
      providerRef: { kind: 'provider', id: 'application-shell-provider' },
    })),
  }), /view-provider|pin a provider version|owner repository/);
});
