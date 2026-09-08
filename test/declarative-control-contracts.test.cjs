'use strict';
const assert = require('node:assert/strict');
const test = require('node:test');
const schemas = require('@inf-monkeys-tech/monkeys/schemas');
const contracts = require('@inf-monkeys-tech/monkeys/contracts');
const {
  HASH_A,
  access,
  navigation,
  navigationRelease,
  page,
  pageRelease,
  publicationPlan,
  revision,
  routeSpace,
  stable,
  tenantScope,
  text,
  workbench,
  workbenchRelease,
  stableRefAliasMap,
} = require('./declarative-control-fixtures.cjs');
const otherTenantScope = {
  ...tenantScope,
  tenantRef: { ...tenantScope.tenantRef, id: 'tenant.other' },
};
const otherTenant = (reference) => ({
  ...reference,
  visibility: 'tenant',
  tenantScope: otherTenantScope,
});
const explicitGlobal = (reference) => {
  const { tenantScope: _tenantScope, ...unscoped } = reference;
  return { ...unscoped, visibility: 'global' };
};
test('publishes six isolated declarative control Ontology Definitions', () => {
  const definitions = contracts.DECLARATIVE_CONTROL_ONTOLOGY_DEFINITIONS;
  assert.deepEqual(
    definitions.map((definition) => definition.ontologyId),
    [
      'monkeys.system.page',
      'monkeys.system.page-release',
      'monkeys.system.workbench',
      'monkeys.system.workbench-release',
      'monkeys.system.navigation',
      'monkeys.system.navigation-release',
    ],
  );
  for (const definition of definitions) {
    const parsed = schemas.DeclarativeControlOntologyDefinitionSchema.parse(definition);
    assert.equal(parsed.classification, 'control');
    assert.deepEqual(parsed.discovery, {
      ordinaryDataBrowser: false,
      businessSearch: false,
      businessStatistics: false,
      ordinaryExport: false,
      genericWrite: false,
    });
  }
});
test('parses all six strict Ontology record contracts', () => {
  assert.equal(schemas.PageSchema.parse(page).pageId, page.pageId);
  assert.equal(schemas.PageReleaseSchema.parse(pageRelease).releaseSlotId, pageRelease.releaseSlotId);
  assert.equal(schemas.WorkbenchSchema.parse(workbench).workbenchId, workbench.workbenchId);
  assert.equal(schemas.WorkbenchReleaseSchema.parse(workbenchRelease).releaseSlotId, workbenchRelease.releaseSlotId);
  assert.equal(schemas.NavigationSchema.parse(navigation).navigationId, navigation.navigationId);
  assert.equal(schemas.NavigationReleaseSchema.parse(navigationRelease).releaseSlotId, navigationRelease.releaseSlotId);
  assert.equal(schemas.PageSchema.safeParse({ ...page, businessRecords: [] }).success, false);
  assert.equal(schemas.PageReleaseSchema.safeParse({ ...pageRelease, published: true }).success, false);
  assert.equal(
    schemas.WorkbenchSchema.safeParse({
      ...workbench,
      iframeUrl: 'https://example.com',
    }).success,
    false,
  );
  assert.equal(
    schemas.NavigationSchema.safeParse({
      ...navigation,
      url: 'https://example.com',
    }).success,
    false,
  );
});
test('Page legacy route policy is explicit, strict, and backward compatible', () => {
  assert.equal(schemas.PageSchema.parse(page).legacyRoutePolicy, undefined);
  assert.deepEqual(
    schemas.PageSchema.parse({
      ...page,
      legacyRoutePolicy: {
        contract: 'LegacyRoutePolicy',
        schemaVersion: 1,
        fallback: 'forbidden',
        restoration: 'forbidden',
      },
    }).legacyRoutePolicy,
    {
      contract: 'LegacyRoutePolicy',
      schemaVersion: 1,
      fallback: 'forbidden',
      restoration: 'forbidden',
    },
  );
  assert.equal(
    schemas.PageSchema.safeParse({
      ...page,
      legacyRoutePolicy: {
        contract: 'LegacyRoutePolicy',
        schemaVersion: 1,
        fallback: 'forbidden',
        restoration: 'forbidden',
        pageId: page.pageId,
      },
    }).success,
    false,
  );
});
test('Page migration equivalence is a strict baseline, scenario, viewport and evidence contract', () => {
  const migrationEquivalence = {
    contract: 'PageMigrationEquivalence',
    schemaVersion: 1,
    policy: 'preserve-ui-ux',
    baseline: {
      repository: 'monkeys',
      revision: '204ffa964a2f63a209e740b1f3b61247c3b44157',
      pageId: 'kernel.page.data-assets',
      routePath: '/kernel/data-governance/data',
    },
    protectedDimensions: [
      'url',
      'navigation',
      'access',
      'deep-link',
      'layout',
      'design-tokens',
      'responsive',
      'view-modes',
      'search-filter',
      'detail',
      'history',
      'loading',
      'empty',
      'error',
      'forbidden',
    ],
    viewports: [
      { viewportId: 'desktop', width: 1440, height: 900 },
      { viewportId: 'narrow', width: 768, height: 900 },
    ],
    scenarios: [
      { scenarioId: 'table', viewportIds: ['desktop', 'narrow'] },
      { scenarioId: 'forbidden', viewportIds: ['desktop'] },
    ],
    evidence: {
      sideBySideVisual: true,
      domSnapshot: true,
      consoleErrors: 'none',
    },
    allowedDifferences: [],
  };
  assert.deepEqual(
    schemas.PageSchema.parse({ ...page, migrationEquivalence }).migrationEquivalence,
    migrationEquivalence,
  );
  assert.equal(
    schemas.PageSchema.safeParse({
      ...page,
      migrationEquivalence: {
        ...migrationEquivalence,
        scenarios: [{ scenarioId: 'table', viewportIds: ['missing'] }],
      },
    }).success,
    false,
  );
  assert.equal(
    schemas.PageSchema.safeParse({
      ...page,
      migrationEquivalence: {
        ...migrationEquivalence,
        evidence: {
          ...migrationEquivalence.evidence,
          consoleErrors: 'ignored',
        },
      },
    }).success,
    false,
  );
});

test('Page route-state presentations are strict, localized, and surface-owned', () => {
  const presentation = {
    surface: 'studio',
    state: 'forbidden',
    kind: 'status',
    presentation: 'panel',
    title: text('No permission'),
    description: text('This account cannot access the page.'),
  };
  assert.deepEqual(
    schemas.PageSchema.parse({
      ...page,
      routeStatePresentations: [presentation],
    }).routeStatePresentations,
    [presentation],
  );
  assert.equal(
    schemas.PageSchema.safeParse({
      ...page,
      routeStatePresentations: [presentation, presentation],
    }).success,
    false,
  );
  assert.equal(
    schemas.PageSchema.safeParse({
      ...page,
      routeStatePresentations: [{ ...presentation, surface: 'kernel' }],
    }).success,
    false,
  );
  assert.equal(
    schemas.PageSchema.safeParse({
      ...page,
      routeStatePresentations: [{ ...presentation, releaseSlotId: 'secret' }],
    }).success,
    false,
  );
  assert.equal(
    schemas.PageSchema.safeParse({
      ...page,
      routeStatePresentations: [
        {
          ...presentation,
          title: text('x'.repeat(161)),
        },
      ],
    }).success,
    false,
  );
});

test('Page Ontology bindings pin distinct governed and canonical data View revisions', () => {
  const binding = page.ontologyBindings[0];
  assert.equal(schemas.OntologyBindingSchema.safeParse(binding).success, true);
  const { canonicalDataViewRevisionRef: _omitted, ...withoutCanonicalDataView } = binding;
  assert.equal(schemas.OntologyBindingSchema.safeParse(withoutCanonicalDataView).success, false);
  assert.equal(
    schemas.OntologyBindingSchema.safeParse({
      ...binding,
      canonicalDataViewRevisionRef: {
        ...binding.canonicalDataViewRevisionRef,
        kind: 'schema',
      },
    }).success,
    false,
  );
  assert.equal(
    schemas.OntologyBindingSchema.safeParse({
      ...binding,
      canonicalDataViewRevisionRef: binding.viewRevisionRef,
    }).success,
    false,
  );
  const pageChangeIntentSchemaRevisionRef = revision('schema', 'intent.collection.page-change', {
    visibility: 'global',
    ownerRepo: 'monkeys-design',
  });
  const cursorWindow = {
    pageChangePort: 'capability.gallery.page-change',
    pageChangeIntentSchemaRevisionRef,
  };
  assert.deepEqual(schemas.OntologyBindingSchema.parse({ ...binding, cursorWindow }).cursorWindow, cursorWindow);
  assert.equal(
    schemas.OntologyBindingSchema.safeParse({
      ...binding,
      pagination: 'none',
      cursorWindow,
    }).success,
    false,
  );
  assert.equal(
    schemas.CursorWindowBindingSchema.safeParse({
      ...cursorWindow,
      pageChangeIntentSchemaRevisionRef: {
        ...pageChangeIntentSchemaRevisionRef,
        kind: 'view',
      },
    }).success,
    false,
  );
});
test('Page state, interaction, and governed Domain Query contracts remain typed and legacy-readable', () => {
  const stateSchemaRevisionRef = revision('schema', 'page-state.gallery-filter', { visibility: 'global' });
  const intentSchemaRevisionRef = page.actionBindings[0].sourceIntentSchemaRevisionRef;
  const queryInputSchemaRevisionRef = revision('schema', 'query.inspiration.input', { visibility: 'global' });
  const queryDefinition = {
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
  const queryDefinitionRevisionRef = revision('domain-query-definition', queryDefinition.queryId);
  const statefulPage = {
    ...page,
    capabilityInstances: [
      {
        ...page.capabilityInstances[0],
        activationWhen: {
          operator: 'all',
          conditions: [{ stateId: 'gallery-filter', predicate: 'not-equals', value: null }],
        },
      },
    ],
    stateDefinitions: [
      {
        stateId: 'gallery-filter',
        schemaRevisionRef: stateSchemaRevisionRef,
        defaultValue: {},
        persistence: 'url',
      },
    ],
    interactionBindings: [
      {
        bindingId: 'update-gallery-filter',
        source: { capabilityInstanceId: 'gallery', port: 'favorite' },
        sourceIntentSchemaRevisionRef: intentSchemaRevisionRef,
        targetStateId: 'gallery-filter',
        transition: 'merge',
        inputMapping: { recordId: { kind: 'intent-field', path: 'recordId' } },
      },
    ],
    queryBindings: [
      {
        bindingId: 'inspiration-query',
        queryDefinitionRevisionRef,
        parameters: {
          teamId: { kind: 'identity', name: 'teamId' },
          filters: { kind: 'page-state', stateId: 'gallery-filter' },
        },
        target: { capabilityInstanceId: 'gallery', port: 'items' },
        renderModelSchemaRevisionRef: page.ontologyBindings[0].renderModelSchemaRevisionRef,
        pagination: 'cursor',
        cache: 'identity-scoped',
        cancelOnChange: true,
      },
    ],
  };
  assert.equal(schemas.PageSchema.parse(page).stateDefinitions, undefined);
  assert.equal(schemas.PageSchema.parse(page).interactionBindings, undefined);
  assert.equal(schemas.PageSchema.parse(page).queryBindings, undefined);
  assert.equal(schemas.DomainQueryDefinitionSchema.safeParse(queryDefinition).success, true);
  const cursorWindow = {
    pageChangePort: 'capability.gallery.page-change',
    pageChangeIntentSchemaRevisionRef: revision('schema', 'intent.gallery.page-change', {
      visibility: 'global',
      ownerRepo: 'monkeys-design',
    }),
  };
  const cursorWindowPage = {
    ...statefulPage,
    queryBindings: [{ ...statefulPage.queryBindings[0], cursorWindow }],
  };
  const cursorWindowPageParse = schemas.PageSchema.safeParse(cursorWindowPage);
  assert.equal(cursorWindowPageParse.success, true, cursorWindowPageParse.error?.message);
  assert.equal(
    schemas.PageSchema.safeParse({
      ...cursorWindowPage,
      interactionBindings: [
        {
          ...statefulPage.interactionBindings[0],
          source: {
            capabilityInstanceId: 'gallery',
            port: cursorWindow.pageChangePort,
          },
        },
      ],
    }).success,
    false,
  );
  assert.equal(
    schemas.PageSchema.safeParse({
      ...cursorWindowPage,
      ontologyBindings: [{ ...page.ontologyBindings[0], cursorWindow }],
    }).success,
    false,
  );
  assert.equal(schemas.PageSchema.safeParse(statefulPage).success, true);
  const resultBindingEffect = {
    bindingId: 'inspiration-query',
    operation: 'upsert-append',
    collectionPath: ['items'],
    identityPath: ['id'],
    mappings: [
      {
        targetPath: ['id'],
        source: { kind: 'result-field', path: 'recordId' },
      },
      {
        targetPath: ['title'],
        source: { kind: 'result-field', path: 'title' },
      },
      {
        targetPath: ['position'],
        source: { kind: 'collection-length', offset: 1 },
      },
    ],
  };
  const resultProjectedPage = {
    ...statefulPage,
    actionBindings: [
      {
        ...page.actionBindings[0],
        success: {
          refreshBindingIds: [],
          resultBindingEffects: [resultBindingEffect],
          toast: text('Action completed'),
        },
      },
    ],
  };
  const resultProjectedPageParse = schemas.PageSchema.safeParse(resultProjectedPage);
  assert.equal(resultProjectedPageParse.success, true, resultProjectedPageParse.error?.message);
  assert.equal(resultProjectedPageParse.data.actionBindings[0].success.toast.values['en-US'], 'Action completed');
  const ephemeralResult = {
    kind: 'one-time-value',
    valuePath: '/apiKey',
    labelPath: '/item/name',
    title: text('One-time value'),
    description: text('Store the value before closing.'),
    copySuccessToast: text('Copied'),
    copyFailureToast: text('Copy failed'),
  };
  assert.equal(
    schemas.PageSchema.safeParse({
      ...statefulPage,
      actionBindings: [
        {
          ...page.actionBindings[0],
          success: { refreshBindingIds: [], ephemeralResult },
        },
      ],
    }).success,
    true,
  );
  assert.equal(
    schemas.ActionBindingSchema.safeParse({
      ...page.actionBindings[0],
      success: {
        refreshBindingIds: [],
        ephemeralResult,
        resultBindingEffects: [resultBindingEffect],
      },
    }).success,
    false,
  );
  for (const valuePath of ['apiKey', '/', '/a//b', '/a/~2', '/__proto__/value']) {
    assert.equal(
      schemas.ActionBindingSchema.safeParse({
        ...page.actionBindings[0],
        success: {
          refreshBindingIds: [],
          ephemeralResult: { ...ephemeralResult, valuePath },
        },
      }).success,
      false,
    );
  }
  for (const labelPath of ['/apiKey', '/apiKey/label', '/item']) {
    const valuePath = labelPath === '/item' ? '/item/secret' : '/apiKey';
    assert.equal(
      schemas.ActionBindingSchema.safeParse({
        ...page.actionBindings[0],
        success: {
          refreshBindingIds: [],
          ephemeralResult: { ...ephemeralResult, valuePath, labelPath },
        },
      }).success,
      false,
    );
  }
  const sensitiveCommand = {
    contract: 'DomainCommandDefinition',
    commandName: 'secret.create',
    ownerRepo: 'monkeys-server',
    displayName: 'Create secret',
    targetKinds: ['secret'],
    inputSchemaRef: 'secret.create.input',
    outputSchemaRef: 'secret.create.result',
    sensitiveResultPaths: ['/apiKey'],
    requiredPermissionCodes: [],
    handlerRef: {
      kind: 'operation',
      id: 'secret.create',
      ownerRepo: 'monkeys-server',
    },
    sideEffects: ['data-write'],
  };
  assert.equal(schemas.DomainCommandDefinitionSchema.safeParse(sensitiveCommand).success, true);
  for (const sensitiveResultPaths of [
    ['/apiKey', '/apiKey'],
    ['/item', '/item/secret'],
    ['/item/secret', '/item'],
  ]) {
    assert.equal(
      schemas.DomainCommandDefinitionSchema.safeParse({
        ...sensitiveCommand,
        sensitiveResultPaths,
      }).success,
      false,
    );
  }
  assert.equal(
    schemas.PageSchema.safeParse({
      ...resultProjectedPage,
      actionBindings: [
        {
          ...resultProjectedPage.actionBindings[0],
          success: {
            ...resultProjectedPage.actionBindings[0].success,
            toast: { values: { 'en-US': 'Missing default' } },
          },
        },
      ],
    }).success,
    false,
  );
  assert.equal(
    schemas.PageSchema.safeParse({
      ...resultProjectedPage,
      actionBindings: [
        {
          ...resultProjectedPage.actionBindings[0],
          success: {
            refreshBindingIds: ['inspiration-query'],
            resultBindingEffects: [resultBindingEffect],
          },
        },
      ],
    }).success,
    false,
  );
  assert.equal(
    schemas.PageSchema.safeParse({
      ...resultProjectedPage,
      actionBindings: [
        {
          ...resultProjectedPage.actionBindings[0],
          success: {
            refreshBindingIds: [],
            resultBindingEffects: [{ ...resultBindingEffect, bindingId: 'missing-query' }],
          },
        },
      ],
    }).success,
    false,
  );
  assert.equal(
    schemas.ActionResultBindingEffectSchema.safeParse({
      ...resultBindingEffect,
      mappings: resultBindingEffect.mappings.filter(({ targetPath }) => targetPath[0] !== 'id'),
    }).success,
    false,
  );
  assert.equal(
    schemas.ActionResultBindingEffectSchema.safeParse({
      ...resultBindingEffect,
      mappings: [...resultBindingEffect.mappings, resultBindingEffect.mappings[0]],
    }).success,
    false,
  );
  const resultDrivenInteraction = {
    ...statefulPage.interactionBindings[0],
    sourceResultSchemaRevisionRef: page.actionBindings[0].resultSchemaRevisionRef,
    inputMapping: { value: { kind: 'result-field', path: 'recordId' } },
  };
  const resultDrivenPageParse = schemas.PageSchema.safeParse({
    ...statefulPage,
    interactionBindings: [resultDrivenInteraction],
  });
  assert.equal(resultDrivenPageParse.success, true, resultDrivenPageParse.error?.message);
  assert.equal(
    schemas.InteractionBindingSchema.safeParse({
      ...resultDrivenInteraction,
      sourceResultSchemaRevisionRef: undefined,
    }).success,
    false,
  );
  assert.equal(
    schemas.PageSchema.safeParse({
      ...statefulPage,
      interactionBindings: [
        {
          ...resultDrivenInteraction,
          sourceResultSchemaRevisionRef: {
            ...page.actionBindings[0].resultSchemaRevisionRef,
            contentHash: 'f'.repeat(64),
          },
        },
      ],
    }).success,
    false,
  );
  assert.equal(
    schemas.PageSchema.safeParse({
      ...statefulPage,
      interactionBindings: [
        {
          ...resultDrivenInteraction,
          source: { ...resultDrivenInteraction.source, port: 'not-an-action' },
        },
      ],
    }).success,
    false,
  );
  assert.equal(
    schemas.PageSchema.safeParse({
      ...statefulPage,
      queryBindings: [
        {
          ...statefulPage.queryBindings[0],
          parameters: {
            filters: { kind: 'page-state', stateId: 'missing-state' },
          },
        },
      ],
    }).success,
    false,
  );
  assert.equal(
    schemas.PageSchema.safeParse({
      ...statefulPage,
      capabilityInstances: [
        {
          ...statefulPage.capabilityInstances[0],
          activationWhen: {
            operator: 'all',
            conditions: [{ stateId: 'missing-state', predicate: 'truthy' }],
          },
        },
      ],
    }).success,
    false,
  );
  assert.equal(
    schemas.PageStateActivationSchema.safeParse({
      operator: 'all',
      conditions: [{ stateId: 'gallery-filter', predicate: 'truthy' }],
    }).success,
    true,
  );
  assert.equal(
    schemas.PageStateActivationSchema.safeParse({
      operator: 'all',
      conditions: [
        { stateId: 'gallery-filter', predicate: 'truthy' },
        {
          operator: 'any',
          conditions: [
            { stateId: 'gallery-filter', predicate: 'equals', value: null },
            { stateId: 'gallery-filter', predicate: 'not-equals', value: null },
          ],
        },
      ],
    }).success,
    true,
  );
  const nestedUnknownState = schemas.PageSchema.safeParse({
    ...statefulPage,
    capabilityInstances: [
      {
        ...statefulPage.capabilityInstances[0],
        activationWhen: {
          operator: 'all',
          conditions: [
            {
              operator: 'any',
              conditions: [{ stateId: 'missing-nested-state', predicate: 'truthy' }],
            },
          ],
        },
      },
    ],
  });
  assert.equal(nestedUnknownState.success, false);
  assert.match(nestedUnknownState.error?.message ?? '', /missing-nested-state|unknown Page state/i);
  assert.equal(
    schemas.PageStateConditionSchema.safeParse({
      stateId: 'gallery-filter',
      predicate: 'truthy',
      value: true,
    }).success,
    false,
  );
  assert.equal(
    schemas.PageSchema.safeParse({
      ...statefulPage,
      interactionBindings: [
        {
          ...statefulPage.interactionBindings[0],
          targetStateId: 'missing-state',
        },
      ],
    }).success,
    false,
  );
  assert.equal(
    schemas.InteractionBindingSchema.safeParse({
      ...statefulPage.interactionBindings[0],
      script: 'state.filters = intent',
    }).success,
    false,
  );
  for (const unsupportedSource of [
    { kind: 'route-parameter', name: 'recordId' },
    { kind: 'query-parameter', name: 'filter' },
    { kind: 'identity', name: 'userId' },
  ]) {
    assert.equal(
      schemas.InteractionBindingSchema.safeParse({
        ...statefulPage.interactionBindings[0],
        inputMapping: { value: unsupportedSource },
      }).success,
      false,
    );
  }
  assert.equal(
    schemas.DomainQueryDefinitionSchema.safeParse({
      ...queryDefinition,
      endpointUrl: 'https://example.com/query',
    }).success,
    false,
  );
  assert.equal(
    schemas.DomainQueryDefinitionSchema.safeParse({
      ...queryDefinition,
      canonicalDataViewRevisionRef: queryDefinition.viewRevisionRef,
    }).success,
    false,
  );
  assert.equal(
    schemas.DomainQueryDefinitionSchema.safeParse({
      ...queryDefinition,
      accessPolicy: access({
        groupAnyOf: [stable('group', 'group.other', { tenantScope: otherTenantScope })],
      }),
    }).success,
    false,
  );
});
test('Domain Queries distinguish exact Views from tenant-scoped dynamic data sources', () => {
  const inputSchemaRevisionRef = revision('schema', 'query.dynamic.input', {
    visibility: 'global',
  });
  const resultSchemaRevisionRef = revision('schema', 'query.dynamic.result', {
    visibility: 'global',
  });
  const handlerRef = {
    kind: 'domain-query-handler',
    id: 'data.records.collection',
    version: '1',
    ownerRepo: 'monkeys-server',
  };
  const base = {
    contract: 'DomainQueryDefinition',
    schemaVersion: 1,
    tenantScope,
    handlerRef,
    inputSchemaRevisionRef,
    resultSchemaRevisionRef,
    accessPolicy: access({ permissionAllOf: ['data.read'] }),
    lineageRequired: true,
  };
  assert.equal(
    schemas.DomainQueryDefinitionSchema.safeParse({
      ...base,
      queryId: 'query.data.ontologies',
      dataSource: { kind: 'tenant-catalog', resource: 'ontology' },
    }).success,
    true,
  );
  assert.equal(
    schemas.DomainQueryDefinitionSchema.safeParse({
      ...base,
      queryId: 'query.data.views',
      dataSource: {
        kind: 'tenant-catalog',
        resource: 'view',
        ontologyIdParameter: 'ontologyId',
      },
    }).success,
    true,
  );
  assert.equal(
    schemas.DomainQueryDefinitionSchema.safeParse({
      ...base,
      queryId: 'query.data.records',
      dataSource: {
        kind: 'tenant-current-view',
        ontologyIdParameter: 'ontologyId',
        viewIdParameter: 'viewId',
      },
    }).success,
    true,
  );
  const registeredServiceDefinition = {
    ...base,
    queryId: 'kernel.teams.list',
    handlerRef: {
      kind: 'domain-query-handler',
      id: 'kernel.teams.list',
      version: 1,
      ownerRepo: 'monkeys-server',
    },
    dataSource: { kind: 'registered-service' },
  };
  const parsedRegisteredService = schemas.DomainQueryDefinitionSchema.parse(registeredServiceDefinition);
  assert.deepEqual(parsedRegisteredService.dataSource, {
    kind: 'registered-service',
  });
  for (const executableField of [
    { url: 'https://example.com/teams' },
    { method: 'GET' },
    { service: 'TeamRepository' },
    { handlerId: 'kernel.teams.list' },
  ]) {
    assert.equal(
      schemas.DomainQueryDefinitionSchema.safeParse({
        ...registeredServiceDefinition,
        dataSource: { kind: 'registered-service', ...executableField },
      }).success,
      false,
    );
  }
  const localStateDefinition = {
    ...base,
    queryId: 'query.page.filter-context',
    dataSource: { kind: 'page-state' },
  };
  assert.equal(schemas.DomainQueryDefinitionSchema.safeParse(localStateDefinition).success, true);
  assert.equal(
    schemas.QueryBindingSchema.safeParse({
      bindingId: 'filter-context',
      queryDefinitionRevisionRef: revision('domain-query-definition', localStateDefinition.queryId),
      parameters: { search: { kind: 'page-state', stateId: 'search' } },
      target: { capabilityInstanceId: 'context', port: 'model' },
      renderModelSchemaRevisionRef: resultSchemaRevisionRef,
      execution: 'local-state',
      pagination: 'none',
      cache: 'none',
      cancelOnChange: false,
    }).success,
    true,
  );
  assert.equal(
    schemas.QueryBindingSchema.safeParse({
      bindingId: 'filter-context',
      queryDefinitionRevisionRef: revision('domain-query-definition', localStateDefinition.queryId),
      parameters: {},
      target: { capabilityInstanceId: 'context', port: 'model' },
      renderModelSchemaRevisionRef: resultSchemaRevisionRef,
      execution: 'local-state',
      pagination: 'cursor',
      cache: 'none',
      cancelOnChange: false,
    }).success,
    false,
  );
  assert.equal(
    schemas.DomainQueryDefinitionSchema.safeParse({
      ...base,
      queryId: 'query.data.views.invalid',
      dataSource: { kind: 'tenant-catalog', resource: 'view' },
    }).success,
    false,
  );
  assert.equal(
    schemas.DomainQueryDefinitionSchema.safeParse({
      ...base,
      queryId: 'query.data.ontologies.invalid',
      dataSource: {
        kind: 'tenant-catalog',
        resource: 'ontology',
        ontologyIdParameter: 'ontologyId',
      },
    }).success,
    false,
  );
  assert.equal(
    schemas.DomainQueryDefinitionSchema.safeParse({
      ...base,
      queryId: 'query.data.records.invalid',
      dataSource: {
        kind: 'tenant-current-view',
        ontologyIdParameter: 'ontologyId',
        viewIdParameter: 'viewId',
      },
      ontologyDefinitionRevisionRef: page.ontologyBindings[0].ontologyDefinitionRevisionRef,
    }).success,
    false,
  );
  const { handlerRef: _handlerRef, ...withoutHandler } = base;
  assert.equal(
    schemas.DomainQueryDefinitionSchema.safeParse({
      ...withoutHandler,
      queryId: 'query.data.records.no-handler',
      dataSource: {
        kind: 'tenant-current-view',
        ontologyIdParameter: 'ontologyId',
        viewIdParameter: 'viewId',
      },
    }).success,
    false,
  );
  assert.equal(
    schemas.DomainQueryDefinitionSchema.safeParse({
      ...withoutHandler,
      queryId: 'kernel.teams.list.no-handler',
      dataSource: { kind: 'registered-service' },
    }).success,
    false,
  );
});
test('Domain Queries preserve governed live catalog sources without View fallback', () => {
  const inputSchemaRevisionRef = revision('schema', 'query.catalog.input', {
    visibility: 'global',
  });
  const resultSchemaRevisionRef = revision('schema', 'query.catalog.result', {
    visibility: 'global',
  });
  const base = {
    contract: 'DomainQueryDefinition',
    schemaVersion: 1,
    queryId: 'query.data.metadata',
    tenantScope,
    handlerRef: {
      kind: 'domain-query-handler',
      id: 'catalog.data-metadata.list',
      version: '4',
      ownerRepo: 'monkeys-server',
    },
    inputSchemaRevisionRef,
    resultSchemaRevisionRef,
    accessPolicy: access({ permissionAllOf: ['data.read'] }),
    lineageRequired: true,
  };
  for (const resourceKind of ['tag', 'tag-group', 'feature-column']) {
    const parsed = schemas.DomainQueryDefinitionSchema.parse({
      ...base,
      queryId: `query.data.${resourceKind}`,
      dataSource: { kind: 'governed-catalog', resourceKind },
    });
    assert.equal(parsed.dataSource.kind, 'governed-catalog');
    assert.equal(parsed.dataSource.resourceKind, resourceKind);
    assert.equal(Object.hasOwn(parsed, 'ontologyDefinitionRevisionRef'), false);
    assert.equal(Object.hasOwn(parsed, 'viewRevisionRef'), false);
    assert.equal(Object.hasOwn(parsed, 'canonicalDataViewRevisionRef'), false);
  }
  const governed = {
    ...base,
    dataSource: { kind: 'governed-catalog', resourceKind: 'tag' },
  };
  for (const invalidDataSource of [
    { kind: 'governed-catalog', resourceKind: 'ontology' },
    { kind: 'governed-catalog' },
    {
      kind: 'governed-catalog',
      resourceKind: 'tag',
      catalogRevisionRef: revision('governed-catalog', 'catalog.invalid'),
    },
    {
      kind: 'governed-catalog',
      resourceKind: 'tag',
      handlerRevisionRef: revision('domain-query-handler', 'handler.invalid'),
    },
    { kind: 'governed-catalog', resourceKind: 'tag', latest: true },
    { kind: 'exact-view', resourceKind: 'tag' },
    { kind: 'tenant-catalog', resource: 'tag' },
  ]) {
    assert.equal(
      schemas.DomainQueryDefinitionSchema.safeParse({
        ...governed,
        dataSource: invalidDataSource,
      }).success,
      false,
    );
  }
  assert.equal(
    schemas.DomainQueryDefinitionSchema.safeParse({
      ...governed,
      handlerRef: { ...base.handlerRef, version: undefined },
    }).success,
    false,
  );
  assert.equal(
    schemas.DomainQueryDefinitionSchema.safeParse({
      ...governed,
      ontologyDefinitionRevisionRef: revision('ontology-definition', 'ontology.invalid'),
    }).success,
    false,
  );
});
test('Page entry transitions are state-driven governed targets and never raw URLs', () => {
  const panelState = {
    stateId: 'panel',
    schemaRevisionRef: revision('schema', 'page-state.panel', {
      visibility: 'global',
    }),
    defaultValue: 'records',
    persistence: 'url',
  };
  const transition = {
    transitionId: 'open-dashboard',
    activation: {
      operator: 'all',
      conditions: [{ stateId: 'panel', predicate: 'equals', value: 'dashboards' }],
    },
    targetRef: stable('page', 'kernel.page.dashboards'),
    pathParameters: {},
    query: { preserve: true, remove: ['panel'], set: {} },
  };
  assert.equal(
    schemas.PageSchema.safeParse({
      ...page,
      stateDefinitions: [panelState],
      entryTransitions: [transition],
    }).success,
    true,
  );
  assert.equal(
    schemas.PageSchema.safeParse({
      ...page,
      stateDefinitions: [panelState],
      entryTransitions: [{ ...transition, targetRef: stable('page', page.pageId) }],
    }).success,
    false,
  );
  assert.equal(
    schemas.PageSchema.safeParse({
      ...page,
      stateDefinitions: [panelState],
      entryTransitions: [{ ...transition, url: 'https://example.com' }],
    }).success,
    false,
  );
  assert.equal(
    schemas.PageSchema.safeParse({
      ...page,
      stateDefinitions: [panelState],
      entryTransitions: [
        {
          ...transition,
          activation: {
            operator: 'all',
            conditions: [{ stateId: 'missing', predicate: 'truthy' }],
          },
        },
      ],
    }).success,
    false,
  );
});
test('Page state can declare a bounded one-way legacy browser preference import', () => {
  const base = {
    stateId: 'ontologyId',
    schemaRevisionRef: revision('schema', 'page-state.ontology-id', {
      visibility: 'global',
    }),
    defaultValue: '',
    persistence: 'url-with-tenant-preference',
  };
  assert.equal(
    schemas.PageStateDefinitionSchema.safeParse({
      ...base,
      legacyBrowserPreferenceImport: {
        storageKey: 'kernel-data-v2-ontology-selection',
        jsonPath: ['state', 'ontologyIdByTeam', '0'],
        valueType: 'string',
      },
    }).success,
    true,
  );
  assert.equal(
    schemas.PageStateDefinitionSchema.safeParse({
      ...base,
      legacyBrowserPreferenceImport: {
        storageKey: 'kernel-data-v2-ontology-selection',
        jsonPath: [],
        valueType: 'string',
      },
    }).success,
    false,
  );
  assert.equal(
    schemas.PageStateDefinitionSchema.safeParse({
      ...base,
      legacyBrowserPreferenceImport: {
        storageKey: 'kernel-data-v2-ontology-selection',
        valueType: 'script',
      },
    }).success,
    false,
  );
});
test('requires stable scope, immutable revision hashes, and default-locale copy', () => {
  assert.equal(schemas.StableRefSchema.safeParse(stable('page', 'page.example')).success, true);
  assert.equal(
    schemas.StableRefSchema.safeParse({
      kind: 'page',
      id: 'page.example',
      ownerRepo: 'sdk',
      visibility: 'tenant',
    }).success,
    false,
  );
  assert.equal(schemas.RevisionRefSchema.safeParse(revision('page', 'page.example')).success, true);
  assert.equal(
    schemas.RevisionRefSchema.safeParse({
      ...revision('page', 'page.example'),
      contentHash: undefined,
    }).success,
    false,
  );
  assert.equal(schemas.I18nTextSchema.safeParse(text('Hello')).success, true);
  assert.equal(
    schemas.I18nTextSchema.safeParse({ defaultLocale: 'en-US', values: { 'zh-CN': '\u4F60\u597D' } }).success,
    false,
  );
  assert.equal(schemas.I18nTextSchema.safeParse('Hello').success, false);
});
test('keeps AccessPolicy monotonic and rejects executable expressions', () => {
  assert.equal(schemas.AccessPolicySchema.safeParse(access({ permissionAllOf: ['page.read'] })).success, true);
  assert.equal(
    schemas.AccessPolicySchema.safeParse({
      ...access(),
      not: { group: 'blocked' },
    }).success,
    false,
  );
  assert.equal(schemas.AccessPolicySchema.safeParse({ ...access(), script: 'return true' }).success, false);
  assert.equal(
    schemas.AccessPolicySchema.safeParse({
      ...access(),
      groupAllOf: [{ kind: 'group', id: 'group.a' }],
    }).success,
    false,
  );
});
test('rejects arbitrary URLs, traversal, query strings, and invalid RouteSpace paths', () => {
  assert.equal(schemas.RouteSpaceSchema.safeParse(routeSpace).success, true);
  for (const pathTemplate of [
    'https://example.com/gallery',
    '//example.com',
    '/../secret',
    '/gallery?admin=true',
    '/gallery#fragment',
  ]) {
    assert.equal(
      schemas.RouteClaimSchema.safeParse({
        kind: 'canonical',
        routeSpaceRevisionRef: revision('route-space', 'studio.tenant', {
          visibility: 'global',
        }),
        pathTemplate,
      }).success,
      false,
      pathTemplate,
    );
  }
});
test('validates Workbench identity/default boundaries and Navigation tree structure', () => {
  assert.equal(
    schemas.WorkbenchSchema.safeParse({
      ...workbench,
      defaultEntry: {
        groupId: 'missing',
        instanceId: 'product-brief',
        showDefaultGroup: true,
      },
    }).success,
    false,
  );
  assert.equal(
    schemas.WorkbenchSchema.safeParse({
      ...workbench,
      purpose: 'template',
      sourceTemplateRevisionRef: revision('workbench', 'template'),
    }).success,
    false,
  );
  const cycle = navigation.nodes.map((node) =>
    node.nodeId === 'workspace' ? { ...node, parentNodeId: 'gallery' } : node,
  );
  assert.equal(schemas.NavigationSchema.safeParse({ ...navigation, nodes: cycle }).success, false);
  assert.equal(
    schemas.NavigationSchema.safeParse({
      ...navigation,
      nodes: [...navigation.nodes, navigation.nodes[0]],
    }).success,
    false,
  );
});
test('publishes governed alias maps without changing stable identities', () => {
  assert.equal(schemas.StableRefAliasMapSchema.safeParse(stableRefAliasMap).success, true);
  assert.equal(
    schemas.StableRefAliasMapSchema.safeParse({
      ...stableRefAliasMap,
      aliases: [
        {
          ...stableRefAliasMap.aliases[0],
          canonicalRef: stable('page', 'page.other'),
        },
      ],
    }).success,
    false,
  );
});
test('publishes an atomic Publication Plan contract with exact slot heads', () => {
  assert.equal(schemas.PublicationPlanSchema.safeParse(publicationPlan).success, true);
  assert.equal(
    schemas.PublicationPlanSchema.safeParse({
      ...publicationPlan,
      operations: [publicationPlan.operations[0], publicationPlan.operations[0]],
    }).success,
    false,
  );
  assert.equal(
    schemas.PublicationPlanSchema.safeParse({
      ...publicationPlan,
      operations: [{ ...publicationPlan.operations[0], releaseSlotId: 'other-slot' }],
    }).success,
    false,
  );
  assert.equal(
    schemas.PublicationPlanSchema.safeParse({
      ...publicationPlan,
      operations: [
        {
          ...publicationPlan.operations[0],
          releaseRevisionRef: {
            ...publicationPlan.operations[0].releaseRevisionRef,
            tenantScope: {
              ...publicationPlan.operations[0].releaseRevisionRef.tenantScope,
              tenantRef: {
                ...publicationPlan.operations[0].releaseRevisionRef.tenantScope.tenantRef,
                ownerRepo: 'other-tenant-authority',
              },
            },
          },
        },
      ],
    }).success,
    false,
  );
  assert.equal(
    schemas.PublicationPlanSchema.safeParse({
      ...publicationPlan,
      actorRef: { ...publicationPlan.actorRef, kind: 'user' },
    }).success,
    false,
  );
  assert.equal(
    schemas.PublicationPlanSchema.safeParse({
      ...publicationPlan,
      environmentRef: otherTenant(publicationPlan.environmentRef),
    }).success,
    false,
  );
  assert.equal(
    schemas.PublicationPlanSchema.safeParse({
      ...publicationPlan,
      approvalPolicyRevisionRef: otherTenant(publicationPlan.approvalPolicyRevisionRef),
    }).success,
    false,
  );
  assert.equal(
    schemas.PublicationPlanSchema.safeParse({
      ...publicationPlan,
      approvalDecisionRevisionRef: otherTenant(publicationPlan.approvalDecisionRevisionRef),
    }).success,
    false,
  );
  assert.equal(
    schemas.PublicationPlanSchema.safeParse({
      ...publicationPlan,
      actorRef: otherTenant(publicationPlan.actorRef),
    }).success,
    false,
  );
  assert.equal(
    schemas.PublicationPlanSchema.safeParse({
      ...publicationPlan,
      evidenceRefs: [otherTenant(publicationPlan.evidenceRefs[0])],
    }).success,
    false,
  );
});
test('release evidence pins matching old heads and dependency roles', () => {
  assert.equal(
    schemas.PageReleaseSchema.safeParse({
      ...pageRelease,
      evidence: {
        ...pageRelease.evidence,
        expectedHeadRevisionRef: revision('page-release', 'other-slot'),
      },
    }).success,
    false,
  );
  assert.equal(
    schemas.PageReleaseSchema.safeParse({
      ...pageRelease,
      dependencySnapshot: [
        {
          role: 'provider',
          revisionRef: revision('capability', 'wrong-kind', {
            visibility: 'global',
          }),
        },
      ],
    }).success,
    false,
  );
});
test('Page and Workbench releases accept only fully legacy or target-bound compiled route surfaces', () => {
  for (const [schema, release] of [
    [schemas.PageReleaseSchema, pageRelease],
    [schemas.WorkbenchReleaseSchema, workbenchRelease],
  ]) {
    const explicit = {
      ...release,
      target: {
        ...release.target,
        routeClaim: {
          ...release.target.routeClaim,
          surface: release.target.surface,
          matcher: {
            ...release.target.routeClaim.matcher,
            surface: release.target.surface,
          },
        },
      },
    };
    assert.equal(schema.safeParse(release).success, true);
    assert.equal(schema.safeParse(explicit).success, true);
    assert.equal(
      schema.safeParse({
        ...explicit,
        target: {
          ...explicit.target,
          routeClaim: {
            ...explicit.target.routeClaim,
            matcher: release.target.routeClaim.matcher,
          },
        },
      }).success,
      false,
    );
    assert.equal(
      schema.safeParse({
        ...explicit,
        target: {
          ...explicit.target,
          routeClaim: {
            ...explicit.target.routeClaim,
            matcher: {
              ...explicit.target.routeClaim.matcher,
              surface: explicit.target.surface === 'studio' ? 'kernel' : 'studio',
            },
          },
        },
      }).success,
      false,
    );
  }
});
test('all Release families fence governance evidence to the Release tenant or explicit global scope', () => {
  const releaseFamilies = [
    [schemas.PageReleaseSchema, pageRelease, 'page-release'],
    [schemas.WorkbenchReleaseSchema, workbenchRelease, 'workbench-release'],
    [schemas.NavigationReleaseSchema, navigationRelease, 'navigation-release'],
  ];
  const evidenceMutations = [
    (release) => ({
      ...release.evidence,
      publicationPlanRef: otherTenant(release.evidence.publicationPlanRef),
    }),
    (release) => ({
      ...release.evidence,
      approvalPolicyRevisionRef: otherTenant(release.evidence.approvalPolicyRevisionRef),
    }),
    (release) => ({
      ...release.evidence,
      approvalDecisionRevisionRef: otherTenant(release.evidence.approvalDecisionRevisionRef),
    }),
    (release) => ({
      ...release.evidence,
      actorRef: otherTenant(release.evidence.actorRef),
    }),
    (release) => ({
      ...release.evidence,
      evidenceRefs: [otherTenant(release.evidence.evidenceRefs[0])],
    }),
    (release) => ({
      ...release.evidence,
      validation: {
        ...release.evidence.validation,
        diagnosticRefs: [
          revision('diagnostic', 'release.validation.other', {
            tenantScope: otherTenantScope,
          }),
        ],
      },
    }),
  ];
  for (const [schema, release, releaseKind] of releaseFamilies) {
    for (const mutateEvidence of evidenceMutations) {
      assert.equal(schema.safeParse({ ...release, evidence: mutateEvidence(release) }).success, false);
    }
    assert.equal(
      schema.safeParse({
        ...release,
        evidence: {
          ...release.evidence,
          expectedHeadRevisionRef: otherTenant(revision(releaseKind, release.releaseSlotId)),
        },
      }).success,
      false,
    );
    assert.equal(
      schema.safeParse({
        ...release,
        evidence: {
          ...release.evidence,
          publicationPlanRef: explicitGlobal(release.evidence.publicationPlanRef),
          approvalPolicyRevisionRef: explicitGlobal(release.evidence.approvalPolicyRevisionRef),
          approvalDecisionRevisionRef: explicitGlobal(release.evidence.approvalDecisionRevisionRef),
          actorRef: explicitGlobal(release.evidence.actorRef),
          evidenceRefs: release.evidence.evidenceRefs.map(explicitGlobal),
          validation: {
            ...release.evidence.validation,
            diagnosticRefs: [
              revision('diagnostic', 'release.validation.global', {
                visibility: 'global',
              }),
            ],
          },
        },
      }).success,
      true,
    );
  }
});
test('legacy restoration provenance follows the same tenant/global Release evidence boundary', () => {
  const releases = [
    [schemas.PageReleaseSchema, pageRelease, 'legacy-route-adapter'],
    [schemas.WorkbenchReleaseSchema, workbenchRelease, 'legacy-workbench-adapter'],
    [schemas.NavigationReleaseSchema, navigationRelease, 'legacy-navigation-adapter'],
  ];
  for (const [schema, release, adapterKind] of releases) {
    const legacyRestoration = {
      legacyAdapterRevisionRef: revision(adapterKind, `${adapterKind}.tenant`, {
        tenantScope: otherTenantScope,
      }),
      sourceRevisionRef: revision('legacy-config-source', `${adapterKind}.source`, { tenantScope: otherTenantScope }),
      inspectedSourceContentHash: HASH_A,
    };
    assert.equal(schema.safeParse({ ...release, operation: 'rollback', legacyRestoration }).success, false);
    assert.equal(
      schema.safeParse({
        ...release,
        operation: 'rollback',
        legacyRestoration: {
          ...legacyRestoration,
          legacyAdapterRevisionRef: explicitGlobal(legacyRestoration.legacyAdapterRevisionRef),
          sourceRevisionRef: explicitGlobal(legacyRestoration.sourceRevisionRef),
        },
      }).success,
      true,
    );
  }
});
test('legacy restoration is exact, explicit and never inferred from deactivation', () => {
  const sourceRevisionRef = revision('legacy-config-source', 'server.ui.menus', {
    visibility: 'global',
    ownerRepo: 'monkeys-server',
  });
  const legacyRestoration = {
    legacyAdapterRevisionRef: revision('legacy-route-adapter', 'kernel.page.data-assets', {
      visibility: 'global',
      ownerRepo: 'monkeys',
    }),
    sourceRevisionRef,
    inspectedSourceContentHash: sourceRevisionRef.contentHash,
  };
  assert.equal(
    schemas.PageReleaseSchema.safeParse({
      ...pageRelease,
      operation: 'deactivate',
      legacyRestoration,
    }).success,
    true,
  );
  assert.equal(
    schemas.PageReleaseSchema.safeParse({
      ...pageRelease,
      operation: 'activate',
      legacyRestoration,
    }).success,
    false,
  );
  assert.equal(
    schemas.PageReleaseSchema.safeParse({
      ...pageRelease,
      operation: 'deactivate',
      legacyRestoration: {
        ...legacyRestoration,
        inspectedSourceContentHash: 'b'.repeat(64),
      },
    }).success,
    false,
  );
  assert.equal(
    schemas.PageReleaseSchema.safeParse({
      ...pageRelease,
      operation: 'deactivate',
      legacyRestoration: {
        ...legacyRestoration,
        legacyAdapterRevisionRef: revision('legacy-workbench-adapter', 'wrong'),
      },
    }).success,
    false,
  );
  assert.equal(
    schemas.PageReleaseSchema.safeParse({
      ...pageRelease,
      operation: 'deactivate',
    }).success,
    true,
  );
});
test('preserves legacy PageDefinition and MenuDefinition contracts unchanged', () => {
  const legacyPage = page.renderTree.nodes[0].pageRef;
  assert.equal(legacyPage.kind, 'page');
  assert.equal(typeof schemas.PageDefinitionSchema.parse, 'function');
  assert.equal(typeof schemas.MenuDefinitionSchema.parse, 'function');
  assert.equal(
    schemas.MenuDefinitionSchema.parse({
      contract: 'MenuDefinition',
      version: 1,
      applicationId: 'studio',
      surface: 'headerbar',
      menuId: 'primary',
      nodes: [],
      contributions: [],
    }).contract,
    'MenuDefinition',
  );
});
test('publishes bounded authoring resource and searchable choice page contracts', () => {
  assert.deepEqual(
    schemas.DeclarativeAuthoringResourcePageQuerySchema.parse({
      pageSize: 25,
      search: 'gallery',
    }),
    {
      pageSize: 25,
      search: 'gallery',
    },
  );
  assert.deepEqual(
    schemas.DeclarativeAuthoringChoicePageQuerySchema.parse({
      choiceKind: 'ontology',
      pageSize: 20,
    }),
    {
      choiceKind: 'ontology',
      pageSize: 20,
    },
  );
  assert.equal(
    schemas.DeclarativeAuthoringResourcePageSchema.safeParse({
      items: [],
      pageInfo: {
        hasMore: true,
        nextPageToken: 'resource-next',
        pageSize: 60,
        returned: 0,
      },
    }).success,
    true,
  );
  assert.equal(
    schemas.DeclarativeAuthoringChoicePageSchema.safeParse({
      choiceKind: 'view',
      items: [],
      pageInfo: { hasMore: false, pageSize: 60, returned: 0 },
    }).success,
    true,
  );
  assert.equal(
    schemas.DeclarativeAuthoringChoicePageSchema.safeParse({
      choiceKind: 'view',
      items: [],
      pageInfo: { hasMore: true, pageSize: 60, returned: 0 },
    }).success,
    false,
  );
  assert.equal(
    schemas.DeclarativeAuthoringChoicePageQuerySchema.safeParse({
      choiceKind: 'view',
      pageSize: 201,
    }).success,
    false,
  );
});

test('Action result effects and clipboard sinks remain finite and verified', () => {
  const removal = {
    bindingId: 'records',
    operation: 'remove-exact',
    collectionPath: ['rows'],
    identityPath: ['id'],
    mappings: [
      {
        targetPath: ['id'],
        source: { kind: 'result-field', path: 'deleted.id' },
      },
    ],
  };
  assert.equal(schemas.ActionResultBindingEffectSchema.safeParse(removal).success, true);
  assert.equal(
    schemas.ActionResultBindingEffectSchema.safeParse({
      ...removal,
      mappings: [...removal.mappings, { targetPath: ['name'], source: { kind: 'constant', value: 'ignored' } }],
    }).success,
    false,
  );
  assert.equal(
    schemas.ActionResultClipboardEffectSchema.safeParse({
      source: { kind: 'result-field', path: 'job.logId' },
      copiedToast: text('Copied'),
      fallbackToast: text('Job id: {value}'),
    }).success,
    true,
  );
  assert.equal(
    schemas.ActionResultClipboardEffectSchema.safeParse({
      source: { kind: 'constant', value: 'not-verified' },
      fallbackToast: text('Fallback {value}'),
    }).success,
    false,
  );
  assert.equal(
    schemas.ActionResultClipboardEffectSchema.safeParse({
      source: { kind: 'result-field', path: 'job.logId' },
      fallbackToast: text('Copied'),
    }).success,
    false,
  );
});

test('Preference partitions require preference persistence', () => {
  const definition = {
    stateId: 'ontologyId',
    schemaRevisionRef: revision('schema', 'state.identifier'),
    defaultValue: '',
    persistence: 'tenant-preference',
    preferencePartitionStateId: 'teamId',
    legacyBrowserPreferenceImport: {
      storageKey: 'legacy',
      jsonPath: ['state', { stateId: 'teamId' }],
      valueType: 'string',
    },
  };
  assert.equal(schemas.PageStateDefinitionSchema.safeParse(definition).success, true);
  assert.equal(schemas.PageStateDefinitionSchema.safeParse({ ...definition, persistence: 'session' }).success, false);
});


test('entry transitions accept only named route parameters as route sources', () => {
  const sourcePage = { ...page, routeClaims: page.routeClaims.map(claim => ({ ...claim, pathTemplate: '/workloads/:workloadId/configuration' })) };
  const state = { stateId: 'cancel', schemaRevisionRef: revision('schema', 'page-state.cancel', { visibility: 'global' }), defaultValue: false, persistence: 'none' };
  const entry = {
    transitionId: 'cancel-to-detail',
    activation: { operator: 'all', conditions: [{ stateId: 'cancel', predicate: 'truthy' }] },
    targetRef: stable('page', 'kernel.page.workload-detail'),
    pathParameters: { workloadId: { kind: 'route-parameter', name: 'workloadId' } },
    query: { preserve: false, remove: [], set: {} },
  };
  assert.equal(schemas.PageSchema.safeParse({ ...sourcePage, stateDefinitions: [state], entryTransitions: [entry] }).success, true);
  for (const source of [{ kind: 'route-parameter', name: '' }, { kind: 'route-parameter', name: 'unknown' }, { kind: 'route-parameter', name: 'workloadId', value: 'forged' }, { kind: 'query-parameter', name: 'workloadId' }]) {
    assert.equal(schemas.PageSchema.safeParse({ ...sourcePage, stateDefinitions: [state], entryTransitions: [{ ...entry, pathParameters: { workloadId: source } }] }).success, false);
  }
});
