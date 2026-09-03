'use strict';

const HASH_A = 'a'.repeat(64);
const HASH_B = 'b'.repeat(64);

const identity = (kind, id, ownerRepo = 'monkeys-data-server') => ({ kind, id, ownerRepo });

const tenantScope = Object.freeze({
  tenantRef: identity('tenant', 'tenant.acme'),
  dataSpaceRef: identity('data-space', 'monkeys.control'),
  teamRef: identity('team', 'team.design'),
});

const stable = (kind, id, overrides = {}) => ({
  kind,
  id,
  ownerRepo: overrides.ownerRepo ?? 'monkeys-js-sdk',
  visibility: overrides.visibility ?? 'tenant',
  ...(overrides.visibility === 'global' || overrides.visibility === 'public'
    ? {}
    : { tenantScope: overrides.tenantScope ?? tenantScope }),
});

const revision = (kind, id, overrides = {}) => ({
  ...stable(kind, id, overrides),
  revision: overrides.revision ?? 1,
  schemaVersion: overrides.schemaVersion ?? 1,
  contentHash: overrides.contentHash ?? HASH_A,
});

const text = (value = 'Example') => ({
  defaultLocale: 'en-US',
  values: { 'en-US': value, 'zh-CN': `示例 ${value}` },
});

const access = (overrides = {}) => ({
  authenticated: overrides.authenticated ?? true,
  groupAllOf: overrides.groupAllOf ?? [],
  groupAnyOf: overrides.groupAnyOf ?? [],
  permissionAllOf: overrides.permissionAllOf ?? [],
  permissionAnyOf: overrides.permissionAnyOf ?? [],
  conditionAllOf: overrides.conditionAllOf ?? [],
});

const managementAccess = Object.freeze({
  edit: access({ permissionAllOf: ['page.edit'] }),
  preview: access({ permissionAllOf: ['page.preview'] }),
  publish: access({ permissionAllOf: ['page.publish'] }),
  deactivate: access({ permissionAllOf: ['page.deactivate'] }),
  rollback: access({ permissionAllOf: ['page.rollback'] }),
  retire: access({ permissionAllOf: ['page.retire'] }),
});

const environmentRef = stable('environment', 'environment.test', { visibility: 'global', ownerRepo: 'monkeys-server' });
const routeSpaceRevisionRef = revision('route-space', 'studio.tenant', { visibility: 'global', ownerRepo: 'monkeys-server' });
const compilerRevisionRef = revision('compiler', 'declarative-control', { visibility: 'global' });
const performanceBudgetRef = revision('performance-budget', 'page.default', { visibility: 'global', ownerRepo: 'monkeys-server' });
const observationPolicyRevisionRef = revision('observation-policy', 'page.default', { visibility: 'global', ownerRepo: 'monkeys-server' });
const tokenRevisionRef = revision('design-token', 'theme.default', { visibility: 'global', ownerRepo: 'monkeys-design' });
const shellDocumentHash = '8f2f4f36851bd2f979f15152bef827564379c7b9313cb331413d38bf28fd9fcf';
const shellRevisionRef = revision('shell', 'studio.page-shell', { visibility: 'global', ownerRepo: 'monkeys-design', contentHash: shellDocumentHash });
const shellDocument = Object.freeze({
  contract: 'DeclarativeShell',
  schemaVersion: 1,
  hostCapabilityRevisionRef: revision('capability', 'monkeys.design.shell-layout', { visibility: 'global', ownerRepo: 'monkeys-design' }),
  hostProviderRevisionRef: revision('view-provider', 'monkeys.design.shell-layout.provider', { visibility: 'global', ownerRepo: 'monkeys-design' }),
  allowedSlots: ['header', 'sidebar', 'main', 'aside', 'footer'],
  tokenRevisionRefs: [tokenRevisionRef],
  surfaceChrome: [{ surface: 'studio', header: { enabled: true, navigationPlacement: 'studio.headbar.primary' } }],
});
const shellRegistration = Object.freeze({
  resourceRevisionRef: shellRevisionRef,
  resourceKind: 'shell',
  supportedSurfaces: ['studio'],
  document: shellDocument,
  sourceContentHash: shellDocumentHash,
});
const capabilityRevisionRef = revision('capability', 'monkeys.design.gallery', { visibility: 'global', ownerRepo: 'monkeys-design' });
const providerRevisionRef = revision('view-provider', 'studio.gallery', { visibility: 'global', ownerRepo: 'monkeys' });
const propertySchemaRevisionRef = revision('schema', 'monkeys.design.gallery.properties', { visibility: 'global', ownerRepo: 'monkeys-design' });
const ontologyRevisionRef = revision('ontology-definition', 'ontology.inspiration', { ownerRepo: 'monkeys-data-server' });
const viewRevisionRef = revision('view', 'view.inspiration.gallery', { ownerRepo: 'monkeys-data-server' });
const renderModelSchemaRevisionRef = revision('schema', 'render-model.inspiration.gallery', { visibility: 'global', ownerRepo: 'monkeys-data-server' });
const actionRevisionRef = revision('domain-command', 'inspiration.favorite', { ownerRepo: 'monkeys-data-server' });
const actionSourceIntentSchemaRevisionRef = revision('schema', 'monkeys.design.gallery.favorite.intent', { visibility: 'global', ownerRepo: 'monkeys-design', contentHash: HASH_B });
const actionInputSchemaRevisionRef = revision('schema', 'inspiration.favorite.input', { visibility: 'global', ownerRepo: 'monkeys-data-server' });
const actionResultSchemaRevisionRef = revision('schema', 'inspiration.favorite.result', { visibility: 'global', ownerRepo: 'monkeys-data-server' });

const routeSpace = Object.freeze({
  contract: 'RouteSpace',
  schemaVersion: 1,
  routeSpaceId: 'studio.tenant',
  supportedSurface: 'studio',
  basePath: '/:teamId',
  caseSensitive: false,
  trailingSlash: 'remove',
  reservedPaths: ['/auth', '/settings'],
  parameters: [
    { name: 'teamId', type: 'identifier', required: true },
    { name: 'workbenchId', type: 'identifier', required: false },
  ],
});

const routeMatcher = Object.freeze({
  caseSensitive: routeSpace.caseSensitive,
  trailingSlash: routeSpace.trailingSlash,
  parameters: routeSpace.parameters,
});

const renderTree = Object.freeze({
  contract: 'RenderTree',
  treeId: 'page.studio.inspiration-gallery',
  product: 'studio',
  rootNodeId: 'gallery',
  nodes: [{
    contract: 'RenderNode',
    nodeId: 'gallery',
    kind: 'professional-provider',
    version: 1,
    ownerRepo: 'monkeys',
    children: [],
    pageRef: { kind: 'page', id: 'page.studio.inspiration-gallery', version: 1, ownerRepo: 'monkeys-js-sdk' },
    capabilityRef: { kind: 'capability', id: capabilityRevisionRef.id, version: 1, ownerRepo: capabilityRevisionRef.ownerRepo },
    providerRef: { kind: 'view-provider', id: providerRevisionRef.id, version: 1, ownerRepo: providerRevisionRef.ownerRepo },
    surface: { frameOwner: 'provider', density: 'default' },
    scroll: { owner: 'provider', axis: 'y', virtualizationBoundary: true },
    activation: { activationId: 'gallery', mode: 'navigate', targetPath: '/gallery', history: 'push' },
    lifecycle: { mountPolicy: 'when-active', queryPolicy: 'when-active', retainOnDeactivate: false, deepLink: true, focusReturn: true },
    layout: { mode: 'contents' },
    responsive: [],
    state: 'idle',
    renderModel: {},
  }],
});

const page = Object.freeze({
  contract: 'Page',
  schemaVersion: 1,
  pageId: 'page.studio.inspiration-gallery',
  tenantScope,
  identity: { name: text('Inspiration Gallery'), description: text('Browse governed inspiration records'), tags: ['gallery'] },
  supportedSurfaces: ['studio'],
  lifecycle: 'active',
  routeClaims: [{ kind: 'canonical', routeSpaceRevisionRef, pathTemplate: '/Gallery/' }],
  shellRevisionRef,
  renderTree,
  capabilityInstances: [{
    instanceId: 'gallery',
    nodeId: 'gallery',
    capabilityRevisionRef,
    providerRevisionRef,
    propertySchemaRevisionRef,
    properties: { density: 'comfortable' },
    allowedSideEffects: ['network'],
  }],
  ontologyBindings: [{
    bindingId: 'inspiration-list',
    ontologyDefinitionRevisionRef: ontologyRevisionRef,
    viewRevisionRef,
    parameters: {
      cursor: { kind: 'route-parameter', name: 'cursor' },
      teamId: { kind: 'identity', name: 'teamId' },
    },
    target: { capabilityInstanceId: 'gallery', port: 'items' },
    renderModelSchemaRevisionRef,
    pagination: 'cursor',
    cache: 'identity-scoped',
    cancelOnChange: true,
  }],
  actionBindings: [{
    bindingId: 'favorite',
    commandRevisionRef: actionRevisionRef,
    source: { capabilityInstanceId: 'gallery', port: 'favorite' },
    sourceIntentSchemaRevisionRef: actionSourceIntentSchemaRevisionRef,
    inputSchemaRevisionRef: actionInputSchemaRevisionRef,
    inputMapping: { recordId: { kind: 'intent-field', path: 'recordId' } },
    accessPolicy: access({ permissionAllOf: ['inspiration.favorite'] }),
    confirmation: text('Add to favorites?'),
    idempotencyKeySource: 'interaction',
    resultSchemaRevisionRef: actionResultSchemaRevisionRef,
    success: { refreshBindingIds: ['inspiration-list'] },
    recovery: 'retry-safe',
    lineageRequired: true,
  }],
  pageAccessPolicy: access({ permissionAllOf: ['inspiration.read'] }),
  managementAccess,
  tokenRevisionRefs: [tokenRevisionRef],
  performanceBudgetRef,
  observationPolicyRevisionRef,
  privacyClassification: 'internal',
});

const pageRevisionRef = revision('page', page.pageId);
const pageReleaseRevisionRef = revision('page-release', 'tenant.acme:test:studio:studio.tenant:/gallery');

const releaseEvidence = Object.freeze({
  publicationPlanRef: stable('publication-plan', 'plan.example'),
  expectedHeadRevisionRef: null,
  validation: { result: 'pass', inputHash: HASH_A, diagnosticRefs: [] },
  approvalPolicyRevisionRef: revision('approval-policy', 'approval.test', { visibility: 'global', ownerRepo: 'monkeys-server' }),
  approvalDecisionRevisionRef: revision('approval-decision', 'approval.test.1', { ownerRepo: 'monkeys-server' }),
  actorRef: stable('actor', 'user.leo', { ownerRepo: 'monkeys-server' }),
  reason: 'Initial activation',
  idempotencyKey: 'publish-page-example',
  occurredAt: '2026-08-28T00:00:00.000Z',
  evidenceRefs: [revision('evidence', 'evidence.page.example', { ownerRepo: 'monkeys-server' })],
});

const dependency = (role, revisionRef) => ({ role, revisionRef });

const pageDependencySnapshot = Object.freeze([
  dependency('route-space', routeSpaceRevisionRef),
  dependency('shell', shellRevisionRef),
  dependency('capability', capabilityRevisionRef),
  dependency('provider', providerRevisionRef),
  dependency('schema', propertySchemaRevisionRef),
  dependency('ontology-definition', ontologyRevisionRef),
  dependency('view', viewRevisionRef),
  dependency('schema', renderModelSchemaRevisionRef),
  dependency('action', actionRevisionRef),
  dependency('schema', actionSourceIntentSchemaRevisionRef),
  dependency('schema', actionInputSchemaRevisionRef),
  dependency('schema', actionResultSchemaRevisionRef),
  dependency('token', tokenRevisionRef),
  dependency('performance-budget', performanceBudgetRef),
  dependency('observation-policy', observationPolicyRevisionRef),
  dependency('compiler', compilerRevisionRef),
]);

const pageRelease = Object.freeze({
  contract: 'PageRelease',
  schemaVersion: 1,
  releaseSlotId: 'tenant.acme:test:studio:studio.tenant:/gallery',
  tenantScope,
  operation: 'activate',
  pageRevisionRef,
  target: {
    environmentRef,
    surface: 'studio',
    routeSpaceRevisionRef,
    normalizedPath: '/gallery',
    routeClaim: {
      kind: 'canonical',
      routeSpaceRevisionRef,
      pathTemplate: '/Gallery/',
      normalizedPath: '/gallery',
      matcher: routeMatcher,
    },
  },
  dependencySnapshot: pageDependencySnapshot,
  evidence: releaseEvidence,
});

const workflowRevisionRef = revision('workflow', 'workflow.product-brief', { ownerRepo: 'monkeys-server' });
const workflowProviderRevisionRef = revision('view-provider', 'studio.workflow-page', { visibility: 'global', ownerRepo: 'monkeys' });
const workflowInputSchemaRevisionRef = revision('schema', 'workflow.product-brief.input', { visibility: 'global', ownerRepo: 'monkeys-server' });
const workbenchHostCapabilityRevisionRef = revision('capability', 'monkeys.design.workbench-host', { visibility: 'global', ownerRepo: 'monkeys-design' });
const workbenchHostProviderRevisionRef = revision('view-provider', 'studio.workbench-host', { visibility: 'global', ownerRepo: 'monkeys' });
const workbenchLayoutPolicyRevisionRef = revision('layout-policy', 'workbench.default', { visibility: 'global', ownerRepo: 'monkeys-design' });

const workbench = Object.freeze({
  contract: 'Workbench',
  schemaVersion: 1,
  workbenchId: 'workbench.studio.design',
  tenantScope,
  purpose: 'instance',
  identity: { name: text('Design Workbench'), description: text('Design tools'), iconRef: stable('icon', 'icon.design', { visibility: 'global', ownerRepo: 'monkeys-design' }) },
  supportedSurfaces: ['studio'],
  lifecycle: 'active',
  routeClaims: [{ kind: 'canonical', routeSpaceRevisionRef, pathTemplate: '/studio/:workbenchId' }],
  groups: [{ groupId: 'create', label: text('Create'), order: 10, collapsedByDefault: false, accessPolicy: access() }],
  appInstances: [{
    instanceId: 'product-brief',
    kind: 'workflow-form',
    targetRevisionRef: workflowRevisionRef,
    providerRevisionRef: workflowProviderRevisionRef,
    inputSchemaRevisionRef: workflowInputSchemaRevisionRef,
    input: { mode: 'create' },
    groupId: 'create',
    order: 10,
    display: { name: text('Product Brief') },
    accessPolicy: access({ permissionAllOf: ['workflow.run'] }),
  }],
  defaultEntry: { groupId: 'create', instanceId: 'product-brief', showDefaultGroup: true },
  layout: {
    hostCapabilityRevisionRef: workbenchHostCapabilityRevisionRef,
    hostProviderRevisionRef: workbenchHostProviderRevisionRef,
    layoutPolicyRevisionRef: workbenchLayoutPolicyRevisionRef,
    tokenRevisionRefs: [tokenRevisionRef],
  },
  workbenchAccessPolicy: access({ permissionAllOf: ['workbench.read'] }),
  managementAccess,
  personalPreferencesPolicy: { allowed: ['collapsed-groups', 'recent-entry'], authority: 'identity-overlay' },
  performanceBudgetRef,
  observationPolicyRevisionRef,
  privacyClassification: 'internal',
});

const workbenchRevisionRef = revision('workbench', workbench.workbenchId);
const workbenchReleaseRevisionRef = revision('workbench-release', 'tenant.acme:test:studio:workbench.studio.design');
const workbenchDependencySnapshot = Object.freeze([
  dependency('route-space', routeSpaceRevisionRef),
  dependency('workflow', workflowRevisionRef),
  dependency('provider', workflowProviderRevisionRef),
  dependency('schema', workflowInputSchemaRevisionRef),
  dependency('capability', workbenchHostCapabilityRevisionRef),
  dependency('provider', workbenchHostProviderRevisionRef),
  dependency('layout-policy', workbenchLayoutPolicyRevisionRef),
  dependency('token', tokenRevisionRef),
  dependency('performance-budget', performanceBudgetRef),
  dependency('observation-policy', observationPolicyRevisionRef),
  dependency('compiler', compilerRevisionRef),
]);

const workbenchRelease = Object.freeze({
  contract: 'WorkbenchRelease',
  schemaVersion: 1,
  releaseSlotId: 'tenant.acme:test:studio:workbench.studio.design',
  tenantScope,
  operation: 'activate',
  workbenchRevisionRef,
  target: {
    environmentRef,
    surface: 'studio',
    workbenchId: workbench.workbenchId,
    routeSpaceRevisionRef,
    normalizedPath: '/studio/:workbenchId',
    routeClaim: {
      kind: 'canonical',
      routeSpaceRevisionRef,
      pathTemplate: '/studio/:workbenchId',
      normalizedPath: '/studio/:workbenchId',
      matcher: routeMatcher,
    },
    order: 10,
    isDefaultCandidate: true,
  },
  dependencySnapshot: workbenchDependencySnapshot,
  evidence: releaseEvidence,
});

const navigation = Object.freeze({
  contract: 'Navigation',
  schemaVersion: 1,
  navigationId: 'navigation.studio.headbar.primary',
  tenantScope,
  identity: { name: text('Primary Navigation') },
  supportedSurfaces: ['studio'],
  placements: ['studio.headbar.primary'],
  lifecycle: 'active',
  nodes: [{
    nodeId: 'workspace', kind: 'group', parentNodeId: null, order: 10,
    label: text('Workspace'), collapsedByDefault: false, audience: access(),
  }, {
    nodeId: 'gallery', kind: 'target', parentNodeId: 'workspace', order: 10,
    label: text('Gallery'),
    targetRef: stable('page', page.pageId),
    parameterMapping: {},
    audience: access({ permissionAllOf: ['inspiration.read', 'workspace.enter'] }),
  }, {
    nodeId: 'separator', kind: 'separator', parentNodeId: 'workspace', order: 20,
  }, {
    nodeId: 'design', kind: 'target', parentNodeId: 'workspace', order: 30,
    label: text('Design Workbench'),
    targetRef: stable('workbench', workbench.workbenchId),
    parameterMapping: {},
    audience: access({ permissionAllOf: ['workbench.read', 'workspace.enter'] }),
  }],
  managementAccess,
  performanceBudgetRef,
  observationPolicyRevisionRef,
});

const navigationRevisionRef = revision('navigation', navigation.navigationId);
const navigationReleaseRevisionRef = revision('navigation-release', 'tenant.acme:test:studio:studio.headbar.primary');

const resolvedPageTarget = Object.freeze({
  nodeId: 'gallery',
  stableTargetRef: stable('page', page.pageId),
  targetRevisionRef: pageRevisionRef,
  releaseRevisionRef: pageReleaseRevisionRef,
});

const resolvedWorkbenchTarget = Object.freeze({
  nodeId: 'design',
  stableTargetRef: stable('workbench', workbench.workbenchId),
  targetRevisionRef: workbenchRevisionRef,
  releaseRevisionRef: workbenchReleaseRevisionRef,
});

const navigationRelease = Object.freeze({
  contract: 'NavigationRelease',
  schemaVersion: 1,
  releaseSlotId: 'tenant.acme:test:studio:studio.headbar.primary',
  tenantScope,
  operation: 'activate',
  navigationRevisionRef,
  target: { environmentRef, surface: 'studio', placement: 'studio.headbar.primary' },
  resolvedTargets: [resolvedPageTarget, resolvedWorkbenchTarget],
  dependencySnapshot: [
    dependency('page', pageRevisionRef),
    dependency('page-release', pageReleaseRevisionRef),
    dependency('workbench', workbenchRevisionRef),
    dependency('workbench-release', workbenchReleaseRevisionRef),
    dependency('performance-budget', performanceBudgetRef),
    dependency('observation-policy', observationPolicyRevisionRef),
    dependency('compiler', compilerRevisionRef),
  ],
  evidence: releaseEvidence,
});

const stableRefAliasMap = Object.freeze({
  contract: 'StableRefAliasMap',
  schemaVersion: 1,
  tenantScope,
  aliases: [{
    aliasRef: stable('workbench', 'legacy-studio-id'),
    canonicalRef: stable('workbench', workbench.workbenchId),
    validFrom: '2026-08-28T00:00:00.000Z',
    validUntil: null,
    evidenceRef: revision('evidence', 'migration.workbench.alias'),
  }],
  contentHash: HASH_A,
});

const publicationPlan = Object.freeze({
  contract: 'PublicationPlan',
  schemaVersion: 1,
  planId: 'plan.example',
  tenantScope,
  environmentRef,
  operations: [{
    releaseKind: 'page-release',
    releaseSlotId: pageRelease.releaseSlotId,
    releaseRevisionRef: pageReleaseRevisionRef,
    expectedHeadRevisionRef: null,
  }],
  validation: { result: 'pass', inputHash: HASH_A, diagnosticRefs: [] },
  approvalPolicyRevisionRef: releaseEvidence.approvalPolicyRevisionRef,
  approvalDecisionRevisionRef: releaseEvidence.approvalDecisionRevisionRef,
  actorRef: releaseEvidence.actorRef,
  idempotencyKey: 'plan-example',
  evidenceRefs: releaseEvidence.evidenceRefs,
  createdAt: '2026-08-28T00:00:00.000Z',
});

module.exports = {
  HASH_A,
  HASH_B,
  access,
  actionSourceIntentSchemaRevisionRef,
  capabilityRevisionRef,
  compilerRevisionRef,
  dependency,
  environmentRef,
  identity,
  managementAccess,
  navigation,
  navigationRelease,
  navigationReleaseRevisionRef,
  navigationRevisionRef,
  observationPolicyRevisionRef,
  page,
  pageRelease,
  pageReleaseRevisionRef,
  pageRevisionRef,
  performanceBudgetRef,
  publicationPlan,
  providerRevisionRef,
  releaseEvidence,
  resolvedPageTarget,
  resolvedWorkbenchTarget,
  revision,
  routeSpace,
  routeMatcher,
  routeSpaceRevisionRef,
  stable,
  stableRefAliasMap,
  shellDocument,
  shellRegistration,
  shellRevisionRef,
  tenantScope,
  text,
  tokenRevisionRef,
  workbench,
  workbenchDependencySnapshot,
  workbenchRelease,
  workbenchReleaseRevisionRef,
  workbenchRevisionRef,
  workflowRevisionRef,
};
