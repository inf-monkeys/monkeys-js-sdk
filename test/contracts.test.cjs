'use strict';

const assert = require('node:assert/strict');
const { existsSync, readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const test = require('node:test');

const contracts = require('../lib/contracts');
const schemas = require('../lib/schemas');
const runtime = require('../lib/runtime');

const occurredAt = '2026-07-14T08:00:00.000Z';
const ref = (kind, id, version, ownerRepo) => ({
  kind,
  id,
  ...(version === undefined ? {} : { version }),
  ...(ownerRepo === undefined ? {} : { ownerRepo }),
});

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

const pageCapabilityManifest = {
  contract: 'CapabilityManifest',
  id: 'studio.workflow-workspace',
  capabilityVersion: '1.0.0',
  ownerRepo: 'monkeys-studio',
  kind: 'view',
  displayName: 'Workflow workspace',
  ports: {
    inputs: [{ name: 'renderModel', schemaRef: 'studio.workflow-workspace.render-model', required: true, multiple: false }],
    outputs: [{ name: 'intent', schemaRef: 'studio.workflow-workspace.intent', required: false, multiple: true }],
  },
  runtime: {
    providerBindings: [{ providerRef: ref('view-provider', 'workflow-provider', '1.0.0', 'monkeys-studio'), productContexts: ['studio'], priority: 100 }],
    loading: 'lazy',
    stateOwner: 'provider',
    sideEffects: ['network', 'storage'],
  },
  placement: { surfaces: ['workspace'], slots: [], variants: [], tokenRefs: [] },
  accessibility: { keyboardModel: 'workspace', focusModel: 'provider-managed', labelContract: 'page-title' },
  observability: { eventNamespace: 'studio.workflow', metrics: [], evidenceRefs: [] },
};

const pageProviderDescriptor = {
  contract: 'ViewProviderDescriptor',
  providerId: 'workflow-provider',
  providerVersion: '1.0.0',
  ownerRepo: 'monkeys-studio',
  capabilityRef: ref('capability', pageCapabilityManifest.id, pageCapabilityManifest.capabilityVersion, pageCapabilityManifest.ownerRepo),
  rendererKey: 'workflow-workspace',
  renderModelSchemaRef: 'studio.workflow-workspace.render-model',
  intentSchemaRef: 'studio.workflow-workspace.intent',
  loading: 'lazy',
  stateOwner: 'provider',
  supportedPageTypes: ['process'],
  supportedSurfaces: ['workspace'],
  frameOwner: 'provider',
  sideEffects: ['network', 'storage'],
  sideEffectAdapterRef: ref('side-effect-adapter', 'studio.workflow-workspace.effects', '1.0.0', 'monkeys-studio'),
  lifecycle: { preserveMount: true, preserveScroll: true, focusModel: 'provider-managed' },
  performance: { lazy: true, virtualized: false, budgetMs: 200 },
};

const pageDefinition = {
  contract: 'PageDefinition',
  pageId: 'workflow-page',
  ownerRepo: 'monkeys-studio',
  title: 'Workflows',
  pageType: 'process',
  ownership: { teamId: 'team-1', builtIn: false },
  record: { deleted: false },
  surface: 'workspace',
  routeId: 'workflow',
  routePath: '/workflows',
  rendererKey: 'workflow-workspace',
  capabilityRef: ref('capability', pageCapabilityManifest.id, pageCapabilityManifest.capabilityVersion, pageCapabilityManifest.ownerRepo),
  workflowRef: ref('workflow', 'workflow-1'),
  binding: {},
  access: { actions: ['read', 'execute'] },
  rendererConfig: { schemaRef: 'schema://renderer/workflow-workspace', value: {} },
  navigation: { label: 'Workflows', hidden: false, pinned: true },
  visibility: {
    authenticated: true,
    permissionAllOf: [],
    permissionAnyOf: [],
    featureFlags: [],
    productContexts: ['studio'],
  },
};

const applicationConfig = {
  theme: {
    density: 'default',
    agent: {
      logo: {
        light: 'https://example.com/agent-light.svg',
        dark: 'https://example.com/agent-dark.svg',
      },
    },
  },
  auth: { enabled: [] },
  endpoints: { clientUrl: 'https://studio.infmonkeys.test', serverUrl: 'https://api.infmonkeys.test' },
  module: '*',
  behavior: {
    clearWorkflowFormStorageAfterUpdate: true,
    autoApproveOAuth: false,
    rememberWorkflowModelSelection: true,
  },
};

const conductorTask = {
  name: 'image.generate',
  taskReferenceName: 'node-1',
  type: 'SIMPLE',
  inputParameters: {},
};

const conductorWorkflowDefinition = {
  name: 'workflow-1',
  version: 1,
  tasks: [conductorTask],
  inputParameters: [],
  outputParameters: {},
  timeoutSeconds: 0,
};

const renderNode = {
  contract: 'RenderNode',
  nodeId: 'workspace-root',
  kind: 'page',
  version: 1,
  ownerRepo: 'monkeys-studio',
  children: [],
  pageRef: ref('page', 'workflow-page'),
  capabilityRef: ref('capability', pageCapabilityManifest.id, pageCapabilityManifest.capabilityVersion, pageCapabilityManifest.ownerRepo),
  providerRef: pageCapabilityManifest.runtime.providerBindings[0].providerRef,
  surface: { frameOwner: 'host', density: 'default' },
  scroll: { owner: 'surface', axis: 'y', virtualizationBoundary: false },
  activation: { activationId: 'workflow-page', mode: 'navigate', targetPath: '/workflows/workflow-page' },
  lifecycle: {
    mountPolicy: 'when-active',
    queryPolicy: 'when-active',
    retainOnDeactivate: false,
    deepLink: true,
    focusReturn: true,
  },
  layout: { mode: 'block' },
  responsive: [],
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
  'agent-session-command': {
    contract: 'AgentSessionCommand',
    commandId: 'command-stop-1',
    sessionId: 'agent-session-1',
    idempotencyKey: 'agent-session-1:stop:1',
    expectedSequence: 0,
    issuedAt: occurredAt,
    commandType: 'stop',
    payload: {},
  },
  'agent-session-targeted-command': {
    contract: 'AgentSessionCommand',
    commandId: 'command-stop-1',
    sessionId: 'agent-session-1',
    runId: 'run-1',
    idempotencyKey: 'agent-session-1:run-1:stop:1',
    expectedSequence: 0,
    issuedAt: occurredAt,
    commandType: 'stop',
    payload: {},
  },
  'agent-session-command-result': {
    contract: 'AgentSessionCommandResult',
    commandId: 'command-stop-1',
    sessionId: 'agent-session-1',
    idempotencyKey: 'agent-session-1:stop:1',
    outcome: 'accepted',
    sessionStatus: 'stopping',
    acceptedSequence: 1,
    resultEventIds: ['status-event-1'],
    occurredAt,
  },
  'agent-session-continuation-request': {
    contract: 'AgentSessionContinuationRequest',
    idempotencyKey: 'continuation-1',
    sourceMessageId: 'message-1',
    sourceRunId: 'run-1',
    inheritance: {
      messages: 'through-source-message',
      attachments: 'inherit',
      summaries: 'inherit',
      toolResults: 'exclude',
      codeChanges: 'exclude',
    },
  },
  'agent-session-continuation-result': {
    contract: 'AgentSessionContinuationResult',
    idempotencyKey: 'continuation-1',
    threadId: 'agent-session-2',
    lineage: {
      forkedFromThreadId: 'agent-session-1',
      forkedFromMessageId: 'message-1',
      sourceRunId: 'run-1',
    },
    inheritance: {
      messages: 'through-source-message',
      attachments: 'inherit',
      summaries: 'inherit',
      toolResults: 'exclude',
      codeChanges: 'exclude',
    },
    unavailableResources: [],
    duplicate: false,
    createdAt: occurredAt,
  },
  'agent-session-event': {
    contract: 'AgentSessionEvent',
    eventId: 'agent-session-event-1',
    sessionId: 'agent-session-1',
    sequence: 0,
    idempotencyKey: 'agent-session-1:0',
    occurredAt,
    eventType: 'status',
    payload: { status: 'running' },
  },
  'agent-session-run-event': {
    contract: 'AgentSessionEvent',
    eventId: 'agent-session-run-event-1',
    sessionId: 'agent-session-1',
    runId: 'run-1',
    sourceMessageId: 'message-1',
    sequence: 0,
    idempotencyKey: 'agent-session-1:run-1:0',
    occurredAt,
    eventType: 'status',
    payload: { status: 'running', startedAt: occurredAt },
  },
  'agent-session-run': {
    runId: 'run-1',
    sessionId: 'agent-session-1',
    sourceMessageId: 'message-1',
    status: 'running',
    startedAt: occurredAt,
  },
  'agent-session-view-model': {
    contract: 'AgentSessionViewModel',
    sessionId: 'agent-session-1',
    snapshot: {
      mode: 'agent',
      modelId: 'openai:gpt-5.1-codex',
      capabilities: {
        text: true,
        reasoning: true,
        plan: false,
        tasks: false,
        tools: true,
        mcp: true,
        shell: true,
        fileChange: true,
        skills: true,
        approval: true,
        artifacts: true,
        usage: true,
        resume: true,
        diff: false,
        workspaceFiles: false,
        terminal: false,
        testResults: false,
      },
    },
    status: 'running',
    events: [{
      contract: 'AgentSessionEvent',
      eventId: 'agent-session-event-1',
      sessionId: 'agent-session-1',
      sequence: 0,
      idempotencyKey: 'agent-session-1:0',
      occurredAt,
      eventType: 'status',
      payload: { status: 'running' },
    }],
    lastSequence: 0,
    resumable: true,
  },
  'agent-workbench-navigation-view-model': {
    contract: 'AgentWorkbenchNavigationViewModel',
    activeTab: 'sessions',
    searchQuery: '',
    selectedAgentItem: 'agent-1',
    selectedSessionItem: 'agent-session-1',
    agents: {
      status: 'ready',
      items: [{
        id: 'agent-1',
        name: 'Research Agent',
        description: 'Finds and summarizes sources',
        builtIn: false,
        pinned: true,
        pinPending: false,
      }],
    },
    sessions: {
      status: 'ready',
      items: [{
        id: 'agent-session-1',
        title: 'Launch research',
        updatedAt: occurredAt,
        status: 'running',
        pinned: false,
        contextUsage: { usedTokens: 1024, maxTokens: 8192 },
      }],
    },
    capabilities: {
      createAgent: true,
      createSession: true,
      manageCapabilities: true,
      manageAgentSettings: true,
      pinAgents: true,
      pinSessions: true,
      renameSessions: true,
      deleteSessions: true,
    },
  },
  'agent-workbench-composer-view-model': {
    contract: 'AgentWorkbenchComposerViewModel',
    value: 'Review the current changes',
    status: 'streaming',
    mode: 'agent',
    placeholder: 'Ask anything',
    attachments: [{
      id: 'attachment-1',
      name: 'screenshot.png',
      mediaType: 'image/png',
      previewUrl: 'https://example.test/screenshot.png',
      status: 'ready',
    }],
    queuedDrafts: [{
      id: 'draft-1',
      text: 'Run the focused tests',
      attachmentCount: 0,
      status: 'queued',
    }],
    model: {
      selectedId: 'gpt-5.5',
      options: [{
        id: 'gpt-5.5',
        label: 'GPT 5.5',
        provider: 'OpenAI',
        mode: 'agent',
        disabled: false,
      }],
    },
    reasoning: {
      value: 'high',
      options: ['low', 'medium', 'high', 'xhigh'],
    },
    permissionProfile: 'full-access',
    webSearchEnabled: true,
    capabilities: {
      attachments: true,
      voiceInput: true,
      webSearch: true,
      modelSelection: true,
      reasoning: true,
      permissions: true,
      queue: true,
      stop: true,
    },
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
  'application-run': {
    contract: 'ApplicationRun', runId: 'run-1', definitionRef: ref('workflow-definition', 'workflow-1', 1),
    runtimeLedgerRef: ref('workflow-run', 'execution-1'), requestId: 'request-1', actorRef: ref('user', 'user-1'),
    status: 'RUNNING', inputRefs: [], outputRefs: [], startedAt: occurredAt, metadata: {},
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
  'body-relation-record': {
    contract: 'BodyRelationRecord', relationId: 'relation-1', relationKind: 'workflow.to-workflow',
    subjectRef: ref('workflow-definition', 'workflow-1', 1), objectRef: ref('workflow-definition', 'workflow-2', 1),
    ownerRepo: 'monkeys-server', authorityScope: 'team', properties: {}, createdAt: occurredAt, updatedAt: occurredAt,
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
      providerBindings: [{ providerRef: ref('tool', 'image.generate'), productContexts: [], priority: 0 }],
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
  'capability-registry': {
    contract: 'CapabilityRegistry',
    entries: [{
      manifest: {
        contract: 'CapabilityManifest',
        id: 'image.generate',
        capabilityVersion: '1.0.0',
        ownerRepo: 'monkey-tools-agentkits',
        kind: 'tool',
        displayName: 'Generate image',
        ports: { inputs: [], outputs: [] },
        runtime: { providerBindings: [{ providerRef: ref('tool', 'image.generate'), productContexts: [], priority: 0 }], loading: 'lazy', stateOwner: 'provider', sideEffects: ['network'] },
        placement: { surfaces: ['workflow'], slots: [], variants: [], tokenRefs: [] },
        accessibility: { keyboardModel: 'form', focusModel: 'managed', labelContract: 'visible-label' },
        observability: { eventNamespace: 'capability.image', metrics: [], evidenceRefs: [] },
      },
      sources: [{ sourceType: 'tool-manifest', sourceId: 'agentkits', ownerRepo: 'monkey-tools-agentkits' }],
    }],
  },
  'change-impact-graph': {
    contract: 'ChangeImpactGraph',
    declarationId: 'studio-product',
    nodes: [ref('ontology', 'product.asset')],
    edges: [],
    impacts: [{
      changedRef: ref('ontology', 'product.asset'),
      affectedRefs: [],
      reasons: ['direct-change'],
    }],
    generatedAt: occurredAt,
  },
  'concept-definition': {
    contract: 'ConceptDefinition',
    conceptId: 'product',
    ownerRepo: 'monkeys-data-server',
    displayName: 'Product',
    schemaRef: 'schema://product.asset',
    ontologyId: 'product.asset',
    capabilityIds: ['image.generate'],
    commandNames: ['projection.rebuild'],
    relationships: [],
  },
  'completion-event': { header: completionHeader, payload: { outputId: 'output-1' } },
  'completion-header': completionHeader,
  'conductor-workflow-definition': conductorWorkflowDefinition,
  'data-continuity-envelope': {
    contract: 'DataContinuityEnvelope', tenantId: 'tenant-1', teamId: 'team-1', runRef: ref('application-run', 'run-1'),
    requestId: 'request-1', actorRef: ref('user', 'user-1'), schemaVersion: 1,
  },
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
  'domain-command': {
    contract: 'DomainCommand',
    commandId: 'command-1',
    commandName: 'projection.rebuild',
    requestId: 'request-1',
    traceId: 'trace-1',
    idempotencyKey: 'projection-rebuild-1',
    targetRef: ref('projection', 'asset-gallery'),
    actorRef: ref('user', 'user-1'),
    source: { product: 'kernel', pageId: 'data-governance' },
    payload: {},
    issuedAt: occurredAt,
  },
  'domain-command-definition': {
    contract: 'DomainCommandDefinition',
    commandName: 'projection.rebuild',
    ownerRepo: 'monkeys-data-server',
    displayName: 'Rebuild projection',
    targetKinds: ['projection'],
    inputSchemaRef: 'schema://projection-rebuild',
    requiredPermissionCodes: ['data_management:write'],
    handlerRef: ref('handler', 'monkeys-data-server.projection-rebuild'),
    sideEffects: ['data-write'],
  },
  'execution-link': executionLink,
  'expiring-access-grant': {
    contract: 'ExpiringAccessGrant', grantId: 'grant-1', subjectRef: ref('user', 'user-1'), resourceRef: ref('application-run', 'run-1'),
    permissions: ['read', 'execute'], issuedAt: occurredAt, expiresAt: '2026-07-15T08:00:00.000Z',
  },
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
        deepLink: true,
        focusReturn: true,
      },
    },
    presentation: 'fullscreen',
    zIndexLane: 'fullscreen',
    url: { parameter: 'focusWidgetId', value: 'widget-1', openMode: 'push', closeMode: 'back' },
    focus: { initial: 'first-interactive', trap: true },
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
  'product-declaration': {
    contract: 'ProductDeclaration',
    declarationId: 'studio-product',
    ownerRepo: 'monkeys-studio',
    concepts: [],
    ontologies: [],
    projections: [],
    commands: [],
    capabilities: [],
    pages: [],
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
  'page-runtime-projection': {
    contract: 'PageRuntimeProjection',
    product: 'studio',
    routes: [{ pageId: 'workflow-page', routeId: 'workflow', path: '/workflows' }],
    navigation: [{ pageId: 'workflow-page', routeId: 'workflow', path: '/workflows', label: 'Workflows', pinned: true }],
    guards: [{ pageId: 'workflow-page', authenticated: true, permissionAllOf: [], permissionAnyOf: [], featureFlags: [], actions: ['read', 'execute'] }],
    renderers: [{
      pageId: 'workflow-page', surface: 'workspace', rendererKey: 'workflow-workspace',
      capabilityRef: ref('capability', pageCapabilityManifest.id, pageCapabilityManifest.capabilityVersion, pageCapabilityManifest.ownerRepo), capabilityRefs: [],
      providerRef: ref('view-provider', 'workflow-provider', '1.0.0', 'monkeys-studio'),
      binding: {}, rendererConfig: { schemaRef: 'schema://renderer/workflow-workspace', value: {} }, workflowRef: ref('workflow', 'workflow-1'),
    }],
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
  'radar-analysis-detail': {
    contract: 'RadarAnalysisDetail',
    run: {
      contract: 'RadarAnalysisRun',
      runId: 'run-1',
      teamId: 'team-1',
      selectionRef: ref('radar-selection', 'selection-1'),
      workflowRef: ref('workflow', 'workflow-1'),
      modelRef: ref('radar-score-model', 'model-1'),
      requestId: 'request-1',
      idempotencyKey: 'launch-1',
      status: 'SUCCEEDED',
      outputRefs: [ref('workflow-output', 'output-1')],
      workflowInput: {},
      createDesignProject: true,
      createdAt: occurredAt,
      completedAt: occurredAt,
    },
    runVersion: 2,
    selection: {
      contract: 'RadarSelection',
      selectionId: 'selection-1',
      teamId: 'team-1',
      ownerRef: ref('human', 'user-1'),
      subjectRefs: [ref('hotword', 'hotword-1')],
      status: 'selected',
      expectedVersion: 1,
      updatedAt: occurredAt,
    },
    outputs: [{
      contract: 'OutputRecord',
      outputId: 'output-1',
      runRef: ref('workflow-run', 'workflow-run-1'),
      outputPort: 'images',
      artifactRefs: [ref('artifact', 'artifact-1')],
      createdAt: occurredAt,
    }],
    assets: [{
      artifactRef: ref('artifact', 'artifact-1'),
      kind: 'image',
      mimeType: 'image/png',
      url: 'https://example.com/generated.png',
      metadata: {},
      createdAt: occurredAt,
    }],
    lineage: [{
      contract: 'LineageRecord',
      lineageId: 'lineage-1',
      subjectRef: ref('radar-analysis-run', 'run-1'),
      sourceRecords: [],
      bodyRefs: [ref('hotword', 'hotword-1')],
      runRefs: [ref('workflow-run', 'workflow-run-1')],
      outputRefs: [ref('workflow-output', 'output-1')],
      artifactRefs: [ref('artifact', 'artifact-1')],
      actorRefs: [ref('human', 'user-1')],
      evidenceRefs: [],
      recordedAt: occurredAt,
    }],
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
  'render-tree': {
    contract: 'RenderTree',
    treeId: 'studio-workspace-tree',
    product: 'studio',
    rootNodeId: renderNode.nodeId,
    nodes: [renderNode],
  },
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
    designTokens: {
      tokenSources: [{ type: 'file', path: './design-tokens/default.tokens.json' }],
    },
    moduleRefs: [],
    pageRefs: [],
    featureFlags: {},
    authBinding: {},
    dataBinding: {},
    sourceMap: {},
    warnings: [],
    applicationConfig,
  },
  'tenant-runtime-config': {
    contract: 'TenantRuntimeConfig',
    tenantId: 'tenant-1',
    appId: 'concept',
    environment: 'production',
    designTokens: {
      color: { primary: { $type: 'color', $value: { colorSpace: 'srgb', components: [0.30196, 0.56078, 0.61569], hex: '#4D8F9D' } } },
    },
    moduleRefs: [], pageRefs: [], featureFlags: {}, authBinding: {}, dataBinding: {}, sourceMap: {}, warnings: [],
    applicationConfig,
  },
  'theme-tokens': {
    color: {
      primary: {
        $type: 'color',
        $value: {
          colorSpace: 'srgb',
          components: [0.30196, 0.56078, 0.61569],
          hex: '#4D8F9D',
        },
      },
    },
    radius: {
      default: { $type: 'dimension', $value: { value: 0.5, unit: 'rem' } },
    },
    semantic: {
      accent: { $type: 'color', $value: '{color.primary}' },
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
  'view-provider-descriptor': pageProviderDescriptor,
  'workflow-catalog-entry': {
    contract: 'WorkflowCatalogEntry',
    workflowId: 'workflow-1',
    teamId: 'team-1',
    creatorRef: ref('user', 'user-1'),
    currentDefinitionRef: ref(
      'workflow-definition',
      'workflow-1:release:1',
      1,
    ),
    lifecycle: 'ACTIVE',
    asset: {
      preset: false,
      marketplacePublished: false,
      sort: 0,
      notAuthorized: false,
    },
    createdAt: occurredAt,
    updatedAt: occurredAt,
  },
  'workflow-completion-commit': {
    contract: 'WorkflowCompletionCommit',
    commitId: 'completion-execution-1',
    run: {
      contract: 'ApplicationRun',
      runId: 'run-1',
      definitionRef: ref('workflow-definition', 'workflow-1', 1),
      runtimeLedgerRef: ref('workflow-run', 'execution-1'),
      requestId: 'request-1',
      actorRef: ref('user', 'user-1'),
      status: 'COMPLETED',
      inputRefs: [],
      outputRefs: [ref('workflow-output', 'output-1')],
      startedAt: occurredAt,
      completedAt: occurredAt,
      metadata: {},
    },
    outputs: [{
      contract: 'OutputRecord',
      outputId: 'output-1',
      runRef: ref('application-run', 'run-1'),
      outputPort: 'result',
      artifactRefs: [ref('artifact', 'artifact-1')],
      createdAt: occurredAt,
    }],
    artifacts: [{
      contract: 'ArtifactManifest',
      artifactId: 'artifact-1',
      kind: 'image',
      mimeType: 'image/png',
      sha256: 'a'.repeat(64),
      storage: { provider: 's3', key: 'outputs/artifact-1.png' },
      runRef: ref('application-run', 'run-1'),
      outputRef: ref('workflow-output', 'output-1'),
      producer: { service: 'monkeys-conductor-worker', version: '1.0.0' },
      access: { visibility: 'team', teamId: 'team-1' },
      metadata: {},
      createdAt: occurredAt,
    }],
    lineage: {
      contract: 'LineageRecord',
      lineageId: 'lineage-run-1',
      subjectRef: ref('application-run', 'run-1'),
      sourceRecords: [],
      bodyRefs: [ref('workflow-definition', 'workflow-1', 1)],
      runRefs: [ref('application-run', 'run-1')],
      outputRefs: [ref('workflow-output', 'output-1')],
      artifactRefs: [ref('artifact', 'artifact-1')],
      actorRefs: [ref('user', 'user-1')],
      evidenceRefs: [ref('workflow-run', 'execution-1')],
      recordedAt: occurredAt,
    },
    completedAt: occurredAt,
  },
  'workflow-completion-receipt': {
    contract: 'WorkflowCompletionReceipt',
    commitId: 'completion-execution-1',
    runRef: ref('application-run', 'run-1'),
    outputRefs: [ref('workflow-output', 'output-1')],
    artifactRefs: [ref('artifact', 'artifact-1')],
    contentHash: 'c'.repeat(64),
    committedAt: occurredAt,
    idempotentReplay: false,
  },
  'workflow-definition': {
    contract: 'WorkflowDefinition',
    metadata: { id: 'workflow-1', version: 1, name: { 'en-US': 'Workflow' }, role: 'workflow', teamId: 'team-1', creatorRef: ref('user', 'user-1'), tags: [] },
    revision: { kind: 'release', recordVersion: 1 },
    presentation: {},
    ports: { inputs: [], outputs: [] },
    parameters: { variables: [], outputs: [] },
    graph: {
      nodes: [{
        id: 'node-1',
        referenceName: 'node-1',
        capabilityRef: 'image.generate',
        inputBindings: {},
        configuration: { executor: 'conductor', task: conductorTask },
      }],
      edges: [],
    },
    execution: { retries: 0, idempotency: 'required', conductor: {} },
    triggers: [],
    views: [],
    dataContracts: { reads: [], writes: [], emits: [] },
    governance: { activated: true, validated: true, validationIssues: [] },
    interfaces: { openai: { enabled: false } },
  },
  'workflow-publication': {
    contract: 'WorkflowPublication',
    publicationId: 'workflow-1-1',
    definitionRef: ref('workflow-definition', 'workflow-1', 1),
    runtimeDefinitionRef: ref('conductor-workflow-definition', 'workflow-1', 1),
    sourceHash: 'a'.repeat(64),
    compiledHash: 'b'.repeat(64),
    status: 'PUBLISHED',
    publisherRef: ref('user', 'user-1'),
    publishedAt: occurredAt,
  },
};

test('publishes one canonical schema and JSON Schema document for every contract', () => {
  const names = Object.keys(schemas.canonicalContractSchemas).sort();
  assert.deepEqual(names, Object.keys(fixtures).sort());
  assert.equal(names.length, 68);

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
    color: {
      ...fixtures['theme-tokens'].color,
      primary: { ...fixtures['theme-tokens'].color.primary, undeclaredField: true },
    },
  }).success, false);
});

test('tenant application config accepts Ontology data bindings and rejects retired Bucket aliases', () => {
  const canonical = {
    ...applicationConfig,
    dataManagement: {
      favoriteOntologyId: 'favorite',
      pairedOntologyId: 'paired',
      galleryOntologyIds: ['gallery', 'trend-reports'],
      galleryOntologyId: 'gallery',
      dataBrowserDefaultOntologyId: 'assets',
      workflowResultOntologyId: 'workflow-results',
      homeAdvertisement: { ontologyId: 'home' },
      homeTrendAssistant: { ontologyId: 'trends' },
      sharing: {
        silentViewLinks: {
          placement: { mode: 'sourceOntology', ontologyId: 'assets' },
        },
      },
    },
  };
  assert.equal(schemas.TenantApplicationConfigSchema.safeParse(canonical).success, true);

  const retiredBindings = [
    { favoriteBucketId: 'favorite' },
    { pairedBucketId: 'paired' },
    { galleryBucketIds: ['gallery'] },
    { galleryBucketId: 'gallery' },
    { dataBrowserDefaultBucketId: 'assets' },
    { workflowResultBucketId: 'workflow-results' },
    { homeAdvertisement: { bucketId: 'home' } },
    { homeTrendAssistant: { bucketId: 'trends' } },
    { sharing: { silentViewLinks: { placement: { mode: 'sourceBucket', bucketId: 'assets' } } } },
  ];
  for (const dataManagement of retiredBindings) {
    assert.equal(schemas.TenantApplicationConfigSchema.safeParse({
      ...applicationConfig,
      dataManagement,
    }).success, false);
  }
});

test('tenant application config accepts strict Trend Radar Ontology/View source roles', () => {
  const parseTrendRadar = (trendRadar) => schemas.TenantApplicationConfigSchema.safeParse({
    ...applicationConfig,
    dataManagement: { trendRadar },
  });
  const hotwords = { ontologyId: 'trend-hotwords', viewId: 'view-hotwords' };
  const brands = { ontologyId: 'trend-brands', viewId: 'view-brands' };

  assert.equal(parseTrendRadar({ hotwords, brands }).success, true);
  assert.equal(parseTrendRadar({ hotwords }).success, true);
  assert.equal(parseTrendRadar({ brands }).success, true);

  const invalidRegistries = [
    { hotwords: { ontologyId: 'trend-hotwords' } },
    { hotwords: { viewId: 'view-hotwords' } },
    { hotwords: { ontologyId: '', viewId: 'view-hotwords' } },
    { hotwords: { ...hotwords, teamId: '0' } },
    { hotwords: { ...hotwords, projectionRef: 'projection' } },
    { hotwords: { ...hotwords, fieldMap: { title: 'column-title' } } },
    { opportunities: hotwords },
  ];
  for (const trendRadar of invalidRegistries) {
    assert.equal(parseTrendRadar(trendRadar).success, false);
  }
});

test('tenant application config bounds canonical gallery Ontology bindings', () => {
  const withGalleryOntologyIds = (galleryOntologyIds) => ({
    ...applicationConfig,
    dataManagement: { galleryOntologyIds },
  });

  assert.equal(schemas.TenantApplicationConfigSchema.safeParse(
    withGalleryOntologyIds(Array.from({ length: 20 }, (_, index) => `gallery-${index}`)),
  ).success, true);
  assert.equal(schemas.TenantApplicationConfigSchema.safeParse(
    withGalleryOntologyIds(Array.from({ length: 21 }, (_, index) => `gallery-${index}`)),
  ).success, false);
  assert.equal(schemas.TenantApplicationConfigSchema.safeParse(
    withGalleryOntologyIds(['']),
  ).success, false);
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

test('WorkflowDefinition preserves webhook identity and custom event configuration', () => {
  const workflow = structuredClone(fixtures['workflow-definition']);
  workflow.triggers = [
    {
      id: 'webhook-trigger',
      type: 'webhook',
      enabled: true,
      webhook: {
        path: 'stable-webhook-path',
        method: 'POST',
        auth: 'NONE',
        responseUntil: 'WORKFLOW_STARTED',
      },
    },
    {
      id: 'custom-trigger',
      type: 'event',
      enabled: true,
      event: {
        eventType: 'third_party__asset_created',
        configuration: { sourceId: 'source-1' },
      },
    },
  ];

  const parsed = schemas.WorkflowDefinitionSchema.parse(workflow);
  assert.equal(parsed.triggers[0].webhook.path, 'stable-webhook-path');
  assert.deepEqual(parsed.triggers[1].event.configuration, { sourceId: 'source-1' });
});

test('WorkflowDefinition preserves canonical ComfyUI workflow port bindings', () => {
  const workflow = structuredClone(fixtures['workflow-definition']);
  workflow.parameters.variables = [
    {
      displayName: 'Prompt',
      name: 'prompt',
      type: 'string',
      typeOptions: { comfyOptions: { node: 10, key: 'text' } },
    },
  ];

  const parsed = schemas.WorkflowDefinitionSchema.parse(workflow);
  assert.deepEqual(parsed.parameters.variables[0].typeOptions.comfyOptions, {
    node: 10,
    key: 'text',
  });
});

test('workflow runtime contracts preserve one authoritative completion graph', () => {
  const run = {
    contract: 'ApplicationRun',
    runId: 'run-1',
    definitionRef: ref('workflow-definition', 'workflow-1', 2),
    runtimeLedgerRef: ref('workflow-run', 'execution-1'),
    requestId: 'request-1',
    actorRef: ref('user', 'user-1'),
    status: 'COMPLETED',
    inputRefs: [],
    outputRefs: [ref('workflow-output', 'output-1')],
    startedAt: '2026-07-31T00:00:00.000Z',
    completedAt: '2026-07-31T00:01:00.000Z',
    metadata: {},
  };
  const output = {
    contract: 'OutputRecord',
    outputId: 'output-1',
    runRef: ref('application-run', 'run-1'),
    outputPort: 'result',
    value: { text: 'done' },
    artifactRefs: [ref('artifact', 'artifact-1')],
    createdAt: '2026-07-31T00:01:00.000Z',
  };
  const artifact = {
    contract: 'ArtifactManifest',
    artifactId: 'artifact-1',
    kind: 'image',
    mimeType: 'image/png',
    sha256: 'a'.repeat(64),
    storage: { provider: 's3', bucket: 'assets', key: 'generated/result.png' },
    runRef: ref('application-run', 'run-1'),
    outputRef: ref('workflow-output', 'output-1'),
    producer: { service: 'monkeys-conductor-worker', version: '1' },
    access: { teamId: 'team-1', visibility: 'team' },
    metadata: {},
    createdAt: '2026-07-31T00:01:00.000Z',
  };
  const lineage = {
    contract: 'LineageRecord',
    lineageId: 'lineage-1',
    subjectRef: ref('application-run', 'run-1'),
    sourceRecords: [],
    bodyRefs: [ref('workflow-definition', 'workflow-1', 2)],
    runRefs: [ref('application-run', 'run-1')],
    outputRefs: [ref('workflow-output', 'output-1')],
    artifactRefs: [ref('artifact', 'artifact-1')],
    actorRefs: [ref('user', 'user-1')],
    evidenceRefs: [ref('workflow-run', 'execution-1')],
    recordedAt: '2026-07-31T00:01:00.000Z',
  };
  const commit = {
    contract: 'WorkflowCompletionCommit',
    commitId: 'completion-execution-1',
    run,
    outputs: [output],
    artifacts: [artifact],
    lineage,
    completedAt: '2026-07-31T00:01:00.000Z',
  };

  assert.equal(schemas.WorkflowCompletionCommitSchema.safeParse(commit).success, true);
  assert.equal(schemas.WorkflowCompletionCommitSchema.safeParse({
    ...commit,
    outputs: [{ ...output, runRef: ref('application-run', 'other-run') }],
  }).success, false);
});

test('workflow publication pins one immutable Conductor definition', () => {
  const publication = {
    contract: 'WorkflowPublication',
    publicationId: 'workflow-1-2',
    definitionRef: ref('workflow-definition', 'workflow-1', 2),
    runtimeDefinitionRef: ref('conductor-workflow-definition', 'workflow-1', 2),
    sourceHash: 'a'.repeat(64),
    compiledHash: 'b'.repeat(64),
    status: 'PUBLISHED',
    publisherRef: ref('user', 'user-1'),
    publishedAt: '2026-07-31T00:00:00.000Z',
  };

  assert.equal(schemas.WorkflowPublicationSchema.safeParse(publication).success, true);
  assert.equal(schemas.WorkflowPublicationSchema.safeParse({
    ...publication,
    runtimeDefinitionRef: ref('workflow-definition', 'workflow-1', 2),
  }).success, false);
});

test('application runs only claim a Conductor ledger after execution starts', () => {
  const pending = {
    ...fixtures['application-run'],
    status: 'PENDING',
    runtimeLedgerRef: undefined,
    startedAt: undefined,
    completedAt: undefined,
  };
  assert.equal(schemas.ApplicationRunSchema.safeParse(pending).success, true);
  assert.equal(
    schemas.ApplicationRunSchema.safeParse({
      ...pending,
      status: 'RUNNING',
      startedAt: occurredAt,
    }).success,
    false,
  );
  assert.equal(
    schemas.ApplicationRunSchema.safeParse({
      ...pending,
      status: 'FAILED',
      completedAt: occurredAt,
    }).success,
    true,
  );
});

test('workflow catalog entry owns lifecycle without duplicating the definition body', () => {
  const entry = {
    contract: 'WorkflowCatalogEntry',
    workflowId: 'workflow-1',
    teamId: 'team-1',
    creatorRef: ref('user', 'user-1'),
    currentDefinitionRef: ref(
      'workflow-definition',
      'workflow-1:release:2',
      3,
    ),
    lifecycle: 'ACTIVE',
    asset: {
      preset: false,
      marketplacePublished: false,
      sort: 0,
      notAuthorized: false,
    },
    createdAt: '2026-07-31T00:00:00.000Z',
    updatedAt: '2026-07-31T00:01:00.000Z',
  };

  assert.equal(
    schemas.WorkflowCatalogEntrySchema.safeParse(entry).success,
    true,
  );
  assert.equal(
    schemas.WorkflowCatalogEntrySchema.safeParse({
      ...entry,
      lifecycle: 'DELETED',
    }).success,
    false,
  );
  assert.equal(
    schemas.WorkflowCatalogEntrySchema.safeParse({
      ...entry,
      definition: fixtures['workflow-definition'],
    }).success,
    false,
  );
});

test('exports only canonical contract and schema names', () => {
  const versionSuffix = /V[12](?:Schema)?$/;
  assert.deepEqual(Object.keys(contracts).filter((name) => versionSuffix.test(name)), []);
  assert.deepEqual(Object.keys(schemas).filter((name) => versionSuffix.test(name)), []);
});

test('accepts the versioned UAT current-user menu profile at the tenant runtime boundary', () => {
  const profile = JSON.parse(
    readFileSync(resolve(__dirname, './fixtures/current-user-menu-profile.v1.json'), 'utf8'),
  );
  const runtimeConfig = {
    ...fixtures['tenant-runtime-config'],
    applicationConfig: {
      ...applicationConfig,
      theme: {
        ...applicationConfig.theme,
        headbar: { profile },
      },
    },
  };

  const parsed = schemas.TenantRuntimeConfigSchema.parse(runtimeConfig);
  assert.deepEqual(parsed.applicationConfig.theme.headbar.profile, profile);
  assert.deepEqual(schemas.CurrentUserMenuProfileSchema.parse(profile), profile);
  assert.equal(typeof contracts.CurrentUserMenuProfileSchema.parse, 'function');
});

test('preserves legacy current-user profiles and rejects malformed versioned profiles', () => {
  assert.equal(schemas.CurrentUserMenuProfileSchema.parse('*'), '*');
  assert.deepEqual(
    schemas.CurrentUserMenuProfileSchema.parse(['dark-mode', 'language', 'settings', 'logout']),
    ['dark-mode', 'language', 'settings', 'logout'],
  );

  const invalidProfiles = [
    ['duplicate legacy item', ['settings', 'settings']],
    [
      'duplicate section id',
      {
        version: 1,
        sections: [
          { id: 'account', items: [] },
          { id: 'account', items: [] },
        ],
      },
    ],
    [
      'duplicate global item id',
      {
        version: 1,
        sections: [
          { id: 'appearance', items: [{ id: 'shared', kind: 'control', ref: 'language' }] },
          { id: 'account', items: [{ id: 'shared', kind: 'action', ref: 'logout' }] },
        ],
      },
    ],
    [
      'arbitrary navigation URL',
      {
        version: 1,
        sections: [
          { id: 'account', items: [{ id: 'external', kind: 'navigation', ref: 'https://example.com' }] },
        ],
      },
    ],
    [
      'unknown field',
      { version: 1, sections: [], fallback: '*' },
    ],
  ];

  for (const [name, profile] of invalidProfiles) {
    assert.equal(
      schemas.CurrentUserMenuProfileSchema.safeParse(profile).success,
      false,
      name,
    );
  }
});

test('rejects unpinned render capability and provider references', () => {
  assert.equal(schemas.RenderNodeSchema.safeParse({
    ...renderNode,
    capabilityRef: ref('capability', pageCapabilityManifest.id),
  }).success, false);
  assert.equal(schemas.RenderNodeSchema.safeParse({
    ...renderNode,
    providerRef: ref('view-provider', pageProviderDescriptor.providerId),
  }).success, false);
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
  const declaration = (pages) => ({
    contract: 'ProductDeclaration', declarationId: 'studio.product', ownerRepo: 'monkeys-studio',
    concepts: [], ontologies: [], projections: [], commands: [], pages, capabilities: [pageCapabilityManifest],
  });
  const catalog = runtime.compileProductRuntimeCatalog({
    product: 'studio',
    declaration: declaration([{
      ...pageDefinition,
      routePath: '/$teamId/workflows/:workflowId',
      capabilityRefs: [],
    }]),
    providers: [pageProviderDescriptor],
  });

  assert.equal(catalog.pagesById.get('workflow-page').routeId, 'workflow');
  assert.equal(catalog.matchPage('/team-1/workflows/workflow-1').pageId, 'workflow-page');
  assert.throws(() => runtime.compileProductRuntimeCatalog({
    product: 'studio',
    declaration: declaration([pageDefinition, pageDefinition]),
    providers: [pageProviderDescriptor],
  }), /Duplicate page id/);
});

test('compiles a recursive render tree and rejects disconnected or asymmetric topology', () => {
  const child = {
    ...renderNode,
    nodeId: 'workspace-view',
    kind: 'view',
    parentNodeId: renderNode.nodeId,
    children: [],
  };
  const root = { ...renderNode, children: [child.nodeId] };
  const tree = {
    contract: 'RenderTree',
    treeId: 'studio-workspace-tree',
    product: 'studio',
    rootNodeId: root.nodeId,
    nodes: [root, child],
  };
  const compiled = runtime.compileRenderTree(tree);
  assert.deepEqual(compiled.traversal.map(({ nodeId }) => nodeId), ['workspace-root', 'workspace-view']);
  assert.deepEqual(compiled.ancestorsOf(child.nodeId).map(({ nodeId }) => nodeId), ['workspace-root']);
  assert.throws(() => runtime.compileRenderTree({ ...tree, nodes: [root, { ...child, parentNodeId: 'missing' }] }), /missing parent|does not point back/);
  assert.throws(() => runtime.compileRenderTree({ ...tree, nodes: [{ ...root, children: [] }, child] }), /not declared by parent/);
});

test('round-trips a validated application handoff through a URL', () => {
  const handoff = fixtures['application-handoff'];
  const target = runtime.buildApplicationHandoffUrl('/kernel/app-governance/workflows?tab=runs', handoff);
  assert.match(target, /^\/kernel\/app-governance\/workflows\?/);
  assert.deepEqual(runtime.readApplicationHandoffFromUrl(target), handoff);
  assert.equal(runtime.parseApplicationHandoff('{"unsafe":true}'), undefined);
});

test('compiles declarations, validates commands, and computes transitive change impact', () => {
  const command = fixtures['domain-command-definition'];
  const ontology = fixtures['ontology-definition'];
  const projection = {
    ...fixtures['projection-spec'],
    ontologyIds: [ontology.ontologyId],
  };
  const concept = fixtures['concept-definition'];
  const declaration = {
    ...fixtures['product-declaration'],
    concepts: [concept],
    ontologies: [ontology],
    projections: [projection],
    commands: [command],
    capabilities: [fixtures['capability-manifest'], pageCapabilityManifest],
    pages: [{
      ...pageDefinition,
      binding: { ontologyId: ontology.ontologyId, projectionRef: projection.projectionId },
      capabilityRefs: [],
    }],
  };
  const compiled = runtime.compileProductDeclaration(declaration);
  assert.equal(compiled.pagesById.get('workflow-page').binding.projectionRef, 'asset-gallery');
  assert.throws(() => runtime.compileProductDeclaration({
    ...declaration,
    projections: [{ ...projection, ontologyIds: ['missing'] }],
  }), /unknown ontology/);

  assert.equal(runtime.validateDomainCommand(
    fixtures['domain-command'],
    [command],
    ['data_management:write'],
  ).commandName, 'projection.rebuild');
  assert.throws(() => runtime.validateDomainCommand(fixtures['domain-command'], [command], []), /requires permissions/);

  const impact = runtime.buildChangeImpactGraph(
    declaration,
    {
      ...declaration,
      ontologies: [{ ...ontology, metricKinds: ['sales'] }],
    },
    occurredAt,
  );
  const ontologyImpact = impact.impacts.find((item) => item.changedRef.kind === 'ontology');
  assert.deepEqual(
    ontologyImpact.affectedRefs.map((item) => `${item.kind}:${item.id}`),
    ['concept:product', 'page:workflow-page', 'projection:asset-gallery'],
  );
});

test('tool capability compiler rejects non-tool manifests and providers', () => {
  assert.equal(runtime.compileToolCapabilityManifest(fixtures['capability-manifest']).id, 'image.generate');
  assert.throws(() => runtime.compileToolCapabilityManifest(pageCapabilityManifest), /kind tool/);
});

test('tool capability factory produces the canonical manifest from provider metadata', () => {
  const manifest = runtime.createToolCapabilityManifest({
    id: 'monkeys_tools_calculator', capabilityVersion: '1.0.0', ownerRepo: 'monkey-tools-agentkits',
    displayName: 'Calculator', inputs: [{ name: 'expression', required: true }], outputs: [{ name: 'result' }],
  });
  assert.equal(manifest.kind, 'tool');
  assert.equal(manifest.runtime.providerBindings[0].providerRef.id, 'monkeys_tools_calculator');
  assert.equal(manifest.ports.inputs[0].schemaRef, 'schema://tool/monkeys_tools_calculator/input/expression');
});

test('OpenAPI capability publisher annotates every declared tool operation', () => {
  const document = {
    paths: { '/calculate': { post: {
      'x-monkey-tool-name': 'calculate', 'x-monkey-tool-display-name': 'Calculate',
      'x-monkey-tool-input': [{
        name: 'expression', required: true, type: 'string',
        description: { 'zh-CN': '表达式', 'en-US': 'Expression' },
      }],
      'x-monkey-tool-output': [{
        name: 'result', displayName: { 'zh-CN': '结果', 'en-US': 'Result' },
      }],
    } } },
  };
  runtime.publishOpenApiToolCapabilityManifests(document, {
    namespace: 'monkeys_tools', ownerRepo: 'monkey-tools-agentkits', capabilityVersion: '1.0.0',
  });
  const capability = document.paths['/calculate'].post['x-monkeys-capability-manifest'];
  assert.equal(capability.id, 'monkeys_tools_calculate');
  assert.equal(capability.ownerRepo, 'monkey-tools-agentkits');
  assert.equal(capability.ports.inputs[0].description, 'Expression');
  assert.equal(capability.ports.outputs[0].description, 'Result');
  assert.equal(typeof capability.ports.outputs[0].description, 'string');

  assert.throws(() => runtime.publishOpenApiToolCapabilityManifests({
    paths: { '/invalid': { post: {
      'x-monkey-tool-name': 'invalid',
      'x-monkey-tool-input': [{ name: 'value', required: 'yes' }],
    } } },
  }, {
    namespace: 'monkeys_tools', ownerRepo: 'monkey-tools-agentkits', capabilityVersion: '1.0.0',
  }), /required must be a boolean/);
});

test('OpenAPI capability publisher collapses conditional presentation duplicates without weakening contracts', () => {
  const document = {
    paths: { '/execute': { post: {
      'x-monkey-tool-name': 'sandbox',
      'x-monkey-tool-input': [
        { name: 'language', type: 'options' },
        { name: 'sourceCode', required: true, type: 'string', description: 'Node.js source code' },
        { name: 'sourceCode', required: true, type: 'string', description: 'Python source code' },
      ],
    } } },
  };

  runtime.publishOpenApiToolCapabilityManifests(document, {
    namespace: 'sandbox', ownerRepo: 'monkey-tools-sandbox', capabilityVersion: '1.0.0',
  });

  const capability = document.paths['/execute'].post['x-monkeys-capability-manifest'];
  assert.deepEqual(capability.ports.inputs.map((port) => port.name), ['language', 'sourceCode']);
  assert.equal(capability.ports.inputs[1].description, 'Node.js source code');

  assert.throws(() => runtime.publishOpenApiToolCapabilityManifests({
    paths: { '/invalid': { post: {
      'x-monkey-tool-name': 'invalid',
      'x-monkey-tool-input': [
        { name: 'value', required: true, type: 'string' },
        { name: 'value', required: false, type: 'string' },
      ],
    } } },
  }, {
    namespace: 'sandbox', ownerRepo: 'monkey-tools-sandbox', capabilityVersion: '1.0.0',
  }), /conflicting duplicate declarations/);
});
