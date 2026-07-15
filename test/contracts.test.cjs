'use strict';

const assert = require('node:assert/strict');
const { existsSync, readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const test = require('node:test');

const contracts = require('../lib/contracts');
const schemas = require('../lib/schemas');
const runtime = require('../lib/runtime');

const occurredAt = '2026-07-14T08:00:00.000Z';
const ref = (kind, id) => ({ kind, id });

const requestScope = {
  contract: 'RequestScope',
  requestId: 'request-1',
  traceId: 'trace-1',
  appId: 'concept',
  tenantId: 'tenant-1',
  teamId: 'team-1',
  actor: { kind: 'human', id: 'user-1', userId: 'user-1' },
  session: {
    authType: 'frontend_bearer',
    authenticated: true,
    membershipVerified: true,
  },
  permissionCodes: ['studio.workflow.read'],
  authority: [{ resource: 'workflow', actions: ['read'] }],
  issuedAt: occurredAt,
};

const executionLink = {
  contract: 'ExecutionLink',
  requestId: 'request-1',
  traceId: 'trace-1',
  runRef: ref('run', 'run-1'),
};

const completionHeader = {
  contract: 'CompletionHeader',
  eventId: 'event-1',
  runtimeEventId: 'runtime-event-1',
  idempotencyKey: 'run-1:0',
  sequence: 0,
  execution: executionLink,
  producer: { service: 'monkeys-server', runtime: 'node', version: '1.0.0' },
  status: 'SUCCEEDED',
  occurredAt,
};

const pageDefinition = {
  contract: 'PageDefinition',
  pageId: 'workflow-page',
  ownerRepo: 'monkeys-studio',
  surface: 'workspace',
  routeId: 'workflow',
  routePath: '/workflows',
  rendererKey: 'workflow-workspace',
  binding: {},
  navigation: { label: 'Workflows', hidden: false },
  visibility: {
    authenticated: true,
    permissionCodes: [],
    featureFlags: [],
    productContexts: ['studio'],
  },
};

const renderNode = {
  contract: 'RenderNode',
  nodeId: 'workspace-root',
  kind: 'page',
  ownerRepo: 'monkeys-studio',
  pageRef: ref('page', 'workflow-page'),
  capabilityRef: ref('capability', 'image.generate'),
  providerRef: ref('provider', 'workflow-provider'),
  surfaceOwner: 'monkeys-studio',
  scroll: { owner: 'surface', axis: 'y', virtualized: false },
  activation: { activationId: 'workflow-page', mode: 'navigate' },
  lifecycle: {
    mountPolicy: 'when-active',
    queryPolicy: 'when-active',
    retainOnDeactivate: false,
  },
  state: 'idle',
  renderModel: {},
};

const fixtures = {
  'agent-runtime-event': {
    contract: 'AgentRuntimeEvent',
    runtimeEventId: 'runtime-event-1',
    streamId: 'thread-1:request-1',
    sequence: 0,
    requestId: 'request-1',
    teamId: 'team-1',
    threadId: 'thread-1',
    eventType: 'thread:update',
    payload: { patch: { title: 'New title' } },
    occurredAt,
  },
  'application-handoff': {
    contract: 'ApplicationHandoff',
    handoffId: 'handoff-1',
    source: {
      product: 'studio',
      pageId: 'workflow-page',
      viewId: 'workflow-view',
      objectRef: ref('workflow', 'workflow-1'),
      path: '/team-1/workflows',
    },
    target: {
      product: 'kernel',
      pageId: 'workflow-governance',
      objectRef: ref('workflow', 'workflow-1'),
      path: '/kernel/app-governance/workflows',
    },
    returnTarget: {
      product: 'studio',
      pageId: 'workflow-page',
      path: '/team-1/workflows',
    },
    traceId: 'trace-1',
    createdAt: occurredAt,
  },
  'artifact-manifest': {
    contract: 'ArtifactManifest',
    artifactId: 'artifact-1',
    kind: 'image',
    mimeType: 'image/png',
    sha256: 'a'.repeat(64),
    storage: { provider: 's3', key: 'outputs/artifact-1.png' },
    runRef: ref('run', 'run-1'),
    outputRef: ref('output', 'output-1'),
    producer: { service: 'monkeys-server', version: '1.0.0' },
    access: { visibility: 'team', teamId: 'team-1' },
    metadata: {},
    createdAt: occurredAt,
  },
  'brand-body': {
    contract: 'BrandBody',
    brandId: 'brand-1',
    displayName: 'Northwind',
    normalizedName: 'northwind',
    categories: ['outdoor'],
    sourceRefs: [ref('source-record', 'source-record-1')],
    relationRefs: [],
    createdAt: occurredAt,
    updatedAt: occurredAt,
  },
  'brand-genetics-profile': {
    contract: 'BrandGeneticsProfile',
    brandRef: ref('brand', 'brand-1'),
    categories: ['outdoor'],
    signature: { currentSales: 82, forecastSales: 91, searchHeat: 88, socialHeat: 79, confidence: 0.93 },
    relatedRefs: [ref('product', 'product-1')],
    evidenceRefs: [ref('evidence', 'evidence-1')],
    computedAt: occurredAt,
  },
  'capability-manifest': {
    contract: 'CapabilityManifest',
    id: 'image.generate',
    capabilityVersion: '1.0.0',
    ownerRepo: 'monkey-tools-agentkits',
    kind: 'tool',
    displayName: 'Generate image',
    ports: { inputs: [], outputs: [] },
    runtime: {
      providerRef: ref('tool', 'image.generate'),
      loading: 'lazy',
      stateOwner: 'provider',
      sideEffects: ['network'],
    },
    placement: { surfaces: ['workflow'], slots: [], variants: [], tokenRefs: [] },
    accessibility: {
      keyboardModel: 'form',
      focusModel: 'managed',
      labelContract: 'visible-label',
    },
    observability: { eventNamespace: 'capability.image', metrics: [], evidenceRefs: [] },
  },
  'completion-event': { header: completionHeader, payload: { outputId: 'output-1' } },
  'completion-header': completionHeader,
  'domain-event': {
    contract: 'DomainEvent',
    eventId: 'event-1',
    eventType: 'workflow.completed',
    aggregateRef: ref('workflow', 'workflow-1'),
    aggregateVersion: 1,
    requestId: 'request-1',
    actorRef: ref('user', 'user-1'),
    payload: {},
    occurredAt,
  },
  'execution-link': executionLink,
  'hotword-body': {
    contract: 'HotwordBody',
    hotwordId: 'hotword-1',
    label: 'Outdoor',
    normalizedLabel: 'outdoor',
    categories: ['lifestyle'],
    sourceRefs: [{
      sourceId: 'source-1',
      provider: 'internal',
      channel: 'internal',
      collectedAt: occurredAt,
      evidenceRefs: [],
    }],
    relationRefs: [],
    createdAt: occurredAt,
    updatedAt: occurredAt,
  },
  'lineage-record': {
    contract: 'LineageRecord',
    lineageId: 'lineage-1',
    subjectRef: ref('output', 'output-1'),
    sourceRecords: [],
    bodyRefs: [],
    runRefs: [ref('run', 'run-1')],
    outputRefs: [ref('output', 'output-1')],
    artifactRefs: [],
    actorRefs: [],
    evidenceRefs: [],
    recordedAt: occurredAt,
  },
  'ontology-definition': {
    contract: 'OntologyDefinition',
    ontologyId: 'product.asset',
    dataSpaceId: 'assets',
    ownerRepo: 'monkeys-data-server',
    bodySchemaRef: 'schema://product.asset',
    authority: { service: 'monkeys-data-server', storage: 'postgres', scope: 'tenant' },
    relationKinds: [],
    metricKinds: [],
  },
  'overlay-node': {
    contract: 'OverlayNode',
    overlayId: 'widget-fullscreen',
    renderNode: {
      ...renderNode,
      nodeId: 'widget-fullscreen',
      kind: 'overlay',
      activation: { activationId: 'widget-1', mode: 'fullscreen' },
      lifecycle: {
        mountPolicy: 'when-active',
        queryPolicy: 'when-visible',
        retainOnDeactivate: true,
      },
    },
    presentation: 'fullscreen',
    url: { parameter: 'focusWidgetId', value: 'widget-1', closeOnBack: true },
    focus: { initial: 'first-interactive', trap: true, restore: true },
    close: { escape: true, backdrop: true },
  },
  'output-record': {
    contract: 'OutputRecord',
    outputId: 'output-1',
    runRef: ref('run', 'run-1'),
    outputPort: 'image',
    artifactRefs: [],
    createdAt: occurredAt,
  },
  'product-body': {
    contract: 'ProductBody',
    productId: 'product-1',
    brandRef: ref('brand', 'brand-1'),
    displayName: 'Shell Jacket',
    normalizedName: 'shell jacket',
    categories: ['jacket'],
    sourceRefs: [ref('source-record', 'source-record-1')],
    relationRefs: [],
    createdAt: occurredAt,
    updatedAt: occurredAt,
  },
  'page-definition': pageDefinition,
  'page-runtime-descriptor': {
    contract: 'PageRuntimeDescriptor',
    page: pageDefinition,
    nodeId: 'workspace-root',
    surface: { frameOwner: 'monkeys-studio', density: 'default' },
    scroll: { owner: 'surface', axis: 'y', virtualized: false },
    activation: 'navigate',
    lifecycle: {
      mountPolicy: 'when-active',
      queryPolicy: 'when-active',
      deepLink: true,
      focusReturn: true,
    },
  },
  'projection-spec': {
    contract: 'ProjectionSpec',
    projectionId: 'asset-gallery',
    ontologyIds: ['product.asset'],
    outputSchemaRef: 'schema://asset-gallery',
    operator: { kind: 'query', configuration: {} },
    materialization: 'on-demand',
    invalidationEvents: [],
    rebuildable: true,
    lineagePolicy: {
      sourceRecords: true,
      bodyVersions: true,
      runRefs: true,
      actorRefs: true,
    },
  },
  'radar-action-record': {
    contract: 'RadarActionRecord',
    actionId: 'action-1',
    teamId: 'team-1',
    actorRef: ref('user', 'user-1'),
    action: 'launch',
    targetRef: ref('selection', 'selection-1'),
    requestId: 'request-1',
    idempotencyKey: 'launch-selection-1',
    expectedVersion: 1,
    occurredAt,
  },
  'radar-analysis-run': {
    contract: 'RadarAnalysisRun',
    runId: 'radar-run-1',
    teamId: 'team-1',
    selectionRef: ref('selection', 'selection-1'),
    workflowRef: ref('workflow', 'workflow-1'),
    modelRef: ref('model', 'radar-model-1', 1),
    requestId: 'request-1',
    idempotencyKey: 'launch-selection-1',
    status: 'QUEUED',
    outputRefs: [],
    createdAt: occurredAt,
  },
  'radar-opportunity-matrix': {
    contract: 'RadarOpportunityMatrix',
    xMetric: 'searchHeat',
    yMetric: 'forecastSales',
    points: [{
      subjectRef: ref('hotword', 'hotword-1'),
      label: 'Outdoor',
      x: 88,
      y: 91,
      score: 89,
      evidenceRefs: [ref('evidence', 'evidence-1')],
    }],
    computedAt: occurredAt,
  },
  'radar-panorama': {
    contract: 'RadarPanorama',
    nodes: [{ ref: ref('brand', 'brand-1'), label: 'Brand One', categories: ['outdoor'], score: 88, freshnessAt: occurredAt }],
    edges: [{ sourceRef: ref('brand', 'brand-1'), targetRef: ref('product', 'product-1'), relation: 'owns-product', evidenceRefs: [] }],
    generatedAt: occurredAt,
  },
  'radar-query-body': {
    contract: 'RadarQueryBody',
    queryId: 'query-1',
    filters: { category: 'outdoor' },
    sort: { field: 'totalScore', direction: 'desc' },
    pageSize: 50,
    updatedAt: occurredAt,
  },
  'radar-score-model-body': {
    contract: 'RadarScoreModelBody',
    modelId: 'radar-model-1',
    version: 1,
    weights: { currentSales: 0.2, forecastSales: 0.25, searchHeat: 0.2, socialHeat: 0.15, confidence: 0.2 },
    thresholds: { selected: 75 },
    explanationRules: { forecastSales: 'Forecast contribution' },
    createdAt: occurredAt,
  },
  'radar-score-projection': {
    contract: 'RadarScoreProjection',
    projectionId: 'radar-1',
    subjectRef: ref('hotword', 'hotword-1'),
    modelRef: ref('model', 'trend-radar'),
    totalScore: 88,
    dimensions: { currentSales: 82, forecastSales: 91, searchHeat: 88, socialHeat: 79, confidence: 0.93 },
    evidenceRefs: [ref('evidence', 'evidence-1')],
    freshnessAt: occurredAt,
  },
  'radar-selection': {
    contract: 'RadarSelection',
    selectionId: 'selection-1',
    teamId: 'team-1',
    ownerRef: ref('user', 'user-1'),
    subjectRefs: [ref('hotword', 'hotword-1')],
    status: 'selected',
    expectedVersion: 0,
    updatedAt: occurredAt,
  },
  'radar-writeback-record': {
    contract: 'RadarWritebackRecord',
    writebackId: 'writeback-1',
    actionRef: ref('action', 'action-1'),
    targetRef: ref('selection', 'selection-1', 2),
    status: 'APPLIED',
    resultingVersion: 2,
    recordedAt: occurredAt,
  },
  'request-scope': requestScope,
  'render-node': renderNode,
  'saved-radar-query': {
    contract: 'SavedRadarQuery',
    savedQueryId: 'saved-query-1',
    teamId: 'team-1',
    ownerRef: ref('user', 'user-1'),
    name: 'Outdoor opportunities',
    queryRef: ref('radar-query', 'query-1'),
    expectedVersion: 0,
    updatedAt: occurredAt,
  },
  'tenant-product-config': {
    contract: 'TenantProductConfig',
    tenantId: 'tenant-1',
    appId: 'concept',
    environment: 'production',
    themeRef: 'theme-default',
    moduleRefs: [],
    pageRefs: [],
    featureFlags: {},
    authBinding: {},
    dataBinding: {},
    sourceMap: {},
    warnings: [],
  },
  'theme-tokens': {
    contract: 'ThemeTokens',
    metadata: {
      id: 'default',
      version: 1,
      name: 'Default',
      packageName: '@inf-monkeys-tech/monkeys-design',
    },
    seed: {
      'color.primary': { $type: 'color', $value: '#4D8F9D' },
      'radius.default': { $type: 'dimension', $value: '0.5rem' },
    },
    semantic: {
      'color.accent': { $type: 'color', $value: '{seed.color.primary}' },
    },
    component: {},
    assets: { fontFamilies: [], icons: {} },
    modes: {
      color: ['light', 'dark'],
      density: ['compact', 'default', 'comfortable'],
    },
  },
  'trend-ingest-run': {
    contract: 'TrendIngestRun',
    ingestRunId: 'ingest-run-1',
    sourceId: 'source-1',
    requestId: 'request-1',
    idempotencyKey: 'source-1:2026-07-14',
    status: 'SUCCEEDED',
    recordCount: 1,
    errorCount: 0,
    startedAt: occurredAt,
    completedAt: occurredAt,
  },
  'trend-metric-snapshot': {
    contract: 'TrendMetricSnapshot',
    snapshotId: 'snapshot-1',
    subjectRef: ref('hotword', 'hotword-1'),
    observedAt: occurredAt,
    metrics: { growth: 0.8 },
    confidence: 0.9,
    evidenceRefs: [ref('evidence', 'evidence-1')],
  },
  'trend-source-record': {
    contract: 'TrendSourceRecord',
    sourceRecordId: 'source-record-1',
    source: {
      sourceId: 'source-1',
      provider: 'internal',
      channel: 'internal',
      collectedAt: occurredAt,
      evidenceRefs: [],
    },
    ingestRunRef: ref('ingest-run', 'ingest-run-1'),
    recordVersion: 1,
    contentHash: 'b'.repeat(64),
    payload: { label: 'Outdoor' },
    idempotencyKey: 'source-record-1:1',
    collectedAt: occurredAt,
  },
  'view-provider-descriptor': {
    contract: 'ViewProviderDescriptor',
    providerId: 'workflow-provider',
    ownerRepo: 'monkeys-studio',
    capabilityRef: ref('capability', 'image.generate'),
    rendererKey: 'workflow-workspace',
    loading: 'lazy',
    stateOwner: 'provider',
    supportedPageTypes: ['preview'],
    sideEffects: ['network', 'storage'],
    lifecycle: {
      preserveMount: true,
      preserveScroll: true,
      focusModel: 'provider-managed',
    },
    performance: { lazy: true, virtualized: false, budgetMs: 200 },
  },
  'workflow-definition': {
    contract: 'WorkflowDefinition',
    metadata: { id: 'workflow-1', version: 1, role: 'workflow', tags: [] },
    ports: { inputs: [], outputs: [] },
    graph: {
      nodes: [{
        id: 'node-1',
        referenceName: 'node-1',
        capabilityRef: 'image.generate',
        inputBindings: {},
        configuration: {},
      }],
      edges: [],
    },
    execution: { retries: 0, idempotency: 'required' },
    triggers: [],
    views: [],
    dataContracts: { reads: [], writes: [], emits: [] },
  },
};

test('publishes one canonical schema and JSON Schema document for every contract', () => {
  const names = Object.keys(schemas.canonicalContractSchemas).sort();
  assert.deepEqual(names, Object.keys(fixtures).sort());
  assert.equal(names.length, 38);

  const index = JSON.parse(
    readFileSync(resolve(__dirname, '../lib/json-schema/index.json'), 'utf8'),
  );
  assert.deepEqual(Object.keys(index), ['schemas']);
  assert.deepEqual(Object.keys(index.schemas).sort(), names);
  for (const [name, fileName] of Object.entries(index.schemas)) {
    assert.equal(fileName, `./${name}.schema.json`);
    assert.equal(existsSync(resolve(__dirname, '../lib/json-schema', fileName)), true);
  }
});

test('accepts a complete canonical fixture for every contract', () => {
  for (const [name, schema] of Object.entries(schemas.canonicalContractSchemas)) {
    assert.doesNotThrow(() => schema.parse(fixtures[name]), name);
  }
});

test('rejects undeclared top-level fields for every contract', () => {
  for (const [name, schema] of Object.entries(schemas.canonicalContractSchemas)) {
    const result = schema.safeParse({ ...fixtures[name], undeclaredField: true });
    assert.equal(result.success, false, name);
  }
});

test('rejects undeclared nested fields instead of silently normalizing them', () => {
  assert.equal(schemas.RequestScopeSchema.safeParse({
    ...requestScope,
    actor: { ...requestScope.actor, undeclaredField: true },
  }).success, false);
  assert.equal(schemas.ThemeTokensSchema.safeParse({
    ...fixtures['theme-tokens'],
    metadata: { ...fixtures['theme-tokens'].metadata, undeclaredField: true },
  }).success, false);
});

test('WorkflowDefinition rejects duplicate nodes and dangling edges', () => {
  const fixture = fixtures['workflow-definition'];
  const duplicate = {
    ...fixture,
    graph: { ...fixture.graph, nodes: [fixture.graph.nodes[0], fixture.graph.nodes[0]] },
  };
  const dangling = {
    ...fixture,
    graph: { ...fixture.graph, edges: [{ from: 'node-1', to: 'missing' }] },
  };
  assert.equal(schemas.WorkflowDefinitionSchema.safeParse(duplicate).success, false);
  assert.equal(schemas.WorkflowDefinitionSchema.safeParse(dangling).success, false);
});

test('exports only canonical contract and schema names', () => {
  const versionSuffix = /V[12](?:Schema)?$/;
  assert.deepEqual(Object.keys(contracts).filter((name) => versionSuffix.test(name)), []);
  assert.deepEqual(Object.keys(schemas).filter((name) => versionSuffix.test(name)), []);
});

test('does not publish migration or compatibility entrypoints', () => {
  const packageJson = JSON.parse(
    readFileSync(resolve(__dirname, '../package.json'), 'utf8'),
  );
  assert.equal(packageJson.exports['./migrations'], undefined);
  assert.equal(packageJson.bin, undefined);
  assert.equal(existsSync(resolve(__dirname, '../lib/migrations')), false);
});

test('compiles a strict product runtime catalog and matches dynamic routes', () => {
  const catalog = runtime.compileProductRuntimeCatalog({
    product: 'studio',
    pages: [{
      ...pageDefinition,
      routePath: '/$teamId/workflows/:workflowId',
      capabilityRefs: [ref('capability', 'image.generate')],
    }],
    capabilities: [fixtures['capability-manifest']],
    providers: [fixtures['view-provider-descriptor']],
  });

  assert.equal(catalog.pagesById.get('workflow-page').routeId, 'workflow');
  assert.equal(catalog.matchPage('/team-1/workflows/workflow-1').pageId, 'workflow-page');
  assert.throws(() => runtime.compileProductRuntimeCatalog({
    product: 'studio',
    pages: [pageDefinition, pageDefinition],
    capabilities: [fixtures['capability-manifest']],
    providers: [fixtures['view-provider-descriptor']],
  }), /Duplicate pageId/);
});

test('round-trips a validated application handoff through a URL', () => {
  const handoff = fixtures['application-handoff'];
  const target = runtime.buildApplicationHandoffUrl('/kernel/app-governance/workflows?tab=runs', handoff);
  assert.match(target, /^\/kernel\/app-governance\/workflows\?/);
  assert.deepEqual(runtime.readApplicationHandoffFromUrl(target), handoff);
  assert.equal(runtime.parseApplicationHandoff('{"unsafe":true}'), undefined);
});
