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
  ports: {
    inputs: [{ name: 'renderModel', schemaRef: 'studio.application-shell.render-model', required: true, multiple: false }],
    outputs: [{ name: 'intent', schemaRef: 'studio.application-shell.intent', required: false, multiple: true }],
  },
  runtime: { providerBindings: [{ providerRef: ref('tool', 'image.generate'), productContexts: [], priority: 0 }], loading: 'lazy', stateOwner: 'provider', sideEffects: ['network'] },
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
  ports: {
    inputs: [{ name: 'renderModel', schemaRef: 'studio.application-shell.render-model', required: true, multiple: false }],
    outputs: [{ name: 'intent', schemaRef: 'studio.application-shell.intent', required: false, multiple: true }],
  },
  runtime: {
    providerBindings: [{ providerRef: { kind: 'view-provider', id: 'application-shell-provider', version: '1.0.0', ownerRepo: 'monkeys-studio' }, productContexts: ['studio'], priority: 100 }],
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

test('compiles pure view render models and separates runtime adapters', () => {
  const onSelect = () => undefined;
  const opaque = new Date('2026-07-21T00:00:00.000Z');
  const compiled = runtime.compileViewProviderInput({
    title: 'Records',
    rows: [{ id: 'record-1', score: 0.8 }],
    interaction: { onSelect },
    visual: opaque,
  });

  assert.deepEqual(compiled.renderModel, {
    title: 'Records',
    rows: [{ id: 'record-1', score: 0.8 }],
    interaction: { onSelect: null },
    visual: null,
  });
  assert.deepEqual(compiled.runtimeBindings.map(({ path, kind }) => ({ path, kind })), [
    { path: '/interaction/onSelect', kind: 'intent-adapter' },
    { path: '/visual', kind: 'opaque-adapter' },
  ]);
  const restored = runtime.applyViewRuntimeBindings(compiled.renderModel, compiled.runtimeBindings);
  assert.equal(restored.interaction.onSelect, onSelect);
  assert.equal(restored.visual, opaque);
});

test('rejects identity leaks and invalid values in view render models', () => {
  assert.throws(() => runtime.compileViewProviderInput({ tenantId: 'tenant-1' }), /Forbidden renderModel field tenantId/);
  assert.throws(() => runtime.compileViewProviderInput({ nested: { pathname: '/kernel' } }), /Forbidden renderModel field pathname/);
  assert.throws(() => runtime.compileViewProviderInput({ score: Number.NaN }), /Non-finite number/);
  const cyclic = {};
  cyclic.self = cyclic;
  assert.throws(() => runtime.compileViewProviderInput(cyclic), /Cyclic renderModel input/);
});

test('compiles desired tenant config into a resolved, source-free browser contract', () => {
  const productConfig = schemas.TenantProductConfigSchema.parse({
    ...representativeProductConfig,
    applicationConfig: {
      ...representativeProductConfig.applicationConfig,
      theme: {
        ...representativeProductConfig.applicationConfig.theme,
        statusStates: {
          loading: { variant: 'skeleton' },
          empty: { variant: 'compact' },
          error: { showRetry: false },
          permission: { showRequestAccess: false },
          density: 'comfortable',
        },
      },
    },
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
  assert.equal(runtimeConfig.applicationConfig.theme.agent.logo.light, '/agent-logo-light.svg');
  assert.equal(runtimeConfig.applicationConfig.theme.agent.sessionCentric, true);
  assert.equal(runtimeConfig.applicationConfig.theme.agent.quickStartEnabled, true);
  assert.deepEqual(runtimeConfig.applicationConfig.theme.statusStates, {
    loading: { variant: 'skeleton' },
    empty: { variant: 'compact' },
    error: { showRetry: false },
    permission: { showRequestAccess: false },
    density: 'comfortable',
  });
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
        monkeysSpaceHeadbar: [
          {
            id: 'workbench',
            showContentFrame: false,
            children: [
              { id: 'studio-a', displayName: 'Studio A', showContentFrame: true },
              { id: 'studio-b', displayName: 'Studio B', disabled: true },
            ],
          },
        ],
      },
    },
  }));
  assert.equal(schemas.TenantApplicationConfigSchema.safeParse({
    ...applicationConfig,
    theme: {
      ...applicationConfig.theme,
      headbar: { theme: 'bsd-blue' },
    },
  }).success, false);
  assert.equal(schemas.TenantApplicationConfigSchema.safeParse({
    ...applicationConfig,
    theme: {
      ...applicationConfig.theme,
      headbar: { theme: 'fixed' },
    },
  }).success, false);
  const landingPageConfigs = [
    { mode: 'default' },
    { mode: 'markdown', content: '# Welcome' },
    { mode: 'html', content: '<main>Welcome</main>' },
    { mode: 'iframe', url: '/landing-pages/tenant/index.html' },
  ];
  for (const landingPageConfig of landingPageConfigs) {
    for (const headbarMode of [undefined, 'shared', 'hidden']) {
      const input = headbarMode === undefined
        ? landingPageConfig
        : { ...landingPageConfig, headbarMode };
      assert.deepEqual(schemas.TenantLandingPageConfigSchema.parse(input), input);
    }
    assert.equal(schemas.TenantLandingPageConfigSchema.safeParse({
      ...landingPageConfig,
      headbarMode: 'floating',
    }).success, false);
    assert.equal(schemas.TenantLandingPageConfigSchema.safeParse({
      ...landingPageConfig,
      undeclared: true,
    }).success, false);
  }
  assert.equal(schemas.TenantLandingPageConfigSchema.safeParse({
    mode: 'html',
    content: '<main>Welcome</main>',
    url: 'https://example.com',
  }).success, false);
  assert.equal(schemas.TenantLandingPageConfigSchema.safeParse({
    mode: 'iframe',
    url: 'javascript:alert(1)',
  }).success, false);
  assert.equal(schemas.TenantLandingPageConfigSchema.safeParse({
    mode: 'iframe',
    url: 'not-a-url',
  }).success, false);
  assert.equal(schemas.TenantLandingPageConfigSchema.safeParse({
    mode: 'iframe',
    url: 'https://user:secret@example.com',
  }).success, false);
  assert.equal(schemas.TenantLandingPageConfigSchema.safeParse({
    mode: 'iframe',
    url: '/landing-pages/tenant/index.html',
  }).success, true);
});

test('round-trips optional Home entry availability through tenant config contracts', () => {
  const compileWithPages = (pages) => {
    const productConfig = schemas.TenantProductConfigSchema.parse({
      ...representativeProductConfig,
      authBinding: {
        primary: { kind: 'auth-provider', providerId: 'oidc', policyRef: 'tenant-login' },
      },
      dataBinding: {
        assets: { kind: 'data-provider', providerId: 'monkey-data', domainRef: 'assets' },
      },
      applicationConfig: {
        ...applicationConfig,
        theme: {
          ...applicationConfig.theme,
          pages,
        },
      },
    });
    const runtimeConfig = runtime.compileTenantRuntimeConfig({
      productConfig,
      resolvedDesignTokens: {
        palette: { primary: { $type: 'color', $value: color('#336699', [0.2, 0.4, 0.6]) } },
      },
    });

    return { productConfig, runtimeConfig };
  };
  const basePages = applicationConfig.theme.pages;

  for (const homeEntryEnabled of [true, false]) {
    const { productConfig, runtimeConfig } = compileWithPages({
      ...basePages,
      homeEntryEnabled,
    });

    assert.equal(productConfig.applicationConfig.theme.pages.homeEntryEnabled, homeEntryEnabled);
    assert.equal(runtimeConfig.applicationConfig.theme.pages.homeEntryEnabled, homeEntryEnabled);
  }

  const omitted = compileWithPages(basePages);
  assert.equal('homeEntryEnabled' in omitted.productConfig.applicationConfig.theme.pages, false);
  assert.equal('homeEntryEnabled' in omitted.runtimeConfig.applicationConfig.theme.pages, false);
  assert.equal(schemas.TenantApplicationConfigSchema.safeParse({
    ...applicationConfig,
    theme: {
      ...applicationConfig.theme,
      pages: { ...basePages, homeEntryEnabled: 'true' },
    },
  }).success, false);
  assert.equal(schemas.TenantApplicationConfigSchema.safeParse({
    ...applicationConfig,
    theme: {
      ...applicationConfig.theme,
      pages: {
        ...basePages,
        unknownHomeEntrySetting: true,
      },
    },
  }).success, false);
});

test('accepts empty tenant overrides or explicit inline, file and URL design-token sources', () => {
  const inlineDocument = {
    color: { primary: { $type: 'color', $value: color('#336699', [0.2, 0.4, 0.6]) } },
  };
  const parsed = schemas.TenantProductConfigSchema.parse({
    ...representativeProductConfig,
    authBinding: {
      primary: { kind: 'auth-provider', providerId: 'oidc', policyRef: 'tenant-login' },
    },
    dataBinding: {
      assets: { kind: 'data-provider', providerId: 'monkey-data', domainRef: 'assets' },
    },
    designTokens: {
      tokenSources: [
        { type: 'file', path: './tokens/base.tokens.json' },
        { type: 'url', url: 'https://cdn.example.com/tenant.tokens.json' },
        { type: 'inline', document: inlineDocument },
      ],
    },
  });
  assert.equal(parsed.designTokens.tokenSources[2].type, 'inline');
  assert.deepEqual(schemas.TenantProductConfigSchema.parse({
    ...representativeProductConfig,
    authBinding: {
      primary: { kind: 'auth-provider', providerId: 'oidc', policyRef: 'tenant-login' },
    },
    dataBinding: {
      assets: { kind: 'data-provider', providerId: 'monkey-data', domainRef: 'assets' },
    },
    designTokens: { tokenSources: [] },
  }).designTokens.tokenSources, []);
  assert.equal(schemas.TenantProductConfigSchema.safeParse({
    ...representativeProductConfig,
    designTokens: { tokenSources: ['./tokens/base.tokens.json'] },
  }).success, false);
});

test('tenant runtime bindings fail closed for missing and unavailable providers', () => {
  const policy = {
    authProviderIds: ['monkeys-server'],
    dataProviderIds: ['monkeys-server'],
    requiredAuthBindings: ['primary'],
    requiredDataBindings: ['primary'],
  };
  const bindings = runtime.compileTenantRuntimeBindings({
    authBinding: {
      primary: { kind: 'auth-provider', providerId: 'monkeys-server' },
    },
    dataBinding: {
      primary: { kind: 'data-provider', providerId: 'monkeys-server' },
    },
  }, policy);

  assert.equal(bindings.requireAuth().providerId, 'monkeys-server');
  assert.equal(bindings.requireData().providerId, 'monkeys-server');
  assert.throws(() => runtime.compileTenantRuntimeBindings({
    authBinding: {},
    dataBinding: { primary: { kind: 'data-provider', providerId: 'monkeys-server' } },
  }, policy), /missing required auth binding/i);
  assert.throws(() => runtime.compileTenantRuntimeBindings({
    authBinding: { primary: { kind: 'auth-provider', providerId: 'external-auth' } },
    dataBinding: { primary: { kind: 'data-provider', providerId: 'monkeys-server' } },
  }, policy), /unavailable provider/i);
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
      workflowPreviewExecutionGrid: {
        clickBehavior: 'none',
        aspectRatio: '4:3',
      },
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
      workflowPreviewExecutionGrid: {
        aspectRatio: '2:1',
      },
    },
  }), /invalid/i);
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

  assert.deepEqual(runtime.compileConductorWorkflowDefinition(definition), {
    ...conductor,
    ownerEmail: runtime.DEFAULT_CONDUCTOR_OWNER_EMAIL,
  });
  assert.equal(
    definition.execution.conductor.ownerEmail,
    runtime.DEFAULT_CONDUCTOR_OWNER_EMAIL,
  );
  assert.deepEqual(runtime.compileWorkflowPersistenceProjection(definition), { tasks: [task], variables, output });
  assert.equal(definition.graph.nodes[0].configuration.task.decisionCases.image[0].type, 'GENERATE_IMAGE');
  assert.throws(() => schemas.WorkflowDefinitionSchema.parse({
    ...definition,
    execution: { ...definition.execution, rateLimit: { enabled: true, max: 0, windowMs: 0 } },
  }), /positive/);
  assert.throws(() => schemas.ConductorTaskDefinitionSchema.parse({ ...task, unknownTaskField: true }));
  assert.doesNotThrow(() => schemas.ConductorTaskDefinitionSchema.parse({ ...task, defaultCase: undefined }));
  assert.doesNotThrow(() => schemas.ConductorTaskDefinitionSchema.parse({
    name: 'system.loop', taskReferenceName: 'loop', type: 'DO_WHILE',
    inputParameters: { mode: 'list', listToLoopOver: '${workflow.input.items}' }, loopOver: [],
  }));
  assert.throws(() => schemas.ConductorTaskDefinitionSchema.parse({
    name: 'system.loop', taskReferenceName: 'loop', type: 'DO_WHILE',
    inputParameters: { mode: 'expression' }, loopOver: [],
  }), /loopCondition/);
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
    contract: 'ViewProviderDescriptor', providerId: 'application-shell-provider', providerVersion: '1.0.0', ownerRepo: 'monkeys-studio',
    capabilityRef: { ...ref('capability', pageCapability.id, pageCapability.capabilityVersion), ownerRepo: pageCapability.ownerRepo }, rendererKey: 'workflow-workspace', renderModelSchemaRef: 'studio.application-shell.render-model', intentSchemaRef: 'studio.application-shell.intent', loading: 'lazy', stateOwner: 'host', supportedPageTypes: ['process', 'page'], supportedSurfaces: ['workspace'], frameOwner: 'host', sideEffects: ['navigation'], sideEffectAdapterRef: { ...ref('side-effect-adapter', 'studio.application-shell.effects', '1.0.0'), ownerRepo: 'monkeys-studio' },
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
      providerBindings: [{
        ...pageCapability.runtime.providerBindings[0],
        providerRef: { ...pageCapability.runtime.providerBindings[0].providerRef, version: 'provider-release-2026-07' },
      }],
    },
  };
  const provider = {
    contract: 'ViewProviderDescriptor', providerId: 'application-shell-provider', providerVersion: 'provider-release-2026-07', ownerRepo: 'monkeys-studio',
    capabilityRef: { ...ref('capability', capability.id, capability.capabilityVersion), ownerRepo: capability.ownerRepo },
    rendererKey: 'workflow-workspace', renderModelSchemaRef: 'studio.application-shell.render-model', intentSchemaRef: 'studio.application-shell.intent', loading: 'lazy', stateOwner: 'host',
    supportedPageTypes: ['process'], supportedSurfaces: ['workspace'], frameOwner: 'host', sideEffects: ['navigation'], sideEffectAdapterRef: { ...ref('side-effect-adapter', 'studio.application-shell.effects', '1.0.0'), ownerRepo: 'monkeys-studio' },
    lifecycle: { preserveMount: true, preserveScroll: true, focusModel: 'host-managed' },
    performance: { lazy: true, virtualized: false },
  };
  const compiled = runtime.compilePageRuntimeProjection({
    product: 'studio', pages: [page()], capabilities: [capability], providers: [provider],
  });

  assert.deepEqual(compiled.requireRenderer('workflow-page').providerRef, capability.runtime.providerBindings[0].providerRef);
});

test('fails closed when capability, provider and page runtime facts drift', () => {
  const provider = {
    contract: 'ViewProviderDescriptor', providerId: 'application-shell-provider', providerVersion: '1.0.0', ownerRepo: 'monkeys-studio',
    capabilityRef: { ...ref('capability', pageCapability.id, pageCapability.capabilityVersion), ownerRepo: pageCapability.ownerRepo },
    rendererKey: 'workflow-workspace', renderModelSchemaRef: 'studio.application-shell.render-model', intentSchemaRef: 'studio.application-shell.intent', loading: 'lazy', stateOwner: 'host',
    supportedPageTypes: ['process'], supportedSurfaces: ['workspace'], frameOwner: 'host', sideEffects: ['navigation'], sideEffectAdapterRef: { ...ref('side-effect-adapter', 'studio.application-shell.effects', '1.0.0'), ownerRepo: 'monkeys-studio' },
    lifecycle: { preserveMount: true, preserveScroll: true, focusModel: 'host-managed' },
    performance: { lazy: true, virtualized: false },
  };
  const compile = (overrides = {}) => runtime.compilePageRuntimeProjection({
    product: 'studio', pages: [page()], capabilities: [pageCapability], providers: [{ ...provider, ...overrides }],
  });

  assert.throws(() => compile({ loading: 'eager' }), /loading and state ownership/);
  assert.throws(() => compile({ sideEffects: [], sideEffectAdapterRef: undefined }), /side effects/);
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
    contract: 'ViewProviderDescriptor', providerId: 'application-shell-provider', providerVersion: '1.0.0', ownerRepo: 'monkeys-studio',
    capabilityRef: { ...ref('capability', pageCapability.id, pageCapability.capabilityVersion), ownerRepo: pageCapability.ownerRepo },
    rendererKey: 'workflow-workspace', renderModelSchemaRef: 'studio.application-shell.render-model', intentSchemaRef: 'studio.application-shell.intent', loading: 'lazy', stateOwner: 'host',
    supportedPageTypes: ['process'], supportedSurfaces: ['workspace'], frameOwner: 'host', sideEffects: ['navigation'], sideEffectAdapterRef: { ...ref('side-effect-adapter', 'studio.application-shell.effects', '1.0.0'), ownerRepo: 'monkeys-studio' },
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
