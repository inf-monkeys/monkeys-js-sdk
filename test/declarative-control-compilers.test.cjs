'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const runtime = require('@inf-monkeys-tech/monkeys/runtime');
const {
  NavigationRuntimeBundleSchema,
  PageRuntimeBundleSchema,
  ResolvedPageSchema,
  ProductDeclarativeCapabilityRegistrationSchema,
  WorkbenchRuntimeBundleSchema,
  WorkbenchSchema,
} = require('@inf-monkeys-tech/monkeys');
const {
  access,
  actionSourceIntentSchemaRevisionRef,
  capabilityRevisionRef,
  compilerRevisionRef,
  navigation,
  navigationRelease,
  navigationReleaseRevisionRef,
  navigationRevisionRef,
  page,
  pageRelease,
  pageReleaseRevisionRef,
  pageRevisionRef,
  providerRevisionRef,
  revision,
  routeSpace,
  routeSpaceRevisionRef,
  shellRegistration,
  stable,
  workbench,
  workbenchRelease,
  workbenchReleaseRevisionRef,
  workbenchRevisionRef,
  workflowRevisionRef,
  tenantScope,
} = require('./declarative-control-fixtures.cjs');

const routeSpaces = [{ revisionRef: routeSpaceRevisionRef, routeSpace }];
const matcher = { caseSensitive: routeSpace.caseSensitive, trailingSlash: routeSpace.trailingSlash, parameters: routeSpace.parameters };
const limits = { maxNavigationNodes: 1024, maxNavigationDepth: 16, maxRenderNodes: 1024, maxRenderDepth: 32, maxWorkbenchGroups: 128, maxWorkbenchInstances: 1024 };

const pageInput = (overrides = {}) => ({
  page: overrides.page ?? page,
  pageRevisionRef: overrides.pageRevisionRef ?? pageRevisionRef,
  release: overrides.release ?? pageRelease,
  releaseRevisionRef: overrides.releaseRevisionRef ?? pageReleaseRevisionRef,
  routeSpaces,
  compilerRevisionRef,
  generation: 1,
  limits,
  capabilityRegistry: overrides.capabilityRegistry ?? [{
    capabilityRevisionRef,
    providerRevisionRef,
    propertySchemaRevisionRef: page.capabilityInstances[0].propertySchemaRevisionRef,
    accessPolicy: page.pageAccessPolicy,
    editorEligible: true,
    inputPorts: [{ name: 'items', schemaRevisionRef: revision('schema', 'render-model.inspiration.gallery', { visibility: 'global', ownerRepo: 'monkeys-data-server' }) }],
    outputPorts: [{ name: 'favorite', schemaRevisionRef: actionSourceIntentSchemaRevisionRef }],
    allowedSideEffects: ['network'],
  }],
  domainQueryRegistry: overrides.domainQueryRegistry ?? [],
  targetRegistry: overrides.targetRegistry ?? [],
  shellRegistration: overrides.shellRegistration ?? shellRegistration,
});

const workbenchTargetRegistry = [{
  stableTargetRef: stable('workflow', workflowRevisionRef.id, { ownerRepo: workflowRevisionRef.ownerRepo }),
  targetRevisionRef: workflowRevisionRef,
  accessPolicy: access({ permissionAllOf: ['workflow.run'] }),
}];

const workbenchInput = (overrides = {}) => ({
  workbench: overrides.workbench ?? workbench,
  workbenchRevisionRef: overrides.workbenchRevisionRef ?? workbenchRevisionRef,
  release: overrides.release ?? workbenchRelease,
  releaseRevisionRef: overrides.releaseRevisionRef ?? workbenchReleaseRevisionRef,
  routeSpaces,
  targetRegistry: overrides.targetRegistry ?? workbenchTargetRegistry,
  compilerRevisionRef,
  generation: 1,
  limits,
});

const navigationTargetRegistry = [{
  kind: 'route',
  stableTargetRef: stable('page', page.pageId),
  targetRevisionRef: pageRevisionRef,
  releaseRevisionRef: pageReleaseRevisionRef,
  surface: 'studio',
  accessPolicy: page.pageAccessPolicy,
  routeClaim: { kind: 'canonical', surface: 'studio', routeSpaceRevisionRef, pathTemplate: '/gallery', normalizedPath: '/gallery', matcher: { surface: 'studio', ...matcher } },
}, {
  kind: 'route',
  stableTargetRef: stable('workbench', workbench.workbenchId),
  targetRevisionRef: workbenchRevisionRef,
  releaseRevisionRef: workbenchReleaseRevisionRef,
  surface: 'studio',
  accessPolicy: workbench.workbenchAccessPolicy,
  routeClaim: { kind: 'canonical', surface: 'studio', routeSpaceRevisionRef, pathTemplate: '/studio/:workbenchId', normalizedPath: '/studio/:workbenchId', matcher: { surface: 'studio', ...matcher } },
}];

const navigationInput = (overrides = {}) => ({
  navigation: overrides.navigation ?? navigation,
  navigationRevisionRef: overrides.navigationRevisionRef ?? navigationRevisionRef,
  release: overrides.release ?? navigationRelease,
  releaseRevisionRef: overrides.releaseRevisionRef ?? navigationReleaseRevisionRef,
  targetRegistry: overrides.targetRegistry ?? navigationTargetRegistry,
  compilerRevisionRef,
  generation: 1,
  limits: overrides.limits ?? limits,
});

test('compiles PageRuntimeBundle deterministically from one exact release and registry', () => {
  const first = runtime.compilePageRuntimeBundle(pageInput());
  const second = runtime.compilePageRuntimeBundle(pageInput());
  assert.equal(first.contract, 'PageRuntimeBundle');
  assert.equal(first.contentHash, second.contentHash);
  assert.equal(first.routeClaims[0].normalizedPath, '/gallery');
  assert.equal(first.rebuildable, true);
  assert.deepEqual(first.shellDescriptor, {
    shellRevisionRef: page.shellRevisionRef,
    header: { enabled: true, navigationPlacement: 'studio.headbar.primary' },
  });
  assert.deepEqual(first.ontologyBindings, page.ontologyBindings);
  assert.deepEqual(first.stateDefinitions, []);
  const {
    stateDefinitions: _stateDefinitions,
    interactionBindings: _interactionBindings,
    queryBindings: _queryBindings,
    ...legacyBundle
  } = first;
  assert.deepEqual(PageRuntimeBundleSchema.parse(legacyBundle).stateDefinitions, []);
  assert.deepEqual(PageRuntimeBundleSchema.parse(legacyBundle).interactionBindings, []);
  assert.deepEqual(PageRuntimeBundleSchema.parse(legacyBundle).queryBindings, []);
  assert.deepEqual(first.interactionBindings, []);
  assert.deepEqual(first.queryBindings, []);
  assert.equal(Object.hasOwn(first, 'businessRecords'), false);
});

test('Page compiler projects typed state/interactions and exact governed Domain Queries', () => {
  const stateSchemaRevisionRef = revision('schema', 'page-state.gallery-filter', { visibility: 'global' });
  const queryInputSchemaRevisionRef = revision('schema', 'query.inspiration.input', { visibility: 'global' });
  const pageChangeIntentSchemaRevisionRef = revision('schema', 'intent.gallery.page-change', {
    visibility: 'global',
    ownerRepo: 'monkeys-design',
  });
  const domainQueryDefinition = {
    contract: 'DomainQueryDefinition',
    schemaVersion: 1,
    queryId: 'query.inspiration.gallery',
    tenantScope,
    ontologyDefinitionRevisionRef: page.ontologyBindings[0].ontologyDefinitionRevisionRef,
    viewRevisionRef: page.ontologyBindings[0].viewRevisionRef,
    canonicalDataViewRevisionRef: page.ontologyBindings[0].canonicalDataViewRevisionRef,
    inputSchemaRevisionRef: queryInputSchemaRevisionRef,
    resultSchemaRevisionRef: page.ontologyBindings[0].renderModelSchemaRevisionRef,
    accessPolicy: page.pageAccessPolicy,
    lineageRequired: true,
  };
  const queryDefinitionRevisionRef = revision('domain-query-definition', domainQueryDefinition.queryId, {
    contentHash: runtime.canonicalContentHash(domainQueryDefinition),
  });
  const statefulPage = {
    ...page,
    capabilityInstances: [{
      ...page.capabilityInstances[0],
      activationWhen: { operator: 'all', conditions: [{ stateId: 'gallery-filter', predicate: 'truthy' }] },
    }],
    stateDefinitions: [{ stateId: 'gallery-filter', schemaRevisionRef: stateSchemaRevisionRef, defaultValue: {}, persistence: 'url' }],
    interactionBindings: [{
      bindingId: 'update-gallery-filter',
      source: { capabilityInstanceId: 'gallery', port: 'favorite' },
      sourceIntentSchemaRevisionRef: page.actionBindings[0].sourceIntentSchemaRevisionRef,
      targetStateId: 'gallery-filter',
      transition: 'merge',
      inputMapping: { recordId: { kind: 'intent-field', path: 'recordId' } },
    }],
    queryBindings: [{
      bindingId: 'inspiration-query',
      queryDefinitionRevisionRef,
      parameters: {
        teamId: { kind: 'identity', name: 'teamId' },
        filters: { kind: 'page-state', stateId: 'gallery-filter' },
      },
      target: { capabilityInstanceId: 'gallery', port: 'items' },
      renderModelSchemaRevisionRef: page.ontologyBindings[0].renderModelSchemaRevisionRef,
      pagination: 'cursor',
      cursorWindow: {
        pageChangePort: 'capability.gallery.page-change',
        pageChangeIntentSchemaRevisionRef,
      },
      cache: 'identity-scoped',
      cancelOnChange: true,
    }],
  };
  const dependencies = [
    { role: 'query-definition', revisionRef: queryDefinitionRevisionRef },
    { role: 'schema', revisionRef: stateSchemaRevisionRef },
    { role: 'schema', revisionRef: queryInputSchemaRevisionRef },
    { role: 'schema', revisionRef: pageChangeIntentSchemaRevisionRef },
  ];
  const input = pageInput({
    page: statefulPage,
    release: { ...pageRelease, dependencySnapshot: [...pageRelease.dependencySnapshot, ...dependencies] },
    domainQueryRegistry: [{ definitionRevisionRef: queryDefinitionRevisionRef, definition: domainQueryDefinition }],
    capabilityRegistry: [{
      ...pageInput().capabilityRegistry[0],
      outputPorts: [
        ...pageInput().capabilityRegistry[0].outputPorts,
        { name: 'capability.gallery.page-change', schemaRevisionRef: pageChangeIntentSchemaRevisionRef },
      ],
    }],
  });
  const bundle = runtime.compilePageRuntimeBundle(input);

  assert.deepEqual(bundle.stateDefinitions, statefulPage.stateDefinitions);
  assert.deepEqual(bundle.interactionBindings, statefulPage.interactionBindings);
  assert.deepEqual(bundle.queryBindings, statefulPage.queryBindings.map((binding) => ({ ...binding, execution: 'server' })));
  assert.deepEqual(bundle.capabilityInstances[0].activationWhen, statefulPage.capabilityInstances[0].activationWhen);
  assert.throws(
    () => runtime.compilePageRuntimeBundle({ ...input, domainQueryRegistry: [] }),
    (error) => error.code === 'QUERY_DEFINITION_MISMATCH',
  );
  assert.throws(
    () => runtime.compilePageRuntimeBundle({
      ...input,
      domainQueryRegistry: [{
        definitionRevisionRef: { ...queryDefinitionRevisionRef, contentHash: '0'.repeat(64) },
        definition: domainQueryDefinition,
      }],
    }),
    (error) => error.code === 'QUERY_DEFINITION_MISMATCH',
  );
  assert.throws(
    () => runtime.compilePageRuntimeBundle({
      ...input,
      page: {
        ...statefulPage,
        interactionBindings: [{ ...statefulPage.interactionBindings[0], sourceIntentSchemaRevisionRef: queryInputSchemaRevisionRef }],
      },
    }),
    (error) => error.code === 'PORT_TYPE_MISMATCH' && error.path.startsWith('interactionBindings[0]'),
  );
  assert.throws(
    () => runtime.compilePageRuntimeBundle({
      ...input,
      capabilityRegistry: [{
        ...input.capabilityRegistry[0],
        outputPorts: input.capabilityRegistry[0].outputPorts.filter(
          ({ name }) => name !== 'capability.gallery.page-change',
        ),
      }],
    }),
    (error) => error.code === 'PORT_TYPE_MISMATCH' && error.path.includes('cursorWindow.pageChangePort'),
  );
  assert.throws(
    () => runtime.compilePageRuntimeBundle({
      ...input,
      release: {
        ...input.release,
        dependencySnapshot: input.release.dependencySnapshot.filter((entry) => entry.role !== 'query-definition'),
      },
    }),
    (error) => error.code === 'DEPENDENCY_MISSING',
  );
});

test('Page compiler preserves governed live catalog queries without invented dependencies', () => {
  const inputSchemaRevisionRef = revision('schema', 'query.tags.input', { visibility: 'global' });
  const definition = {
    contract: 'DomainQueryDefinition',
    schemaVersion: 1,
    queryId: 'query.tags',
    tenantScope,
    dataSource: {
      kind: 'governed-catalog',
      resourceKind: 'tag',
    },
    handlerRef: {
      kind: 'domain-query-handler',
      id: 'catalog.tags.list',
      version: '2',
      ownerRepo: 'monkeys-server',
    },
    inputSchemaRevisionRef,
    resultSchemaRevisionRef: page.ontologyBindings[0].renderModelSchemaRevisionRef,
    accessPolicy: page.pageAccessPolicy,
    lineageRequired: true,
  };
  const definitionRevisionRef = revision('domain-query-definition', definition.queryId, {
    contentHash: runtime.canonicalContentHash(definition),
  });
  const catalogPage = {
    ...page,
    queryBindings: [{
      bindingId: 'tags-query',
      queryDefinitionRevisionRef: definitionRevisionRef,
      parameters: {},
      target: { capabilityInstanceId: 'gallery', port: 'items' },
      renderModelSchemaRevisionRef: definition.resultSchemaRevisionRef,
      execution: 'server',
      pagination: 'cursor',
      cache: 'tenant-scoped',
      cancelOnChange: true,
    }],
  };
  const exactDependencies = [
    { role: 'query-definition', revisionRef: definitionRevisionRef },
    { role: 'schema', revisionRef: inputSchemaRevisionRef },
  ];
  const input = pageInput({
    page: catalogPage,
    release: { ...pageRelease, dependencySnapshot: [...pageRelease.dependencySnapshot, ...exactDependencies] },
    domainQueryRegistry: [{ definitionRevisionRef, definition }],
  });

  const bundle = runtime.compilePageRuntimeBundle(input);
  assert.deepEqual(bundle.queryBindings, catalogPage.queryBindings);
  assert.equal(input.release.dependencySnapshot.some((entry) => entry.role === 'governed-catalog' || entry.role === 'query-handler'), false);
});

test('Page compiler distinguishes local Page-state queries from Server queries', () => {
  const stateSchemaRevisionRef = revision('schema', 'page-state.filter', { visibility: 'global' });
  const inputSchemaRevisionRef = revision('schema', 'query.page-state.input', { visibility: 'global' });
  const definition = {
    contract: 'DomainQueryDefinition',
    schemaVersion: 1,
    queryId: 'query.page-state.context',
    tenantScope,
    dataSource: { kind: 'page-state' },
    handlerRef: { kind: 'domain-query-handler', id: 'page-state.context', version: '1', ownerRepo: 'monkeys' },
    inputSchemaRevisionRef,
    resultSchemaRevisionRef: page.ontologyBindings[0].renderModelSchemaRevisionRef,
    accessPolicy: page.pageAccessPolicy,
    lineageRequired: true,
  };
  const definitionRevisionRef = revision('domain-query-definition', definition.queryId, {
    contentHash: runtime.canonicalContentHash(definition),
  });
  const localPage = {
    ...page,
    stateDefinitions: [{ stateId: 'filter', schemaRevisionRef: stateSchemaRevisionRef, defaultValue: '', persistence: 'url' }],
    queryBindings: [{
      bindingId: 'filter-context',
      queryDefinitionRevisionRef: definitionRevisionRef,
      parameters: { filter: { kind: 'page-state', stateId: 'filter' } },
      target: { capabilityInstanceId: 'gallery', port: 'items' },
      renderModelSchemaRevisionRef: definition.resultSchemaRevisionRef,
      execution: 'local-state',
      pagination: 'none',
      cache: 'none',
      cancelOnChange: false,
    }],
  };
  const release = {
    ...pageRelease,
    dependencySnapshot: [
      ...pageRelease.dependencySnapshot,
      { role: 'schema', revisionRef: stateSchemaRevisionRef },
      { role: 'query-definition', revisionRef: definitionRevisionRef },
      { role: 'schema', revisionRef: inputSchemaRevisionRef },
    ],
  };
  const input = pageInput({
    page: localPage,
    release,
    domainQueryRegistry: [{ definitionRevisionRef, definition }],
  });
  assert.equal(runtime.compilePageRuntimeBundle(input).queryBindings[0].execution, 'local-state');
  assert.throws(
    () => runtime.compilePageRuntimeBundle({
      ...input,
      page: { ...localPage, queryBindings: [{ ...localPage.queryBindings[0], execution: 'server' }] },
    }),
    (error) => error.code === 'QUERY_DEFINITION_MISMATCH',
  );
});

test('Page compiler resolves ordered entry transitions to exact governed routes and preserves declarative Release provenance', () => {
  const stateSchemaRevisionRef = revision('schema', 'page-state.workbench', { visibility: 'global' });
  const target = { ...navigationTargetRegistry[1], accessPolicy: page.pageAccessPolicy };
  const transitionPage = {
    ...page,
    stateDefinitions: [{ stateId: 'workbenchId', schemaRevisionRef: stateSchemaRevisionRef, persistence: 'url' }],
    entryTransitions: [{
      transitionId: 'open-workbench',
      activation: { operator: 'all', conditions: [{ stateId: 'workbenchId', predicate: 'truthy' }] },
      targetRef: target.stableTargetRef,
      pathParameters: { workbenchId: { kind: 'page-state', stateId: 'workbenchId' } },
      query: { preserve: true, remove: ['workbenchId'], set: {} },
    }],
  };
  const release = {
    ...pageRelease,
    dependencySnapshot: [
      ...pageRelease.dependencySnapshot,
      { role: 'schema', revisionRef: stateSchemaRevisionRef },
      { role: 'workbench', revisionRef: target.targetRevisionRef },
      { role: 'workbench-release', revisionRef: target.releaseRevisionRef },
    ],
  };
  const input = pageInput({ page: transitionPage, release, targetRegistry: [target] });
  const bundle = runtime.compilePageRuntimeBundle(input);
  assert.equal(bundle.entryTransitions[0].targetRevisionRef.id, workbench.workbenchId);
  assert.equal(bundle.entryTransitions[0].targetRouteClaim.normalizedPath, '/studio/:workbenchId');
  assert.throws(
    () => runtime.compilePageRuntimeBundle({ ...input, targetRegistry: [] }),
    (error) => error.code === 'PAGE_ENTRY_TARGET_UNRELEASED',
  );
  const staticTarget = {
    ...target,
    releaseRevisionRef: undefined,
    accessPolicy: {
      ...target.accessPolicy,
      permissionAllOf: [...target.accessPolicy.permissionAllOf, 'dashboard.read'],
    },
  };
  const staticRelease = {
    ...release,
    dependencySnapshot: release.dependencySnapshot.filter((entry) => entry.role !== 'workbench-release'),
  };
  const staticBundle = runtime.compilePageRuntimeBundle({ ...input, release: staticRelease, targetRegistry: [staticTarget] });
  assert.equal(staticBundle.entryTransitions[0].targetRevisionRef.id, workbench.workbenchId);
  assert.equal(staticBundle.entryTransitions[0].targetReleaseRevisionRef, undefined);
  assert.deepEqual(staticBundle.entryTransitions[0].targetAccessPolicy.permissionAllOf, staticTarget.accessPolicy.permissionAllOf);
  assert.throws(
    () => runtime.compilePageRuntimeBundle({
      ...input,
      page: {
        ...transitionPage,
        entryTransitions: [{ ...transitionPage.entryTransitions[0], pathParameters: {} }],
      },
    }),
    (error) => error.code === 'ROUTE_SPACE_MISMATCH',
  );
});

test('Page compiler resolves one exact surface Shell descriptor and fails closed on mismatches', () => {
  assert.throws(
    () => runtime.compilePageRuntimeBundle(pageInput({ shellRegistration: { ...shellRegistration, resourceRevisionRef: { ...shellRegistration.resourceRevisionRef, contentHash: '0'.repeat(64) } } })),
    (error) => error.code === 'SHELL_REVISION_MISMATCH' && error.path === 'shellRegistration',
  );
  assert.throws(
    () => runtime.compilePageRuntimeBundle(pageInput({ shellRegistration: { ...shellRegistration, supportedSurfaces: ['kernel'], document: { ...shellRegistration.document, surfaceChrome: [{ surface: 'kernel', header: { enabled: false } }] } } })),
    (error) => error.code === 'SHELL_REVISION_MISMATCH' || error.code === 'SHELL_SURFACE_MISMATCH',
  );
});

test('Page compiler rejects missing dependencies, unregistered providers, and competing RenderTree bindings', () => {
  assert.throws(
    () => runtime.compilePageRuntimeBundle(pageInput({ release: { ...pageRelease, dependencySnapshot: pageRelease.dependencySnapshot.slice(1) } })),
    (error) => error.code === 'DEPENDENCY_MISSING',
  );
  const withoutCanonicalDataView = pageRelease.dependencySnapshot.filter((entry) =>
    entry.revisionRef.id !== page.ontologyBindings[0].canonicalDataViewRevisionRef.id);
  assert.throws(
    () => runtime.compilePageRuntimeBundle(pageInput({ release: { ...pageRelease, dependencySnapshot: withoutCanonicalDataView } })),
    (error) => error.code === 'DEPENDENCY_MISSING',
  );
  assert.doesNotThrow(() =>
    runtime.compilePageRuntimeBundle({
      ...pageInput(),
      capabilityRegistry: [{ ...pageInput().capabilityRegistry[0], editorEligible: false }],
    }),
  );
  assert.throws(
    () => runtime.compilePageRuntimeBundle({ ...pageInput(), capabilityRegistry: [] }),
    (error) => error.code === 'CAPABILITY_BINDING_MISMATCH' && error.path === 'capabilityInstances[0]',
  );
  assert.throws(
    () => runtime.compilePageRuntimeBundle({ ...pageInput(), capabilityRegistry: [{ ...pageInput().capabilityRegistry[0], propertySchemaRevisionRef: page.ontologyBindings[0].renderModelSchemaRevisionRef }] }),
    (error) => error.code === 'CAPABILITY_BINDING_MISMATCH' && error.path.endsWith('propertySchemaRevisionRef'),
  );
  assert.throws(
    () => runtime.compilePageRuntimeBundle({ ...pageInput(), capabilityRegistry: [{ ...pageInput().capabilityRegistry[0], accessPolicy: access({ permissionAllOf: ['capability.restricted'] }) }] }),
    (error) => error.code === 'AUDIENCE_WIDER_THAN_TARGET',
  );
  assert.throws(
    () => runtime.compilePageRuntimeBundle(pageInput({
      page: {
        ...page,
        capabilityInstances: [...page.capabilityInstances, { ...page.capabilityInstances[0], instanceId: 'gallery-copy' }],
      },
    })),
    (error) => error.code === 'CAPABILITY_BINDING_MISMATCH',
  );
  const unmanagedNode = { ...page.renderTree.nodes[0], nodeId: 'gallery-copy', parentNodeId: 'gallery', children: [], activation: { ...page.renderTree.nodes[0].activation, activationId: 'gallery-copy' } };
  assert.throws(
    () => runtime.compilePageRuntimeBundle(pageInput({
      page: {
        ...page,
        renderTree: {
          ...page.renderTree,
          nodes: [{ ...page.renderTree.nodes[0], children: ['gallery-copy'] }, unmanagedNode],
        },
      },
    })),
    (error) => error.code === 'CAPABILITY_BINDING_MISMATCH',
  );
  assert.throws(
    () => runtime.compilePageRuntimeBundle({ ...pageInput(), capabilityRegistry: [pageInput().capabilityRegistry[0], pageInput().capabilityRegistry[0]] }),
    (error) => error.code === 'REGISTRY_CONFLICT',
  );
  assert.throws(
    () => runtime.compilePageRuntimeBundle({
      ...pageInput(),
      capabilityRegistry: [{
        ...pageInput().capabilityRegistry[0],
        outputPorts: [{ name: 'favorite', schemaRevisionRef: page.actionBindings[0].inputSchemaRevisionRef }],
      }],
    }),
    (error) => error.code === 'PORT_TYPE_MISMATCH' && error.path === 'actionBindings[0].sourceIntentSchemaRevisionRef',
  );
  const mismatchedTree = {
    ...page,
    renderTree: {
      ...page.renderTree,
      nodes: page.renderTree.nodes.map((node) => ({
        ...node,
        capabilityRef: { ...node.capabilityRef, id: 'other.capability' },
      })),
    },
  };
  assert.throws(
    () => runtime.compilePageRuntimeBundle(pageInput({ page: mismatchedTree })),
    (error) => error.code === 'CAPABILITY_BINDING_MISMATCH',
  );
  assert.throws(
    () => runtime.compilePageRuntimeBundle(pageInput({
      pageRevisionRef: {
        ...pageRevisionRef,
        tenantScope: {
          ...pageRevisionRef.tenantScope,
          tenantRef: { ...pageRevisionRef.tenantScope.tenantRef, ownerRepo: 'other-tenant-authority' },
        },
      },
    })),
    (error) => error.code === 'CROSS_TENANT_REFERENCE',
  );
});

test('Page compiler rejects cyclic and disconnected cyclic RenderTrees without traversal hangs', () => {
  const baseNode = page.renderTree.nodes[0];
  const cycleNodes = [
    {
      ...baseNode,
      nodeId: 'cycle-a',
      parentNodeId: 'cycle-b',
      children: ['cycle-b'],
      activation: { ...baseNode.activation, activationId: 'cycle-a' },
    },
    {
      ...baseNode,
      nodeId: 'cycle-b',
      parentNodeId: 'cycle-a',
      children: ['cycle-a'],
      activation: { ...baseNode.activation, activationId: 'cycle-b' },
    },
  ];
  assert.throws(
    () => runtime.compilePageRuntimeBundle(pageInput({
      page: { ...page, renderTree: { ...page.renderTree, nodes: [...page.renderTree.nodes, ...cycleNodes] } },
    })),
    (error) => error.code === 'RENDER_TREE_INVALID',
  );
  assert.throws(
    () => runtime.compilePageRuntimeBundle(pageInput({
      page: {
        ...page,
        renderTree: {
          ...page.renderTree,
          nodes: [
            { ...cycleNodes[0], nodeId: page.renderTree.rootNodeId, parentNodeId: 'cycle-b', children: ['cycle-b'] },
            { ...cycleNodes[1], parentNodeId: page.renderTree.rootNodeId, children: [page.renderTree.rootNodeId] },
          ],
        },
      },
    })),
    (error) => error.code === 'RENDER_TREE_INVALID',
  );
});

test('runtime compilers refuse to materialize deactivation releases', () => {
  assert.throws(
    () => runtime.compilePageRuntimeBundle(pageInput({ release: { ...pageRelease, operation: 'deactivate' } })),
    (error) => error.code === 'RELEASE_OPERATION_INVALID',
  );
  assert.throws(
    () => runtime.compileWorkbenchRuntimeBundle(workbenchInput({ release: { ...workbenchRelease, operation: 'deactivate' } })),
    (error) => error.code === 'RELEASE_OPERATION_INVALID',
  );
  assert.throws(
    () => runtime.compileNavigationRuntimeBundle(navigationInput({ release: { ...navigationRelease, operation: 'deactivate' } })),
    (error) => error.code === 'RELEASE_OPERATION_INVALID',
  );
});

test('runtime compilers fail closed when Release governance evidence crosses tenant scope', () => {
  const otherTenantScope = {
    ...tenantScope,
    tenantRef: { ...tenantScope.tenantRef, id: 'tenant.other' },
  };
  const crossTenantEvidence = (release) => ({
    ...release,
    evidence: {
      ...release.evidence,
      actorRef: { ...release.evidence.actorRef, visibility: 'tenant', tenantScope: otherTenantScope },
    },
  });
  assert.throws(() => runtime.compilePageRuntimeBundle(pageInput({ release: crossTenantEvidence(pageRelease) })));
  assert.throws(() => runtime.compileWorkbenchRuntimeBundle(workbenchInput({ release: crossTenantEvidence(workbenchRelease) })));
  assert.throws(() => runtime.compileNavigationRuntimeBundle(navigationInput({ release: crossTenantEvidence(navigationRelease) })));
});

test('public runtime bundle schemas reject mismatched refs and model empty Workbench projections explicitly', () => {
  const pageBundle = runtime.compilePageRuntimeBundle(pageInput());
  const workbenchBundle = runtime.compileWorkbenchRuntimeBundle(workbenchInput());
  const navigationBundle = runtime.compileNavigationRuntimeBundle(navigationInput());
  const otherTenantScope = {
    ...pageBundle.tenantScope,
    tenantRef: { ...pageBundle.tenantScope.tenantRef, id: 'tenant.other' },
  };

  assert.equal(PageRuntimeBundleSchema.safeParse({
    ...pageBundle,
    pageRevisionRef: { ...pageBundle.pageRevisionRef, id: 'page.other' },
  }).success, false);
  assert.equal(PageRuntimeBundleSchema.safeParse({
    ...pageBundle,
    releaseRevisionRef: { ...pageBundle.releaseRevisionRef, kind: 'workbench-release' },
  }).success, false);
  assert.equal(PageRuntimeBundleSchema.safeParse({
    ...pageBundle,
    compilerRevisionRef: { ...pageBundle.compilerRevisionRef, kind: 'schema' },
  }).success, false);
  assert.equal(PageRuntimeBundleSchema.safeParse({
    ...pageBundle,
    pageRevisionRef: { ...pageBundle.pageRevisionRef, tenantScope: otherTenantScope },
  }).success, false);

  assert.equal(WorkbenchRuntimeBundleSchema.safeParse({ ...workbenchBundle, defaultEntry: null }).success, false);
  const emptyWorkbenchBundle = { ...workbenchBundle, groups: [], appInstances: [], defaultEntry: null };
  assert.equal(WorkbenchRuntimeBundleSchema.safeParse(emptyWorkbenchBundle).success, true);
  assert.equal(WorkbenchRuntimeBundleSchema.safeParse({ ...emptyWorkbenchBundle, defaultEntry: workbenchBundle.defaultEntry }).success, false);
  assert.equal(WorkbenchRuntimeBundleSchema.safeParse({
    ...workbenchBundle,
    defaultEntry: { ...workbenchBundle.defaultEntry, instanceId: 'hidden-instance' },
  }).success, false);
  assert.equal(WorkbenchRuntimeBundleSchema.safeParse({
    ...workbenchBundle,
    workbenchRevisionRef: { ...workbenchBundle.workbenchRevisionRef, id: 'workbench.other' },
  }).success, false);
  assert.equal(WorkbenchSchema.safeParse({ ...workbench, defaultEntry: null }).success, false);

  assert.equal(NavigationRuntimeBundleSchema.safeParse({
    ...navigationBundle,
    navigationRevisionRef: { ...navigationBundle.navigationRevisionRef, kind: 'page' },
  }).success, false);
  assert.equal(NavigationRuntimeBundleSchema.safeParse({
    ...navigationBundle,
    navigationRevisionRef: { ...navigationBundle.navigationRevisionRef, id: 'navigation.other' },
  }).success, false);
});

test('RouteSpace is the sole normalizer and blocks reserved or colliding claims', () => {
  const claims = runtime.compileRouteClaims({
    claims: page.routeClaims,
    routeSpaces,
    surface: 'studio',
  });
  assert.equal(claims[0].normalizedPath, '/gallery');
  assert.deepEqual(claims[0].matcher, {
    surface: 'studio',
    caseSensitive: false,
    trailingSlash: 'remove',
    parameters: routeSpace.parameters,
  });
  assert.deepEqual(runtime.matchCompiledRouteClaim(claims[0], '/GALLERY/'), {
    matched: true,
    normalizedPath: '/gallery',
    parameters: {},
  });
  const typedClaims = runtime.compileRouteClaims({
    claims: [{ ...page.routeClaims[0], pathTemplate: '/customers/:customerId' }],
    routeSpaces: [{
      revisionRef: routeSpaceRevisionRef,
      routeSpace: { ...routeSpace, parameters: [...routeSpace.parameters, { name: 'customerId', type: 'uuid', required: true }] },
    }],
    surface: 'studio',
  });
  assert.equal(runtime.matchCompiledRouteClaim(typedClaims[0], '/customers/550e8400-e29b-41d4-a716-446655440000').matched, true);
  assert.equal(runtime.matchCompiledRouteClaim(typedClaims[0], '/customers/not-a-uuid').matched, false);
  for (const [trailingSlash, accepted, rejected] of [
    ['remove', '/gallery/', null],
    ['require', '/gallery/', '/gallery'],
    ['preserve', '/gallery/', '/gallery'],
  ]) {
    const [compiled] = runtime.compileRouteClaims({
      claims: page.routeClaims,
      routeSpaces: [{ revisionRef: routeSpaceRevisionRef, routeSpace: { ...routeSpace, trailingSlash } }],
      surface: 'studio',
    });
    assert.equal(runtime.matchCompiledRouteClaim(compiled, accepted).matched, true);
    if (rejected) assert.equal(runtime.matchCompiledRouteClaim(compiled, rejected).matched, false);
  }
  assert.throws(
    () => runtime.compileRouteClaims({
      claims: [{ ...page.routeClaims[0], pathTemplate: '/settings/users' }],
      routeSpaces,
      surface: 'studio',
    }),
    (error) => error.code === 'ROUTE_RESERVED',
  );
  assert.throws(
    () => runtime.compileRouteClaims({
      claims: [page.routeClaims[0], { ...page.routeClaims[0], kind: 'alias', pathTemplate: '/gallery' }],
      routeSpaces,
      surface: 'studio',
    }),
    (error) => error.code === 'ROUTE_CONFLICT',
  );
  const overlapRouteSpace = {
    ...routeSpace,
    reservedPaths: [],
    parameters: [
      ...routeSpace.parameters,
      { name: 'identifier', type: 'identifier', required: true },
      { name: 'slug', type: 'slug', required: true },
      { name: 'integer', type: 'integer', required: true },
      { name: 'uuid', type: 'uuid', required: true },
    ],
  };
  assert.throws(
    () => runtime.compileRouteClaims({
      claims: [
        { ...page.routeClaims[0], pathTemplate: '/customers/:identifier' },
        { ...page.routeClaims[0], kind: 'alias', pathTemplate: '/customers/fixed' },
      ],
      routeSpaces: [{ revisionRef: routeSpaceRevisionRef, routeSpace: overlapRouteSpace }],
      surface: 'studio',
    }),
    (error) => error.code === 'ROUTE_CONFLICT',
  );
  assert.throws(
    () => runtime.compileRouteClaims({
      claims: [
        { ...page.routeClaims[0], pathTemplate: '/customers/:identifier' },
        { ...page.routeClaims[0], kind: 'alias', pathTemplate: '/customers/:slug' },
      ],
      routeSpaces: [{ revisionRef: routeSpaceRevisionRef, routeSpace: overlapRouteSpace }],
      surface: 'studio',
    }),
    (error) => error.code === 'ROUTE_CONFLICT',
  );
  assert.equal(runtime.compileRouteClaims({
    claims: [
      { ...page.routeClaims[0], pathTemplate: '/customers/:integer' },
      { ...page.routeClaims[0], kind: 'alias', pathTemplate: '/customers/:uuid' },
    ],
    routeSpaces: [{ revisionRef: routeSpaceRevisionRef, routeSpace: overlapRouteSpace }],
    surface: 'studio',
  }).length, 2);
  assert.throws(
    () => runtime.compileRouteClaims({
      claims: page.routeClaims,
      routeSpaces: [{ revisionRef: routeSpaceRevisionRef, routeSpace: { ...routeSpace, routeSpaceId: 'other-space' } }],
      surface: 'studio',
    }),
    (error) => error.code === 'ROUTE_SPACE_MISMATCH',
  );
  assert.equal(runtime.materializeRouteSpacePath({ routeSpace, applicationPath: claims[0].normalizedPath, parameters: { teamId: 'team-1' } }), '/team-1/gallery');
  assert.equal(runtime.materializeRouteSpacePath({
    routeSpace: { ...routeSpace, routeSpaceId: 'kernel.root', supportedSurface: 'kernel', basePath: '/kernel', parameters: [] },
    applicationPath: '/gallery',
  }), '/kernel/gallery');
  assert.throws(
    () => runtime.materializeRouteSpacePath({ routeSpace, applicationPath: '/gallery' }),
    (error) => error.code === 'ROUTE_SPACE_MISMATCH',
  );
});

test('route claims belong to one exact surface and compile without a surface cross product', () => {
  const kernelRouteSpaceRevisionRef = revision('route-space', 'kernel.root', { visibility: 'global' });
  const kernelRouteSpace = {
    ...routeSpace,
    routeSpaceId: 'kernel.root',
    supportedSurface: 'kernel',
    basePath: '/kernel',
    reservedPaths: [],
    parameters: [],
  };
  const claims = [
    { kind: 'canonical', surface: 'studio', routeSpaceRevisionRef, pathTemplate: '/gallery' },
    { kind: 'alias', surface: 'studio', routeSpaceRevisionRef, pathTemplate: '/gallery-alias' },
    { kind: 'canonical', surface: 'kernel', routeSpaceRevisionRef: kernelRouteSpaceRevisionRef, pathTemplate: '/gallery' },
    { kind: 'alias', surface: 'kernel', routeSpaceRevisionRef: kernelRouteSpaceRevisionRef, pathTemplate: '/gallery-alias' },
  ];
  const registrations = [...routeSpaces, { revisionRef: kernelRouteSpaceRevisionRef, routeSpace: kernelRouteSpace }];
  const studioClaims = runtime.compileRouteClaims({ claims, routeSpaces: registrations, surface: 'studio' });
  const kernelClaims = runtime.compileRouteClaims({ claims, routeSpaces: registrations, surface: 'kernel' });
  assert.deepEqual(studioClaims.map((claim) => [claim.surface, claim.normalizedPath]), [
    ['studio', '/gallery'],
    ['studio', '/gallery-alias'],
  ]);
  assert.deepEqual(kernelClaims.map((claim) => [claim.surface, claim.normalizedPath]), [
    ['kernel', '/gallery'],
    ['kernel', '/gallery-alias'],
  ]);
  assert.equal(studioClaims.every((claim) => claim.matcher.surface === 'studio'), true);
  assert.equal(kernelClaims.every((claim) => claim.matcher.surface === 'kernel'), true);
  assert.equal(ResolvedPageSchema.safeParse({ ...page, supportedSurfaces: ['studio', 'kernel'], routeClaims: claims }).success, true);
  assert.equal(ResolvedPageSchema.safeParse({
    ...page,
    routeClaims: [page.routeClaims[0], claims[1]],
  }).success, false);
  assert.equal(ResolvedPageSchema.safeParse({
    ...page,
    supportedSurfaces: ['studio', 'kernel'],
    routeClaims: [...claims, { ...claims[0], pathTemplate: '/gallery-second-canonical' }],
  }).success, false);
  assert.equal(ResolvedPageSchema.safeParse({
    ...page,
    supportedSurfaces: ['studio', 'kernel'],
    routeClaims: claims.map((claim) => claim.surface === 'kernel' && claim.kind === 'canonical' ? { ...claim, kind: 'alias' } : claim),
  }).success, false);
  assert.throws(
    () => runtime.compileRouteClaims({ claims: [{ ...claims[0], surface: 'kernel' }], routeSpaces: registrations, surface: 'kernel' }),
    (error) => error.code === 'ROUTE_SPACE_MISMATCH',
  );
});

test('Runtime Bundle projection ids fence exact Release revisions at fixed length', () => {
  const releaseSlotId = 'slot.' + 'x'.repeat(120);
  const first = runtime.declarativeRuntimeProjectionId('page', releaseSlotId, pageReleaseRevisionRef);
  const replay = runtime.declarativeRuntimeProjectionId('page', releaseSlotId, pageReleaseRevisionRef);
  const next = runtime.declarativeRuntimeProjectionId('page', releaseSlotId, { ...pageReleaseRevisionRef, revision: 2 });
  assert.equal(first, replay);
  assert.notEqual(first, next);
  assert.equal(first.length, 68);
  assert.ok(first.length < 256);
});

test('Route owner index projection ids are stable tenant, environment and surface identities', () => {
  const first = runtime.declarativeRouteOwnerIndexProjectionId(page.tenantScope, pageRelease.target.environmentRef, 'studio');
  const replay = runtime.declarativeRouteOwnerIndexProjectionId(page.tenantScope, pageRelease.target.environmentRef, 'studio');
  const kernel = runtime.declarativeRouteOwnerIndexProjectionId(page.tenantScope, pageRelease.target.environmentRef, 'kernel');
  const differentAuthority = runtime.declarativeRouteOwnerIndexProjectionId(
    page.tenantScope,
    { ...pageRelease.target.environmentRef, ownerRepo: 'other-product' },
    'studio',
  );
  assert.equal(first, replay);
  assert.notEqual(first, kernel);
  assert.notEqual(first, differentAuthority);
  assert.equal(first.length, 68);
  assert.ok(first.length < 256);
});

test('route takeover authorization is exact and cannot bypass reserved aliases or prefixes', () => {
  const authorization = runtime.compileLegacyRouteTakeoverAuthorization({
    contract: 'LegacyRouteTakeoverAuthorization',
    schemaVersion: 1,
    routeSpaceRevisionRef,
    normalizedPath: '/settings',
    legacyAdapterRevisionRef: revision('legacy-route-adapter', 'kernel.settings', { visibility: 'global', ownerRepo: 'monkeys' }),
    sourceRevisionRef: revision('legacy-route-source', 'kernel.settings', { visibility: 'global', ownerRepo: 'monkeys' }),
    inspectedSourceContentHash: 'a'.repeat(64),
    targetResourceRef: stable('page', page.pageId),
  });
  const [claim] = runtime.compileRouteClaims({
    claims: [{ ...page.routeClaims[0], pathTemplate: '/settings' }],
    routeSpaces,
    surface: 'studio',
    legacyRouteTakeoverAuthorizations: [authorization],
  });
  assert.equal(claim.kind, 'canonical');
  assert.equal(claim.normalizedPath, '/settings');
  const authoringPage = ResolvedPageSchema.parse({
    ...page,
    routeClaims: [{ ...page.routeClaims[0], pathTemplate: '/settings', legacyRouteTakeoverAuthorization: authorization }],
  });
  const [embeddedClaim] = runtime.compileRouteClaims({ claims: authoringPage.routeClaims, routeSpaces, surface: 'studio' });
  assert.equal(embeddedClaim.normalizedPath, '/settings');
  assert.equal(Object.hasOwn(embeddedClaim, 'legacyRouteTakeoverAuthorization'), false);
  assert.throws(
    () => runtime.compileRouteClaims({
      claims: [{ ...page.routeClaims[0], kind: 'alias', pathTemplate: '/settings' }],
      routeSpaces, surface: 'studio', legacyRouteTakeoverAuthorizations: [authorization],
    }),
    (error) => error.code === 'ROUTE_RESERVED',
  );
  assert.throws(
    () => runtime.compileRouteClaims({
      claims: [{ ...page.routeClaims[0], pathTemplate: '/settings/profile' }],
      routeSpaces, surface: 'studio', legacyRouteTakeoverAuthorizations: [authorization],
    }),
    (error) => error.code === 'ROUTE_RESERVED',
  );
  assert.throws(
    () => runtime.compileRouteClaims({
      claims: [{ ...page.routeClaims[0], pathTemplate: '/settings' }],
      routeSpaces, surface: 'studio',
      legacyRouteTakeoverAuthorizations: [{ ...authorization, contentHash: '0'.repeat(64) }],
    }),
    (error) => error.code === 'ROUTE_TAKEOVER_INVALID',
  );
});

test('permission alternatives preserve AND semantics for legacy compatibility sets', () => {
  const policy = {
    contract: 'PermissionAlternativePolicy', schemaVersion: 1, policyId: 'workbench.layout.compat',
    alternatives: [
      ['studio:workbench:layout:manage'],
      ['studio:workbench:sidebar_group:manage', 'studio:workbench:sidebar_item:manage'],
    ],
    retirementGate: { capability: 'workbench-layout-v2' },
  };
  assert.equal(runtime.permissionAlternativePolicyAllows(policy, ['studio:workbench:layout:manage']), true);
  assert.equal(runtime.permissionAlternativePolicyAllows(policy, [
    'studio:workbench:sidebar_group:manage', 'studio:workbench:sidebar_item:manage',
  ]), true);
  assert.equal(runtime.permissionAlternativePolicyAllows(policy, ['studio:workbench:sidebar_group:manage']), false);
  assert.equal(runtime.permissionAlternativePolicyAllows(policy, ['studio:workbench:sidebar_item:manage']), false);
});

test('route and Workbench catalog projections use stable ids and deterministic generation bodies', () => {
  const [routeClaim] = runtime.compileRouteClaims({ claims: page.routeClaims, routeSpaces, surface: 'studio' });
  const entry = {
    resourceKind: 'page', releaseSlotId: pageRelease.releaseSlotId,
    activeReleaseRevisionRef: pageReleaseRevisionRef, routeClaim, authority: 'declarative',
  };
  const first = runtime.compileDeclarativeRouteOwnerIndex({
    tenantScope: page.tenantScope, environmentRef: pageRelease.target.environmentRef,
    surface: 'studio', generation: 1, entries: [entry],
  });
  const next = runtime.compileDeclarativeRouteOwnerIndex({
    tenantScope: page.tenantScope, environmentRef: pageRelease.target.environmentRef,
    surface: 'studio', generation: 2, entries: [entry],
  });
  assert.equal(runtime.declarativeRouteOwnerIndexProjectionId(page.tenantScope, pageRelease.target.environmentRef, 'studio'),
    runtime.declarativeRouteOwnerIndexProjectionId(page.tenantScope, pageRelease.target.environmentRef, 'studio'));
  assert.notEqual(first.contentHash, next.contentHash);

  const compiledWorkbench = runtime.compileWorkbenchRuntimeBundle(workbenchInput());
  const catalog = runtime.compileDeclarativeWorkbenchCatalog({
    tenantScope: workbench.tenantScope, environmentRef: workbenchRelease.target.environmentRef,
    surface: 'studio', generation: 1,
    entries: [{
      workbenchId: compiledWorkbench.workbenchId, authority: 'declarative', identity: compiledWorkbench.identity,
      order: 10, isDefaultCandidate: true, activeReleaseRevisionRef: workbenchReleaseRevisionRef,
    }],
  });
  assert.equal(catalog.entries[0].workbenchId, compiledWorkbench.workbenchId);
  assert.throws(() => runtime.compileDeclarativeWorkbenchCatalog({
    tenantScope: workbench.tenantScope, environmentRef: workbenchRelease.target.environmentRef,
    surface: 'studio', generation: 1,
    entries: [catalog.entries[0], {
      ...catalog.entries[0], workbenchId: 'workbench.other', activeReleaseRevisionRef: {
        ...workbenchReleaseRevisionRef, id: 'workbench.other', contentHash: 'b'.repeat(64),
      },
    }],
  }), /at most one default/);
});

test('compiles one deterministic exact Design capability catalog artifact', () => {
  const schemaDocument = { $schema: 'https://json-schema.org/draft/2020-12/schema', type: 'object', additionalProperties: false };
  const schemaRevisionRef = revision('schema', 'design.example.properties', {
    visibility: 'global', ownerRepo: 'monkeys-design', contentHash: runtime.canonicalContentHash(schemaDocument),
  });
  const manifest = {
    contract: 'CapabilityManifest', id: 'design.example', capabilityVersion: '1', ownerRepo: 'monkeys-design',
    kind: 'view', displayName: 'Design example', ports: { inputs: [], outputs: [] },
    runtime: {
      providerBindings: [{ providerRef: { kind: 'view-provider', id: 'design.example.provider', version: '1', ownerRepo: 'monkeys-design' }, productContexts: [], priority: 0 }],
      loading: 'lazy', stateOwner: 'provider', sideEffects: [],
    },
    placement: { surfaces: ['studio'], slots: [], variants: [], tokenRefs: [] },
    accessibility: { keyboardModel: 'managed', focusModel: 'managed', labelContract: 'visible-label' },
    observability: { eventNamespace: 'design.example', metrics: [], evidenceRefs: [] },
  };
  const provider = {
    contract: 'ViewProviderDescriptor', providerId: 'design.example.provider', providerVersion: '1', ownerRepo: 'monkeys-design',
    capabilityRef: { kind: 'capability', id: manifest.id, version: '1', ownerRepo: manifest.ownerRepo },
    rendererKey: 'design-example', renderModelSchemaRef: 'design.example.render-model', loading: 'lazy', stateOwner: 'provider',
    supportedPageTypes: ['page'], supportedSurfaces: ['page'], frameOwner: 'provider', sideEffects: [],
    lifecycle: { preserveMount: true, preserveScroll: true, focusModel: 'managed' },
    performance: { lazy: true, virtualized: false },
  };
  const capabilityRevisionRef = revision('capability', manifest.id, {
    visibility: 'global', ownerRepo: 'monkeys-design', contentHash: runtime.canonicalContentHash(manifest),
  });
  const providerRevisionRef = revision('view-provider', provider.providerId, {
    visibility: 'global', ownerRepo: 'monkeys-design', contentHash: runtime.canonicalContentHash(provider),
  });
  const unsignedRegistration = {
    capabilityRevisionRef, providerRevisionRef, propertySchemaRevisionRef: schemaRevisionRef,
    editorEligible: true, category: 'example', label: { defaultLocale: 'en-US', values: { 'en-US': 'Example' } },
    description: { defaultLocale: 'en-US', values: { 'en-US': 'Example capability' } },
    supportedSurfaces: ['studio'], allowedSlots: ['main'], allowedParentCapabilityRefs: [], allowedChildCapabilityRefs: [],
    inputPorts: [], outputPorts: [], allowedSideEffects: [], ontologyRequirements: [], actionRequirements: [], propertyFields: [],
    schemaDocuments: [{ schemaRevisionRef, document: schemaDocument }],
  };
  const registrationHash = runtime.canonicalContentHash(unsignedRegistration);
  const declarativeRegistration = {
    registrationRevisionRef: revision('capability-registration', manifest.id, {
      visibility: 'global', ownerRepo: 'monkeys-design', contentHash: registrationHash,
    }),
    ...unsignedRegistration,
    sourceContentHash: registrationHash,
  };
  const first = runtime.compileDesignCapabilityCatalogArtifact({
    sourceRef: 'design.capabilities', revision: 1,
    entries: [{ manifest, provider, declarativeRegistration }],
  });
  const replay = runtime.compileDesignCapabilityCatalogArtifact({
    sourceRef: 'design.capabilities', revision: 1,
    entries: [{ manifest, provider, declarativeRegistration }],
  });
  assert.equal(first.sourceContentHash, replay.sourceContentHash);
  assert.equal(first.sourceRevisionRef.contentHash, first.sourceContentHash);
  assert.equal(first.entries[0].manifest.id, 'design.example');
  assert.equal(runtime.parseExactDesignCapabilityCatalogArtifact(first).sourceContentHash, first.sourceContentHash);
  assert.throws(() => runtime.parseExactDesignCapabilityCatalogArtifact({
    ...first, sourceContentHash: '0'.repeat(64),
  }), (error) => error.code === 'DESIGN_CATALOG_INVALID');
  assert.throws(() => runtime.compileDesignCapabilityCatalogArtifact({
    sourceRef: 'design.capabilities', revision: 1,
    entries: [{ manifest: { ...manifest, displayName: 'Tampered' }, provider, declarativeRegistration }],
  }), (error) => error.code === 'DESIGN_CATALOG_INVALID');
});

test('accepts only an exact product-owned capability registration', () => {
  const ownerRepo = 'monkeys';
  const schemaDocument = {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    type: 'object',
    additionalProperties: false,
  };
  const schemaRevisionRef = revision('schema', 'monkeys.example.properties', {
    visibility: 'global', ownerRepo, contentHash: runtime.canonicalContentHash(schemaDocument),
  });
  const manifest = {
    contract: 'CapabilityManifest', id: 'monkeys.example', capabilityVersion: '1', ownerRepo,
    kind: 'view', displayName: 'Product example', ports: { inputs: [], outputs: [] },
    runtime: {
      providerBindings: [{ providerRef: { kind: 'view-provider', id: 'monkeys.example.provider', version: '1', ownerRepo }, productContexts: ['kernel'], priority: 100 }],
      loading: 'eager', stateOwner: 'host', sideEffects: [],
    },
    placement: { surfaces: ['page'], slots: [], variants: [], tokenRefs: [] },
    accessibility: { keyboardModel: 'managed', focusModel: 'managed', labelContract: 'visible-label' },
    observability: { eventNamespace: 'monkeys.example', metrics: [], evidenceRefs: [] },
  };
  const provider = {
    contract: 'ViewProviderDescriptor', providerId: 'monkeys.example.provider', providerVersion: '1', ownerRepo,
    capabilityRef: { kind: 'capability', id: manifest.id, version: '1', ownerRepo },
    rendererKey: 'monkeys.example.renderer', renderModelSchemaRef: 'monkeys.example.render-model', loading: 'eager', stateOwner: 'host',
    supportedPageTypes: ['page'], supportedSurfaces: ['page'], frameOwner: 'host', sideEffects: [],
    lifecycle: { preserveMount: false, preserveScroll: false, focusModel: 'managed' },
    performance: { lazy: false, virtualized: false },
  };
  const unsignedRegistration = {
    capabilityRevisionRef: revision('capability', manifest.id, {
      visibility: 'global', ownerRepo, contentHash: runtime.canonicalContentHash(manifest),
    }),
    providerRevisionRef: revision('view-provider', provider.providerId, {
      visibility: 'global', ownerRepo, contentHash: runtime.canonicalContentHash(provider),
    }),
    propertySchemaRevisionRef: schemaRevisionRef,
    editorEligible: true, category: 'product-view',
    label: { defaultLocale: 'en-US', values: { 'en-US': 'Product example' } },
    description: { defaultLocale: 'en-US', values: { 'en-US': 'Product-owned visual capability' } },
    supportedSurfaces: ['kernel'], allowedSlots: [], allowedParentCapabilityRefs: [], allowedChildCapabilityRefs: [],
    inputPorts: [], outputPorts: [], allowedSideEffects: [], ontologyRequirements: [], actionRequirements: [], propertyFields: [],
    schemaDocuments: [{ schemaRevisionRef, document: schemaDocument }],
  };
  const sourceContentHash = runtime.canonicalContentHash(unsignedRegistration);
  const entry = {
    manifest,
    provider,
    declarativeRegistration: {
      registrationRevisionRef: revision('product-capability-registration', `${manifest.id}.authoring`, {
        visibility: 'global', ownerRepo, contentHash: sourceContentHash,
      }),
      ...unsignedRegistration,
      sourceContentHash,
    },
    requiredPermissionCodes: ['kernel_base:access'],
  };

  assert.deepEqual(runtime.parseExactProductDeclarativeCapabilityRegistration(entry), entry);
  assert.throws(
    () => runtime.parseExactProductDeclarativeCapabilityRegistration({
      ...entry,
      manifest: { ...manifest, displayName: 'Tampered' },
    }),
    (error) => error.code === 'PRODUCT_CAPABILITY_CATALOG_INVALID',
  );
  assert.throws(
    () => runtime.parseExactProductDeclarativeCapabilityRegistration({
      ...entry,
      declarativeRegistration: {
        ...entry.declarativeRegistration,
        schemaDocuments: [{ schemaRevisionRef, document: { ...schemaDocument, type: 'array' } }],
      },
    }),
    (error) => error.code === 'PRODUCT_CAPABILITY_CATALOG_INVALID',
  );
  assert.equal(
    ProductDeclarativeCapabilityRegistrationSchema.safeParse({
      ...entry,
      manifest: { ...manifest, ownerRepo: 'monkeys-design' },
    }).success,
    false,
  );
  assert.equal(
    ProductDeclarativeCapabilityRegistrationSchema.safeParse({
      ...entry,
      requiredPermissionCodes: ['z:access', 'a:access'],
    }).success,
    false,
  );
});

test('compiles WorkbenchRuntimeBundle and keeps explicit deep-link denial separate from default selection', () => {
  const design = runtime.compileWorkbenchRuntimeBundle(workbenchInput());
  const secondWorkbench = {
    ...design,
    workbenchId: 'workbench.studio.automation',
    target: { ...design.target, workbenchId: 'workbench.studio.automation', order: 20, isDefaultCandidate: false },
    workbenchAccessPolicy: access({ permissionAllOf: ['automation.read'] }),
  };
  assert.equal(design.contract, 'WorkbenchRuntimeBundle');
  assert.deepEqual(design.identity, {
    name: workbench.identity.name,
    description: workbench.identity.description,
  });
  assert.equal(Object.hasOwn(design.identity, 'tags'), false);
  assert.equal(Object.hasOwn(design.identity, 'iconRef'), false);

  const renamed = runtime.compileWorkbenchRuntimeBundle(workbenchInput({
    workbench: {
      ...workbench,
      identity: {
        ...workbench.identity,
        name: { defaultLocale: 'en-US', values: { 'en-US': 'Renamed Workbench' } },
      },
    },
  }));
  assert.notEqual(renamed.contentHash, design.contentHash);

  assert.deepEqual(runtime.resolveWorkbenchEntry({
    bundles: [design, secondWorkbench],
    requestedWorkbenchId: design.workbenchId,
    isAllowed: () => false,
  }), { status: 'forbidden', workbenchId: design.workbenchId });

  assert.deepEqual(runtime.resolveWorkbenchEntry({
    bundles: [design, secondWorkbench],
    isAllowed: (bundle) => bundle.workbenchId === secondWorkbench.workbenchId,
  }), { status: 'resolved', bundle: secondWorkbench, source: 'first-accessible' });
});

test('Workbench compiler rejects templates and audiences wider than an inner target', () => {
  assert.throws(
    () => runtime.compileWorkbenchRuntimeBundle(workbenchInput({ workbench: { ...workbench, purpose: 'template' } })),
    (error) => error.code === 'WORKBENCH_TEMPLATE_UNRELEASABLE',
  );
  assert.throws(
    () => runtime.compileWorkbenchRuntimeBundle(workbenchInput({
      workbench: {
        ...workbench,
        appInstances: workbench.appInstances.map((instance) => ({ ...instance, accessPolicy: access() })),
      },
    })),
    (error) => error.code === 'AUDIENCE_WIDER_THAN_TARGET',
  );
});

test('validates the active Workbench release set as one deterministic environment set', () => {
  const design = runtime.compileWorkbenchRuntimeBundle(workbenchInput());
  const automation = {
    ...design,
    workbenchId: 'workbench.studio.automation',
    workbenchRevisionRef: { ...design.workbenchRevisionRef, id: 'workbench.studio.automation' },
    target: { ...design.target, workbenchId: 'workbench.studio.automation', order: 20, isDefaultCandidate: false },
  };
  assert.deepEqual(runtime.validateWorkbenchRuntimeSet([automation, design]).map((bundle) => bundle.workbenchId), [
    design.workbenchId,
    automation.workbenchId,
  ]);
  const equalOrder = {
    ...automation,
    target: { ...automation.target, order: design.target.order },
  };
  assert.throws(
    () => runtime.validateWorkbenchRuntimeSet([equalOrder, design]),
    (error) => error.code === 'WORKBENCH_RELEASE_SET_INVALID' && error.path === 'bundles[1].target.order',
  );
  assert.throws(
    () => runtime.validateWorkbenchRuntimeSet([]),
    (error) => error.code === 'WORKBENCH_RELEASE_SET_INVALID',
  );
  assert.throws(
    () => runtime.validateWorkbenchRuntimeSet([design, { ...automation, target: { ...automation.target, isDefaultCandidate: true } }]),
    (error) => error.code === 'WORKBENCH_RELEASE_SET_INVALID',
  );
});

test('compiles NavigationRuntimeBundle with exact active release targets and ancestor policies', () => {
  const bundle = runtime.compileNavigationRuntimeBundle(navigationInput());
  assert.equal(bundle.contract, 'NavigationRuntimeBundle');
  assert.equal(bundle.nodes.find((node) => node.nodeId === 'gallery').resolvedTarget.releaseRevisionRef.id, pageReleaseRevisionRef.id);
  assert.equal(bundle.nodes.find((node) => node.nodeId === 'gallery').ancestorAccessPolicies.length, 1);
  assert.equal(bundle.rebuildable, true);
});

test('compiles registered Menu Actions without inventing route claims and validates exact catalog input', () => {
  const menuActionRef = stable('menu-action', 'studio.action.set-theme', { visibility: 'global', ownerRepo: 'monkeys' });
  const menuActionRevisionRef = revision('menu-action', menuActionRef.id, { visibility: 'global', ownerRepo: 'monkeys', contentHash: 'c'.repeat(64) });
  const sourceCatalogRevisionRef = revision('application-menu-catalog', 'studio', { visibility: 'global', ownerRepo: 'monkeys', contentHash: 'd'.repeat(64) });
  const actionNavigation = {
    ...navigation,
    navigationId: 'navigation.studio.user-menu',
    placements: ['studio.user-menu'],
    nodes: [{
      nodeId: 'theme', kind: 'target', parentNodeId: null, order: 10, label: navigation.nodes[1].label,
      targetRef: menuActionRef,
      parameterMapping: { mode: { kind: 'constant', value: 'toggle' } },
      audience: access(),
    }],
  };
  const actionNavigationRevisionRef = revision('navigation', actionNavigation.navigationId);
  const actionRelease = {
    ...navigationRelease,
    releaseSlotId: 'tenant.acme:test:studio:studio.user-menu',
    navigationRevisionRef: actionNavigationRevisionRef,
    target: { ...navigationRelease.target, placement: 'studio.user-menu' },
    resolvedTargets: [{ nodeId: 'theme', stableTargetRef: menuActionRef, targetRevisionRef: menuActionRevisionRef }],
    dependencySnapshot: [
      { role: 'menu-action', revisionRef: menuActionRevisionRef },
      { role: 'application-menu-catalog', revisionRef: sourceCatalogRevisionRef },
      { role: 'performance-budget', revisionRef: navigation.performanceBudgetRef },
      { role: 'observation-policy', revisionRef: navigation.observationPolicyRevisionRef },
      { role: 'compiler', revisionRef: compilerRevisionRef },
    ],
  };
  const bundle = runtime.compileNavigationRuntimeBundle(navigationInput({
    navigation: actionNavigation,
    navigationRevisionRef: actionNavigationRevisionRef,
    release: actionRelease,
    releaseRevisionRef: revision('navigation-release', actionRelease.releaseSlotId),
    targetRegistry: [{
      kind: 'registered-menu-action', stableTargetRef: menuActionRef, targetRevisionRef: menuActionRevisionRef,
      surface: 'studio', accessPolicy: access(), applicationId: 'studio', actionRef: menuActionRef.id,
      inputSchemaRef: 'studio.action-input.set-theme', sourceCatalogRevisionRef,
      validateInput: (input) => {
        assert.deepEqual(input, { mode: 'toggle' });
        return input;
      },
    }],
  }));
  const target = bundle.nodes[0].resolvedTarget;
  assert.equal(target.kind, 'registered-menu-action');
  assert.equal(target.execution, 'client');
  assert.deepEqual(target.input, { mode: 'toggle' });
  assert.equal(Object.hasOwn(target, 'routeClaim'), false);

  const disabledBundle = runtime.compileNavigationRuntimeBundle(navigationInput({
    navigation: { ...actionNavigation, nodes: [{ ...actionNavigation.nodes[0], disabled: true, tone: 'danger' }] },
    navigationRevisionRef: actionNavigationRevisionRef,
    release: actionRelease,
    releaseRevisionRef: revision('navigation-release', actionRelease.releaseSlotId),
    targetRegistry: [{
      kind: 'registered-menu-action', stableTargetRef: menuActionRef, targetRevisionRef: menuActionRevisionRef,
      surface: 'studio', accessPolicy: access(), applicationId: 'studio', actionRef: menuActionRef.id,
      inputSchemaRef: 'studio.action-input.set-theme', sourceCatalogRevisionRef,
      validateInput: (input) => input,
    }],
  }));
  assert.equal(disabledBundle.nodes[0].disabled, true);
  assert.equal(disabledBundle.nodes[0].tone, 'danger');

  assert.throws(() => runtime.compileNavigationRuntimeBundle(navigationInput({
    navigation: { ...actionNavigation, nodes: [{ ...actionNavigation.nodes[0], parameterMapping: { mode: { kind: 'constant', value: 'invalid' } } }] },
    navigationRevisionRef: actionNavigationRevisionRef,
    release: actionRelease,
    releaseRevisionRef: revision('navigation-release', actionRelease.releaseSlotId),
    targetRegistry: [{
      kind: 'registered-menu-action', stableTargetRef: menuActionRef, targetRevisionRef: menuActionRevisionRef,
      surface: 'studio', accessPolicy: access(), applicationId: 'studio', actionRef: menuActionRef.id,
      inputSchemaRef: 'studio.action-input.set-theme', sourceCatalogRevisionRef,
      validateInput: () => { throw new TypeError('invalid theme input'); },
    }],
  })), (error) => error.code === 'NAV_ACTION_INPUT_INVALID');
});

test('compiles governed Navigation DomainCommands with exact Schema revisions and no route claim', () => {
  const commandRef = stable('domain-command', 'workspace.rebuild', { ownerRepo: 'monkeys-data-server' });
  const commandRevisionRef = revision('domain-command', commandRef.id, { ownerRepo: 'monkeys-data-server' });
  const inputSchemaRevisionRef = revision('schema', 'workspace.rebuild.input', { ownerRepo: 'monkeys-data-server' });
  const resultSchemaRevisionRef = revision('schema', 'workspace.rebuild.result', { ownerRepo: 'monkeys-data-server' });
  const commandNavigation = {
    ...navigation,
    navigationId: 'navigation.studio.command-menu',
    placements: ['studio.user-menu'],
    nodes: [{
      nodeId: 'rebuild', kind: 'target', parentNodeId: null, order: 10, label: navigation.nodes[1].label,
      targetRef: commandRef, parameterMapping: { scope: { kind: 'constant', value: 'current' } }, audience: access(), tone: 'danger',
    }],
  };
  const commandNavigationRevisionRef = revision('navigation', commandNavigation.navigationId);
  const commandRelease = {
    ...navigationRelease,
    releaseSlotId: 'tenant.acme:test:studio:studio.command-menu',
    navigationRevisionRef: commandNavigationRevisionRef,
    target: { ...navigationRelease.target, placement: 'studio.user-menu' },
    resolvedTargets: [{ nodeId: 'rebuild', stableTargetRef: commandRef, targetRevisionRef: commandRevisionRef }],
    dependencySnapshot: [
      { role: 'action', revisionRef: commandRevisionRef },
      { role: 'schema', revisionRef: inputSchemaRevisionRef },
      { role: 'schema', revisionRef: resultSchemaRevisionRef },
      { role: 'performance-budget', revisionRef: navigation.performanceBudgetRef },
      { role: 'observation-policy', revisionRef: navigation.observationPolicyRevisionRef },
      { role: 'compiler', revisionRef: compilerRevisionRef },
    ],
  };
  const bundle = runtime.compileNavigationRuntimeBundle(navigationInput({
    navigation: commandNavigation,
    navigationRevisionRef: commandNavigationRevisionRef,
    release: commandRelease,
    releaseRevisionRef: revision('navigation-release', commandRelease.releaseSlotId),
    targetRegistry: [{
      kind: 'governed-domain-command', stableTargetRef: commandRef, targetRevisionRef: commandRevisionRef,
      surface: 'studio', accessPolicy: access(), inputSchemaRevisionRef, resultSchemaRevisionRef,
    }],
  }));
  const target = bundle.nodes[0].resolvedTarget;
  assert.equal(target.kind, 'governed-domain-command');
  assert.equal(target.execution, 'server');
  assert.deepEqual(target.input, { scope: 'current' });
  assert.equal(target.inputSchemaRevisionRef.id, inputSchemaRevisionRef.id);
  assert.equal(target.resultSchemaRevisionRef.id, resultSchemaRevisionRef.id);
  assert.equal(Object.hasOwn(target, 'routeClaim'), false);
  assert.equal(bundle.nodes[0].tone, 'danger');
});

test('Navigation compiler rejects unreleased targets, wider audiences, and caller limit overflow', () => {
  assert.throws(
    () => runtime.compileNavigationRuntimeBundle(navigationInput({ targetRegistry: navigationTargetRegistry.slice(1) })),
    (error) => error.code === 'NAV_TARGET_UNRELEASED',
  );
  const wider = {
    ...navigation,
    nodes: navigation.nodes.map((node) => node.nodeId === 'gallery'
      ? { ...node, audience: access() }
      : node),
  };
  assert.throws(
    () => runtime.compileNavigationRuntimeBundle(navigationInput({ navigation: wider })),
    (error) => error.code === 'AUDIENCE_WIDER_THAN_TARGET',
  );
  assert.throws(
    () => runtime.compileNavigationRuntimeBundle(navigationInput({ limits: { ...limits, maxNavigationDepth: 1 } })),
    (error) => error.code === 'NAV_DEPTH_EXCEEDED',
  );
});

test('AccessPolicy implication proves only monotonic audience narrowing', () => {
  assert.equal(runtime.accessPolicyChainImplies([
    access({ permissionAllOf: ['workspace.enter'] }),
    access({ permissionAllOf: ['inspiration.read'] }),
  ], access({ permissionAllOf: ['inspiration.read'] })), true);
  assert.equal(runtime.accessPolicyChainImplies([
    access({ permissionAnyOf: ['inspiration.read'] }),
  ], access({ permissionAnyOf: ['inspiration.read', 'inspiration.manage'] })), true);
  assert.equal(runtime.accessPolicyChainImplies([
    access(),
  ], access({ permissionAllOf: ['inspiration.read'] })), false);
});



test("Page instance access narrows a restricted capability without changing Page entry", () => {
  const input = pageInput();
  const restricted = access({ permissionAllOf: ["capability.private"] });
  const registry = input.capabilityRegistry.map(entry => ({ ...entry, accessPolicy: restricted }));
  assert.throws(() => runtime.compilePageRuntimeBundle({ ...input, capabilityRegistry: registry }), error => error.code === "AUDIENCE_WIDER_THAN_TARGET");
  const guardedPage = { ...input.page, capabilityInstances: input.page.capabilityInstances.map(instance => ({ ...instance, accessPolicy: restricted })) };
  const bundle = runtime.compilePageRuntimeBundle({ ...input, page: guardedPage, capabilityRegistry: registry });
  assert.deepEqual(bundle.pageAccessPolicy, input.page.pageAccessPolicy);
  assert.deepEqual(bundle.deniedCapabilityInstanceIds, []);
  assert.deepEqual(bundle.capabilityInstances[0].accessPolicy, restricted);
  const wider = { ...guardedPage, capabilityInstances: guardedPage.capabilityInstances.map(instance => ({ ...instance, accessPolicy: access({ permissionAnyOf: ["capability.private", "other"] }) })) };
  assert.throws(() => runtime.compilePageRuntimeBundle({ ...input, page: wider, capabilityRegistry: registry }), error => error.code === "AUDIENCE_WIDER_THAN_TARGET");
  assert.equal(PageRuntimeBundleSchema.safeParse({ ...bundle, deniedCapabilityInstanceIds: ["unknown"] }).success, false);
});


test('legacy page compilation preserves exact view/projection bindings without inventing canonical revisions', () => {
  const sdk = require('@inf-monkeys-tech/monkeys');
  for (const projection of [false, true]) {
    const input = pageInput();
    input.page = structuredClone(input.page);
    input.release = structuredClone(input.release);
    const binding = input.page.ontologyBindings[0];
    const canonical = binding.canonicalDataViewRevisionRef;
    delete binding.canonicalDataViewRevisionRef;
    input.release.dependencySnapshot = input.release.dependencySnapshot.filter(entry => !sdk.sameRevisionRef(entry.revisionRef, canonical));
    if (projection) {
      const view = binding.viewRevisionRef;
      binding.projectionRevisionRef = { ...view, kind: 'projection-spec' };
      delete binding.viewRevisionRef;
      input.release.dependencySnapshot = input.release.dependencySnapshot.map(entry => sdk.sameRevisionRef(entry.revisionRef, view) ? { role: 'projection-spec', revisionRef: binding.projectionRevisionRef } : entry);
    }
    const hash = sdk.canonicalContentHash(input.page);
    assert.equal(sdk.canonicalContentHash(sdk.ResolvedPageSchema.parse(input.page)), hash);
    input.capabilityRegistry = input.capabilityRegistry.map(({ propertySchemaRevisionRef, accessPolicy, ...entry }) => entry);
    delete input.shellRegistration;
    const bundle = runtime.compileLegacyPageRuntimeBundle(input);
    assert.deepEqual(bundle.ontologyBindings[0], binding);
    assert.equal(bundle.shellDescriptor, undefined);
    assert.equal(sdk.LegacyPageRuntimeBundleSchema.safeParse(bundle).success, true);
    assert.equal(sdk.PageRuntimeBundleSchema.safeParse(bundle).success, false);
    assert.equal(sdk.ReadablePageRuntimeBundleSchema.safeParse(bundle).success, true);
    assert.equal(sdk.ReadablePageRuntimeBundleSchema.safeParse({ ...bundle, ontologyBindings: [{ ...binding, canonicalDataViewRevisionRef: canonical }] }).success, false);
    assert.throws(() => runtime.compilePageRuntimeBundle(input));
    const malformed = { ...binding, viewRevisionRef: revision('view', 'extra'), projectionRevisionRef: revision('projection-spec', 'extra') };
    assert.equal(sdk.LegacyOntologyBindingSchema.safeParse(malformed).success, false);
    assert.equal(sdk.OntologyBindingSchema.safeParse(binding).success, false);
    const missing = structuredClone(input);
    missing.release.dependencySnapshot = missing.release.dependencySnapshot.filter(entry => entry.role !== (projection ? 'projection-spec' : 'view'));
    assert.throws(() => runtime.compileLegacyPageRuntimeBundle(missing));
  }
});

test('legacy compilation cannot bypass the canonical binding authority of modern pages', () => {
  const sdk = require('@inf-monkeys-tech/monkeys');
  const bundle = runtime.compilePageRuntimeBundle(pageInput());
  assert.equal(sdk.ReadablePageRuntimeBundleSchema.safeParse(bundle).success, true);
  assert.equal(sdk.LegacyPageRuntimeBundleSchema.safeParse(bundle).success, false);
  assert.throws(() => runtime.compileLegacyPageRuntimeBundle(pageInput()));
});
