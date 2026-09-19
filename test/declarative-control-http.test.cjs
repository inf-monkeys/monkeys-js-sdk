const test = require('node:test');
const assert = require('node:assert/strict');
const sdk = require('../lib');
const fixture = require('./declarative-control-fixtures.cjs');

test('declarative control route builder owns canonical encoded URLs', () => {
  assert.equal(sdk.declarativeControlRoutes.draft('page', 'gallery/main'), '/api/declarative-control/resources/page/gallery%2Fmain/draft');
  assert.equal(sdk.declarativeControlRoutes.authoringPrepare('navigation', 'main', 'rollback'), '/api/declarative-control/authoring/resources/navigation/main/rollback');
  assert.equal(sdk.declarativeControlRoutes.runtimeResolve(), '/api/declarative-control/runtime/resolve');
  assert.equal(Object.hasOwn(sdk.declarativeControlRoutes, 'runtimeRouteOwner'), false);
  for (const action of ['validate', 'preview', 'publish']) {
    assert.equal(sdk.declarativeControlRoutes[action]('page', 'gallery/main'), `/api/declarative-control/resources/page/gallery%2Fmain/${action}`);
  }
  assert.equal(sdk.declarativeControlRoutes.rollback('page', 'gallery/main', 'slot/main'), '/api/declarative-control/resources/page/gallery%2Fmain/releases/slot%2Fmain/rollback');
  assert.equal(sdk.declarativeControlRoutes.slotAuthority('page', 'slot/main'), '/api/declarative-control/slot-authorities/page/slot%2Fmain');
  assert.equal(sdk.declarativeControlRoutes.authoringCreate('workbench'), '/api/declarative-control/authoring/resources/workbench');
  assert.equal(sdk.declarativeControlRoutes.authoringHistory('page', 'gallery/main'), '/api/declarative-control/authoring/resources/page/gallery%2Fmain/history');
  assert.equal(sdk.declarativeControlRoutes.runtimeBindingQuery('page/slot', 'gallery/items'), '/api/declarative-control/runtime/pages/page%2Fslot/bindings/gallery%2Fitems/query');
  assert.equal(sdk.declarativeControlRoutes.runtimePreviewBindingQuery('gallery/items'), '/api/declarative-control/runtime/previews/bindings/gallery%2Fitems/query');
  assert.equal(sdk.declarativeControlRoutes.runtimeActionExecute('page/slot', 'gallery/favorite'), '/api/declarative-control/runtime/pages/page%2Fslot/actions/gallery%2Ffavorite/execute');
  assert.equal(sdk.declarativeControlRoutes.runtimeNavigationActionExecute('navigation/slot', 'user/rebuild'), '/api/declarative-control/runtime/navigations/navigation%2Fslot/actions/user%2Frebuild/execute');
  assert.equal(sdk.declarativeControlRoutes.navigationSeedMigration('kernel/primary'), '/api/declarative-control/authoring/navigation/placements/kernel%2Fprimary/seed-migration');
  assert.equal(sdk.declarativeControlRoutes.publicationPlan(), '/api/declarative-control/authoring/publication-plans');
});

test('navigation seed migration contracts preserve the R3 fail-closed result states', () => {
  const revisionRef = { kind: 'navigation', id: 'kernel.primary', ownerRepo: 'monkeys', visibility: 'global', revision: 1, schemaVersion: 1, contentHash: 'a'.repeat(64) };
  assert.equal(sdk.DeclarativeNavigationSeedMigrationIntentSchema.safeParse({ idempotencyKey: 'kernel.primary:seed:1' }).success, true);
  assert.equal(sdk.DeclarativeNavigationSeedMigrationResultSchema.safeParse({
    outcome: 'review-required', placement: 'kernel.primary', legacyContentHash: 'b'.repeat(64), templateRevisionRef: revisionRef,
    draftRevisionRef: revisionRef, requiresReview: true, diff: [],
  }).success, true);
  assert.equal(sdk.DeclarativeNavigationSeedMigrationResultSchema.safeParse({
    outcome: 'review-required', placement: 'kernel.primary', legacyContentHash: 'b'.repeat(64), templateRevisionRef: revisionRef,
    requiresReview: false, diff: [],
  }).success, false);
  assert.equal(sdk.DeclarativeNavigationSeedMigrationResultSchema.safeParse({
    outcome: 'published', placement: 'kernel.primary', legacyContentHash: 'b'.repeat(64), templateRevisionRef: revisionRef,
    requiresReview: false, diff: [],
  }).success, false);
});

test('retired migration routes and DTOs are absent while historical takeover contracts remain', () => {
  for (const route of ['migrationInspect', 'migrationCreateDraft', 'migrationCutover', 'migrationRollback']) assert.equal(Object.hasOwn(sdk.declarativeControlRoutes, route), false);
  for (const name of ['DeclarativeLegacyMigrationInspectionSchema', 'DeclarativeLegacyMigrationCreateDraftIntentSchema', 'DeclarativeLegacyMigrationCreateDraftResultSchema']) assert.equal(Object.hasOwn(sdk, name), false);
  const revision = (kind, id, ownerRepo = 'monkeys') => ({ kind, id, ownerRepo, visibility: 'global', revision: 1, schemaVersion: 1, contentHash: 'a'.repeat(64) });
  const stable = (kind, id, ownerRepo = 'monkeys-server') => ({ kind, id, ownerRepo, visibility: 'global' });
  const workbenchInput = {
    contract: 'LegacyRouteTakeoverAuthorization', schemaVersion: 1,
    routeSpaceRevisionRef: revision('route-space', 'studio', 'monkeys'), normalizedPath: '/studio/studio-1',
    legacyAdapterRevisionRef: revision('legacy-route-adapter', 'studio-1'), sourceRevisionRef: revision('legacy-workbench-source', 'studio-1'),
    inspectedSourceContentHash: 'a'.repeat(64), targetResourceRef: stable('workbench', 'studio-1'),
  };
  assert.throws(() => sdk.compileLegacyRouteTakeoverAuthorization(workbenchInput));
  assert.deepEqual(
    sdk.compileLegacyRouteTakeoverAuthorization({ ...workbenchInput, workbenchCatalogDefaults: { order: 17, isDefaultCandidate: true } }).workbenchCatalogDefaults,
    { order: 17, isDefaultCandidate: true },
  );
});

test('browser-safe runtime resolve outcomes never expose owner metadata before authorization', () => {
  const base = {
    surface: 'studio', normalizedPath: '/gallery', routeParameters: {}, generation: 9,
    etag: '"runtime-9"', contentHash: 'a'.repeat(64),
  };
  for (const [outcome, code] of [
    ['unavailable', 'DECLARATIVE_ROUTE_UNAVAILABLE'],
    ['not-found', 'DECLARATIVE_ROUTE_NOT_FOUND'],
  ]) {
    const parsed = sdk.DeclarativeRuntimeResolveResultSchema.parse({ ...base, outcome, code });
    assert.equal(Object.hasOwn(parsed, 'releaseSlotId'), false);
    assert.equal(Object.hasOwn(parsed, 'activeReleaseRevisionRef'), false);
    assert.equal(Object.hasOwn(parsed, 'resourceKind'), false);
    assert.equal(sdk.DeclarativeRuntimeResolveResultSchema.safeParse({
      ...base, outcome, code, releaseSlotId: 'secret-slot',
    }).success, false);
  }
  for (const [resourceKind, code] of [
    ['page', 'DECLARATIVE_PAGE_FORBIDDEN'],
    ['workbench', 'DECLARATIVE_WORKBENCH_FORBIDDEN'],
  ]) {
    const parsed = sdk.DeclarativeRuntimeResolveResultSchema.parse({ ...base, outcome: 'forbidden', resourceKind, code });
    assert.equal(parsed.resourceKind, resourceKind);
    assert.equal(Object.hasOwn(parsed, 'releaseSlotId'), false);
    assert.equal(Object.hasOwn(parsed, 'activeReleaseRevisionRef'), false);
    assert.equal(sdk.DeclarativeRuntimeResolveResultSchema.safeParse({
      ...base, outcome: 'forbidden', resourceKind, code, releaseSlotId: 'secret-slot',
    }).success, false);
  }
  assert.equal(sdk.DeclarativeRuntimeResolveResultSchema.safeParse({ ...base, outcome: 'forbidden', code: 'DECLARATIVE_PAGE_FORBIDDEN' }).success, false);
  assert.equal(
    sdk.DeclarativeRuntimeResolveResultSchema.safeParse({ ...base, outcome: 'forbidden', resourceKind: 'workbench', code: 'DECLARATIVE_PAGE_FORBIDDEN' }).success,
    false,
  );
});

test('declarative rollout is disabled when absent and enabled only for declared surfaces', () => {
  assert.equal(sdk.isDeclarativeRuntimeEnabled({}, 'studio'), false);
  const disabled = {
    contract: 'DeclarativeRuntimeRolloutCapability', schemaVersion: 1, state: 'disabled',
    apiVersion: 'declarative-control-v1', enabledSurfaces: ['studio', 'kernel'], generation: 1, etag: '"rollout-1"',
  };
  assert.equal(sdk.DeclarativeRuntimeRolloutCapabilitySchema.safeParse(disabled).success, true);
  assert.equal(sdk.isDeclarativeRuntimeEnabled({ declarativeRuntime: disabled }, 'studio'), false);
  const enabled = { ...disabled, state: 'enabled', enabledSurfaces: ['studio'] };
  assert.equal(sdk.isDeclarativeRuntimeEnabled({ declarativeRuntime: enabled }, 'studio'), true);
  assert.equal(sdk.isDeclarativeRuntimeEnabled({ declarativeRuntime: enabled }, 'kernel'), false);
});

test('runtime route owner is fenced for authenticated team-scoped product routes', () => {
  const ref = (kind, id) => ({ kind, id, ownerRepo: 'monkeys-server', visibility: 'global', revision: 1, schemaVersion: 1, contentHash: 'a'.repeat(64) });
  const base = { surface: 'studio', normalizedPath: '/customers/42', routeParameters: { customerId: '42' } };
  const legacy = {
    ...base,
    owner: { authority: 'legacy', legacyAdapterRevisionRef: ref('legacy-route-adapter', 'customers'), generation: 7, etag: '"legacy-7"' },
  };
  const legacyUnsigned = { ...legacy };
  assert.equal(sdk.DeclarativeRuntimeRouteOwnerSchema.safeParse({ ...legacy, contentHash: sdk.canonicalContentHash(legacyUnsigned) }).success, true);
  const declarative = {
    ...base,
    owner: {
      authority: 'declarative', resourceKind: 'page', releaseSlotId: 'customers-slot',
      activeReleaseRevisionRef: ref('page-release', 'customers-slot'), generation: 3, etag: '"release-3"',
    },
  };
  assert.equal(sdk.DeclarativeRuntimeRouteOwnerSchema.safeParse({ ...declarative, contentHash: sdk.canonicalContentHash(declarative) }).success, true);
  assert.equal(sdk.DeclarativeRuntimeRouteOwnerSchema.safeParse({ ...legacy, routeParameters: JSON.parse('{"__proto__":"unsafe"}'), contentHash: 'b'.repeat(64) }).success, false);
  assert.equal(sdk.DeclarativeRuntimeRouteOwnerSchema.safeParse({ ...legacy, owner: { authority: 'legacy', legacyAdapterRevisionRef: ref('legacy-route-adapter', 'customers') }, contentHash: 'b'.repeat(64) }).success, false);
});

test('runtime query and binding parameter limits fail closed', () => {
  const ref = (kind, id) => ({ kind, id, ownerRepo: 'monkeys-server', visibility: 'global', revision: 1, schemaVersion: 1, contentHash: 'a'.repeat(64) });
  const target = { activeReleaseRevisionRef: ref('page-release', 'page-slot'), pageRevisionRef: ref('page', 'gallery') };
  const legacyAction = { ...target, intent: { recordId: 'asset-1' }, idempotencyKey: 'legacy-action-1' };
  assert.deepEqual(sdk.LegacyDeclarativeRuntimeActionExecuteIntentSchema.parse(legacyAction).pageState, {});
  assert.equal(sdk.LegacyDeclarativeRuntimeActionExecuteIntentSchema.safeParse({ ...legacyAction, unknown: true }).success, false);
  assert.equal(sdk.LegacyDeclarativeRuntimeActionExecuteIntentSchema.safeParse({ ...legacyAction, pageRevisionRef: ref('workbench', 'wrong') }).success, false);
  assert.equal(sdk.DeclarativeRuntimeResolveQuerySchema.safeParse({ surface: 'studio', path: `/${'x'.repeat(2048)}` }).success, false);
  assert.equal(sdk.DeclarativeRuntimeBindingQueryIntentSchema.safeParse({ ...target, parameters: Object.fromEntries(Array.from({ length: 33 }, (_, index) => [`key${index}`, index])) }).success, false);
  let nested = { value: 'leaf' };
  for (let index = 0; index < 9; index += 1) nested = { value: nested };
  assert.equal(sdk.DeclarativeRuntimeBindingQueryIntentSchema.safeParse({ ...target, parameters: nested }).success, false);
  assert.equal(sdk.DeclarativeRuntimeBindingQueryIntentSchema.safeParse({ ...target, parameters: { constructor: 'unsafe' } }).success, false);
  assert.equal(sdk.DeclarativeRuntimeBindingQueryIntentSchema.safeParse({ ...target, parameters: { value: 'x'.repeat(17 * 1024) } }).success, false);
});

test('runtime resolve accepts a Server-owned default environment or an explicit canonical environment', () => {
  assert.equal(
    sdk.DeclarativeRuntimeResolveQuerySchema.safeParse({ surface: 'studio', path: '/gallery' }).success,
    true,
  );
  assert.equal(
    sdk.DeclarativeRuntimeResolveQuerySchema.safeParse({
      environmentId: 'monkeys.environment.production',
      surface: 'studio',
      path: '/gallery',
    }).success,
    true,
  );
  assert.equal(
    sdk.DeclarativeRuntimeResolveQuerySchema.safeParse({ environmentId: '', surface: 'studio', path: '/gallery' }).success,
    false,
  );
});

test('runtime binding and action intents require exact page release and definition revisions', () => {
  const ref = (kind, id) => ({ kind, id, ownerRepo: 'monkeys-server', visibility: 'global', revision: 1, schemaVersion: 1, contentHash: 'a'.repeat(64) });
  const target = { activeReleaseRevisionRef: ref('page-release', 'page-slot'), pageRevisionRef: ref('page', 'gallery') };
  assert.equal(sdk.DeclarativeRuntimeBindingQueryIntentSchema.safeParse({ ...target, parameters: { keyword: 'coat' }, pageSize: 60 }).success, true);
  assert.equal(
    sdk.DeclarativeRuntimeActionExecuteIntentSchema.safeParse({
      ...target,
      intent: { recordId: 'asset-1' },
      pageState: { selectedRecordId: 'asset-1' },
      idempotencyKey: 'interaction-1',
    }).success,
    true,
  );
  assert.equal(
    sdk.DeclarativeRuntimeActionExecuteIntentSchema.safeParse({
      ...target,
      intent: { recordId: 'asset-1' },
      idempotencyKey: 'interaction-1',
    }).success,
    false,
  );
  assert.equal(
    sdk.DeclarativeRuntimeActionExecuteIntentSchema.safeParse({
      ...target,
      intent: {},
      pageState: Object.fromEntries(Array.from({ length: 33 }, (_, index) => [`state${index}`, index])),
      idempotencyKey: 'interaction-1',
    }).success,
    false,
  );
  assert.equal(sdk.DeclarativeRuntimeBindingQueryIntentSchema.safeParse({ ...target, activeReleaseRevisionRef: ref('page-release', 'stale'), unknown: true }).success, false);
  assert.equal(
    sdk.DeclarativeRuntimeActionExecuteIntentSchema.safeParse({
      ...target,
      pageRevisionRef: ref('workbench', 'wrong'),
      intent: {},
      pageState: {},
      idempotencyKey: 'interaction-1',
    }).success,
    false,
  );
  const navigationTarget = { activeReleaseRevisionRef: ref('navigation-release', 'navigation-slot'), navigationRevisionRef: ref('navigation', 'user-menu') };
  assert.equal(sdk.DeclarativeRuntimeNavigationActionExecuteIntentSchema.safeParse({ ...navigationTarget, intent: { scope: 'current' }, idempotencyKey: 'navigation-action-1' }).success, true);
  assert.equal(sdk.DeclarativeRuntimeNavigationActionExecuteIntentSchema.safeParse({ ...navigationTarget, activeReleaseRevisionRef: ref('page-release', 'wrong'), idempotencyKey: 'navigation-action-1' }).success, false);
});

test('governed Schema and View records pin the exact Ontology render-model boundary', () => {
  const ref = (kind, id) => ({ kind, id, ownerRepo: 'monkeys-data-server', visibility: 'global', revision: 1, schemaVersion: 1, contentHash: 'a'.repeat(64) });
  const schema = {
    contract: 'Schema',
    schemaVersion: 1,
    schemaId: 'render-model.gallery',
    ownerRepo: 'monkeys-data-server',
    dialect: 'https://json-schema.org/draft/2020-12/schema',
    document: { type: 'object', additionalProperties: false, properties: { items: { type: 'array' } }, required: ['items'] },
  };
  const view = {
    contract: 'View',
    schemaVersion: 1,
    viewId: 'view.inspiration.gallery',
    ownerRepo: 'monkeys-data-server',
    ontologyDefinitionRevisionRef: ref('ontology-definition', 'ontology.inspiration'),
    canonicalDataViewRevisionRef: ref('view', 'data.view.inspiration.gallery'),
    renderModelSchemaRevisionRef: ref('schema', schema.schemaId),
    requiredPermissionCodes: ['inspiration.read'],
  };
  assert.equal(sdk.SchemaDefinitionSchema.safeParse(schema).success, true);
  assert.equal(sdk.OntologyViewDefinitionSchema.safeParse(view).success, true);
  assert.equal(sdk.OntologyViewDefinitionSchema.safeParse({ ...view, canonicalDataViewRevisionRef: ref('schema', 'wrong') }).success, false);
  const { canonicalDataViewRevisionRef: _omitted, ...viewWithoutCanonicalDataView } = view;
  assert.equal(sdk.OntologyViewDefinitionSchema.safeParse(viewWithoutCanonicalDataView).success, false);
  assert.deepEqual(sdk.LegacyOntologyViewDefinitionSchema.parse(viewWithoutCanonicalDataView), viewWithoutCanonicalDataView);
  assert.equal(sdk.LegacyOntologyViewDefinitionSchema.safeParse(view).success, false);
  assert.equal(sdk.LegacyOntologyViewDefinitionSchema.safeParse({ ...viewWithoutCanonicalDataView, renderModelSchemaRevisionRef: ref('view', 'wrong') }).success, false);
  assert.equal(sdk.OntologyViewDefinitionSchema.safeParse({ ...view, renderModelSchemaRevisionRef: ref('view', 'wrong') }).success, false);
  assert.equal(sdk.SchemaDefinitionSchema.safeParse({ ...schema, executable: 'return true' }).success, false);
});

test('Design authoring registrations publish every exact schema document needed by authoring and runtime', () => {
  const document = { type: 'object', additionalProperties: false, properties: { items: { type: 'array' } }, required: ['items'] };
  const ref = (kind, id, contentHash = sdk.canonicalContentHash(document)) => ({ kind, id, ownerRepo: 'monkeys-design', visibility: 'global', revision: 1, schemaVersion: 1, contentHash });
  const schemaRef = ref('schema', 'monkeys-design://gallery/v1');
  const registration = {
    registrationRevisionRef: ref('design-capability-registration', 'gallery.authoring'),
    capabilityRevisionRef: ref('capability', 'gallery'),
    providerRevisionRef: ref('view-provider', 'gallery.provider'),
    propertySchemaRevisionRef: schemaRef,
    uiSchemaRevisionRef: schemaRef,
    editorEligible: true,
    category: 'data-view',
    label: fixture.text('Gallery'),
    description: fixture.text('Gallery'),
    supportedSurfaces: ['studio'],
    allowedSlots: [],
    allowedParentCapabilityRefs: [],
    allowedChildCapabilityRefs: [],
    inputPorts: [{ name: 'items', schemaRevisionRef: schemaRef, required: true, multiple: false }],
    outputPorts: [],
    allowedSideEffects: [],
    ontologyRequirements: [{ inputPort: 'items', renderModelSchemaRevisionRef: schemaRef, modes: ['view'], requiredPermissionCodes: [] }],
    actionRequirements: [],
    propertyFields: [],
    schemaDocuments: [{ schemaRevisionRef: schemaRef, document }],
    sourceContentHash: 'a'.repeat(64),
  };
  assert.equal(sdk.DeclarativeCapabilityAuthoringRegistrationSchema.safeParse(registration).success, true);
  assert.equal(sdk.DeclarativeCapabilityAuthoringRegistrationSchema.safeParse({ ...registration, schemaDocuments: [] }).success, false);
  assert.equal(sdk.DeclarativeCapabilityAuthoringRegistrationSchema.safeParse({ ...registration, schemaDocuments: [...registration.schemaDocuments, ...registration.schemaDocuments] }).success, false);
  assert.equal(sdk.DeclarativeCapabilitySchemaDocumentSchema.safeParse({ schemaRevisionRef: ref('view', 'wrong'), document }).success, false);
});

test('authoring intent rejects complete release documents and arbitrary fields', () => {
  const tenantScope = {
    tenantRef: { kind: 'tenant', id: 'tenant', ownerRepo: 'monkeys-server' },
    dataSpaceRef: { kind: 'data-space', id: 'monkeys-control', ownerRepo: 'monkeys-data-server' },
    teamRef: { kind: 'team', id: 'team', ownerRepo: 'monkeys-server' },
  };
  const environmentRef = { kind: 'environment', id: 'prod', ownerRepo: 'monkeys-server', visibility: 'tenant', tenantScope };
  const environmentRevisionRef = { ...environmentRef, revision: 2, schemaVersion: 1, contentHash: 'e'.repeat(64) };
  const valid = {
    idempotencyKey: 'publish-1',
    definitionVersion: 2,
    releaseSlotId: 'slot-1',
    releaseExpectedVersion: 1,
    publicationExpectedGeneration: 3,
    target: { environmentRef, environmentRevisionRef, surface: 'studio', routeClaimIndex: 0 },
  };
  assert.equal(sdk.DeclarativeCommandIntentSchema.safeParse(valid).success, true);
  const takeoverAuthorization = sdk.compileLegacyRouteTakeoverAuthorization({
    contract: 'LegacyRouteTakeoverAuthorization', schemaVersion: 1,
    routeSpaceRevisionRef: { ...environmentRevisionRef, kind: 'route-space', id: 'studio.routes' },
    normalizedPath: '/gallery',
    legacyAdapterRevisionRef: { ...environmentRevisionRef, kind: 'legacy-route-adapter', id: 'studio.gallery' },
    sourceRevisionRef: { ...environmentRevisionRef, kind: 'application-menu-catalog', id: 'studio.release' },
    inspectedSourceContentHash: environmentRevisionRef.contentHash,
    targetResourceRef: { kind: 'page', id: 'page.gallery', ownerRepo: 'monkeys-server', visibility: 'tenant', tenantScope },
  });
  assert.equal(sdk.DeclarativeCommandIntentSchema.safeParse({ ...valid, target: { ...valid.target, legacyRouteTakeoverAuthorization: takeoverAuthorization } }).success, true);
  assert.equal(sdk.DeclarativeCommandIntentSchema.safeParse({
    ...valid,
    target: { ...valid.target, legacyRouteTakeoverAuthorization: { ...takeoverAuthorization, targetResourceRef: { ...takeoverAuthorization.targetResourceRef, kind: 'group' } } },
  }).success, false);
  const { releaseSlotId: _releaseSlotId, ...firstPublish } = valid;
  assert.equal(sdk.DeclarativeCommandIntentSchema.safeParse(firstPublish).success, true);
  assert.equal(sdk.DeclarativeCommandIntentSchema.safeParse({ ...valid, release: {} }).success, false);
  assert.equal(sdk.DeclarativeCommandIntentSchema.safeParse({ ...valid, target: { ...valid.target, url: 'https://example.com' } }).success, false);
  const groupRef = { kind: 'group', id: 'group-1', ownerRepo: 'monkeys-server', visibility: 'tenant', tenantScope };
  assert.equal(sdk.DeclarativeCommandIntentSchema.safeParse({ ...valid, audienceSimulation: { groupRefs: [groupRef], permissions: ['page.read'] } }).success, true);
  assert.equal(sdk.DeclarativeCommandIntentSchema.safeParse({ ...valid, audienceSimulation: { groupCodes: ['renamable-code'], permissions: [] } }).success, false);
  assert.equal(sdk.DeclarativeCommandIntentSchema.safeParse({ ...valid, audienceSimulation: { groupRefs: [{ ...groupRef, kind: 'permission' }], permissions: [] } }).success, false);
});

test('product declarative authoring catalog is a strict release-owned fragment', () => {
  const environmentDocument = {
    contract: 'DeclarativeEnvironment', schemaVersion: 1, environmentId: 'environment.production',
    label: fixture.text('Production'), active: true,
  };
  const environmentRevisionRef = fixture.revision('environment', environmentDocument.environmentId, { visibility: 'global', ownerRepo: 'monkeys' });
  const queryDefinition = {
    contract: 'DomainQueryDefinition', schemaVersion: 1, queryId: 'data.ontology.catalog', tenantScope: fixture.tenantScope,
    dataSource: { kind: 'tenant-catalog', resource: 'ontology' },
    handlerRef: { kind: 'domain-query-handler', id: 'data.ontology.catalog', version: '1', ownerRepo: 'monkeys-server' },
    inputSchemaRevisionRef: fixture.revision('schema', 'data.ontology.catalog.input', { visibility: 'global' }),
    resultSchemaRevisionRef: fixture.revision('schema', 'data.ontology.catalog.result', { visibility: 'global' }),
    accessPolicy: fixture.access({ permissionAllOf: ['data.read'] }), lineageRequired: true,
  };
  const queryDefinitionRevisionRef = fixture.revision('domain-query-definition', queryDefinition.queryId, {
    contentHash: sdk.canonicalContentHash(queryDefinition),
  });
  const commandDefinition = {
    contract: 'DomainCommandDefinition', commandName: 'data.record.create', ownerRepo: 'monkeys-server',
    displayName: 'Create data record', targetKinds: ['domain-record'], inputSchemaRef: 'data.record.create.input',
    requiredPermissionCodes: ['data.write'],
    handlerRef: { kind: 'domain-command-handler', id: 'data.record.create', version: '1', ownerRepo: 'monkeys-server' },
    sideEffects: ['data-write'],
  };
  const commandDefinitionRevisionRef = fixture.revision('domain-command', commandDefinition.commandName, {
    contentHash: sdk.canonicalContentHash(commandDefinition),
  });
  const schemaDefinition = {
    contract: 'Schema', schemaVersion: 1, schemaId: 'data.ontology.catalog.input', ownerRepo: 'monkeys-server',
    dialect: 'https://json-schema.org/draft/2020-12/schema',
    document: { type: 'object', additionalProperties: false, properties: {} },
  };
  const schemaDefinitionRevisionRef = fixture.revision('schema', schemaDefinition.schemaId, {
    visibility: 'global', ownerRepo: schemaDefinition.ownerRepo,
    contentHash: sdk.canonicalContentHash(schemaDefinition),
  });
  const fragment = {
    contract: 'ProductDeclarativeAuthoringCatalog',
    schemaVersion: 1,
    applicationId: 'studio',
    createTemplates: [],
    routeSpaces: [],
    resourceRegistrations: [{
      resourceRevisionRef: environmentRevisionRef, resourceKind: 'environment', supportedSurfaces: ['studio'],
      document: environmentDocument, sourceContentHash: 'a'.repeat(64),
    }],
    defaultPolicies: [{ role: 'environment', resourceRevisionRef: environmentRevisionRef, supportedSurfaces: ['studio'] }],
    domainQueryDefinitions: [{ definitionRevisionRef: queryDefinitionRevisionRef, definition: queryDefinition }],
    domainCommandDefinitions: [{ definitionRevisionRef: commandDefinitionRevisionRef, definition: commandDefinition }],
    schemaDefinitions: [{ definitionRevisionRef: schemaDefinitionRevisionRef, definition: schemaDefinition }],
  };
  const parsedFragment = sdk.ProductDeclarativeAuthoringCatalogSchema.parse(fragment);
  assert.deepEqual(parsedFragment.capabilityRegistrations, []);
  assert.equal(sdk.ProductDeclarativeAuthoringCatalogSchema.safeParse({ ...fragment, templates: [] }).success, false);
  assert.equal(sdk.ProductDeclarativeAuthoringCatalogSchema.safeParse({
    ...fragment,
    domainQueryDefinitions: [{ ...fragment.domainQueryDefinitions[0], definitionRevisionRef: { ...queryDefinitionRevisionRef, id: 'wrong.query' } }],
  }).success, false);
  assert.equal(sdk.ProductDeclarativeAuthoringCatalogSchema.safeParse({
    ...fragment,
    domainCommandDefinitions: [{ ...fragment.domainCommandDefinitions[0], definitionRevisionRef: { ...commandDefinitionRevisionRef, kind: 'schema' } }],
  }).success, false);
  assert.equal(sdk.ProductDeclarativeAuthoringCatalogSchema.safeParse({
    ...fragment,
    schemaDefinitions: [{ ...fragment.schemaDefinitions[0], definitionRevisionRef: { ...schemaDefinitionRevisionRef, ownerRepo: 'wrong-owner' } }],
  }).success, false);
  assert.equal(sdk.ProductDeclarativeAuthoringCatalogSchema.safeParse({
    ...fragment,
    capabilityRegistrations: [{ executableUrl: 'https://example.com/product-capability.js' }],
  }).success, false);

  const resourceRegistration = fragment.resourceRegistrations[0];
  assert.equal(sdk.declarativeProductResourceRevisionHash(resourceRegistration), sdk.canonicalContentHash(environmentDocument));
  assert.equal(sdk.declarativeProductResourceRevisionHash(resourceRegistration), sdk.declarativeProductResourceSourceHash(environmentDocument));

  const routeSpace = {
    contract: 'RouteSpace', schemaVersion: 1, routeSpaceId: 'studio.tenant', supportedSurface: 'studio',
    basePath: '/:teamId', caseSensitive: false, trailingSlash: 'remove', reservedPaths: ['/auth'],
    parameters: [{ name: 'teamId', type: 'identifier', required: true }],
  };
  const routeRegistration = {
    routeSpaceRevisionRef: fixture.revision('route-space', routeSpace.routeSpaceId, { visibility: 'global', ownerRepo: 'monkeys' }),
    routeSpace,
    sourceContentHash: sdk.declarativeRouteSpaceSourceHash(routeSpace),
  };
  assert.equal(sdk.declarativeRouteSpaceRevisionHash(routeRegistration), sdk.canonicalContentHash(routeSpace));
  assert.equal(sdk.declarativeRouteSpaceRevisionHash(routeRegistration), routeRegistration.sourceContentHash);

  const templateRegistration = {
    templateRevisionRef: fixture.revision('create-template', 'page.blank', { visibility: 'global', ownerRepo: 'monkeys' }),
    resourceKind: 'page', supportedSurfaces: ['studio'], document: { contract: 'Page', schemaVersion: 1, pageId: fixture.page.pageId, tenantScope: fixture.page.tenantScope, identity: fixture.page.identity, surface: 'studio', route: '/gallery', lifecycle: 'active', body: { id: 'gallery', component: fixture.page.capabilityInstances[0].capabilityRevisionRef.id }, access: fixture.page.pageAccessPolicy, managementAccess: fixture.page.managementAccess },
    sourceContentHash: sdk.declarativeCreateTemplateSourceHash({ contract: 'Page', schemaVersion: 1, pageId: fixture.page.pageId, tenantScope: fixture.page.tenantScope, identity: fixture.page.identity, surface: 'studio', route: '/gallery', lifecycle: 'active', body: { id: 'gallery', component: fixture.page.capabilityInstances[0].capabilityRevisionRef.id }, access: fixture.page.pageAccessPolicy, managementAccess: fixture.page.managementAccess }),
  };
  assert.equal(sdk.declarativeCreateTemplateRevisionHash(templateRegistration), sdk.canonicalContentHash(templateRegistration.document));
  assert.equal(sdk.declarativeCreateTemplateRevisionHash(templateRegistration), templateRegistration.sourceContentHash);

  const migrationTemplate = {
    ...templateRegistration,
    templateRevisionRef: fixture.revision('declarative-create-template', 'page.gallery-migration', { visibility: 'global', ownerRepo: 'monkeys' }),
    label: fixture.text('Gallery migration'),
    description: fixture.text('Migrate the existing Gallery Page without changing its route.'),
    legacyMigrationSourcePageIds: ['studio.page.gallery'],
  };
  assert.equal(sdk.DeclarativeCreateTemplateRegistrationSchema.safeParse(migrationTemplate).success, true);
  assert.equal(sdk.DeclarativeCreateTemplateRegistrationSchema.safeParse({
    ...migrationTemplate,
    resourceKind: 'workbench',
    document: fixture.workbench,
  }).success, false);
  assert.equal(sdk.DeclarativeCreateTemplateRegistrationSchema.safeParse({
    ...migrationTemplate,
    legacyMigrationSourcePageIds: ['studio.page.gallery', 'studio.page.gallery'],
  }).success, false);
  assert.equal(sdk.ProductDeclarativeAuthoringCatalogSchema.safeParse({
    ...fragment,
    createTemplates: [
      migrationTemplate,
      {
        ...migrationTemplate,
        templateRevisionRef: fixture.revision('declarative-create-template', 'page.gallery-migration-alternate', { visibility: 'global', ownerRepo: 'monkeys' }),
        supportedSurfaces: ['studio', 'kernel'],
      },
    ],
  }).success, false);
});

test('Shell resources declare exact per-surface chrome without implicit placement inference', () => {
  assert.equal(sdk.DeclarativeProductResourceRegistrationSchema.safeParse(fixture.shellRegistration).success, true);
  assert.equal(sdk.DeclarativeProductResourceRegistrationSchema.safeParse({
    ...fixture.shellRegistration,
    document: { ...fixture.shellRegistration.document, surfaceChrome: [] },
  }).success, false);
  assert.equal(sdk.DeclarativeProductResourceRegistrationSchema.safeParse({
    ...fixture.shellRegistration,
    document: {
      ...fixture.shellRegistration.document,
      surfaceChrome: [{ surface: 'studio', header: { enabled: true, navigationPlacement: 'kernel.primary' } }],
    },
  }).success, false);
  assert.equal(sdk.DeclarativeProductResourceRegistrationSchema.safeParse({
    ...fixture.shellRegistration,
    supportedSurfaces: ['studio', 'kernel'],
  }).success, false);
});

test('authoring summaries, Workbench targets and command results remain strict and typed', () => {
  const actorRef = fixture.stable('actor', 'user-1');
  const simplePage = { contract: 'Page', schemaVersion: 1, pageId: fixture.page.pageId, tenantScope: fixture.page.tenantScope, identity: fixture.page.identity, surface: 'studio', route: '/gallery', lifecycle: 'active', body: { id: 'gallery', component: fixture.page.capabilityInstances[0].capabilityRevisionRef.id }, access: fixture.page.pageAccessPolicy, managementAccess: fixture.page.managementAccess };
  const draft = {
    action: 'create', resourceKind: 'page', resourceId: fixture.page.pageId, document: simplePage,
    revisionRef: fixture.pageRevisionRef, actorRef, occurredAt: '2026-08-28T12:00:00.000Z',
  };
  assert.equal(sdk.DeclarativeDraftResultSchema.safeParse(draft).success, true);
  assert.equal(sdk.DeclarativeDraftResultSchema.safeParse({ ...draft, record: {} }).success, false);
  const summary = {
    resourceKind: 'page',
    resourceId: fixture.page.pageId,
    tenantScope: fixture.tenantScope,
    documentSummary: {
      resourceKind: 'page',
      title: fixture.page.identity.name,
      supportedSurfaces: fixture.page.supportedSurfaces,
      routeClaims: fixture.page.routeClaims.map((claim) => ({ ...claim, surface: 'studio' })),
      lifecycle: fixture.page.lifecycle,
      accessPolicy: fixture.page.pageAccessPolicy,
      managementAccess: fixture.page.managementAccess,
    },
    lifecycle: 'active',
    draftRevisionRef: fixture.pageRevisionRef,
    activeReleaseRevisionRefs: [fixture.pageReleaseRevisionRef],
    placements: [],
    updatedAt: '2026-08-28T12:00:00.000Z',
    actorRef,
    preparedTargets: [],
    releasePlacements: [{
      releaseRevisionRef: fixture.pageReleaseRevisionRef,
      definitionRevisionRef: fixture.pageRevisionRef,
      environmentRef: fixture.environmentRef,
      surface: 'studio',
      routePath: '/gallery',
    }],
  };
  assert.equal(sdk.DeclarativeAuthoringResourceSummarySchema.safeParse(summary).success, true);
  assert.equal(sdk.DeclarativeAuthoringResourceSummarySchema.safeParse({
    ...summary,
    releasePlacements: [{ ...summary.releasePlacements[0], definitionRevisionRef: fixture.revision('navigation', fixture.page.pageId) }],
  }).success, false);
  assert.equal(sdk.DeclarativeAuthoringResourceSummarySchema.safeParse({
    ...summary,
    releasePlacements: [{ ...summary.releasePlacements[0], definitionRevisionRef: fixture.revision('page', 'page.other') }],
  }).success, false);
  assert.equal(sdk.DeclarativeAuthoringResourceSummarySchema.safeParse({
    ...summary,
    releasePlacements: [{ ...summary.releasePlacements[0], releaseRevisionRef: fixture.revision('workbench-release', fixture.pageReleaseRevisionRef.id) }],
  }).success, false);
  assert.equal(sdk.DeclarativeAuthoringResourceSummarySchema.safeParse({
    ...summary,
    releasePlacements: [{ ...summary.releasePlacements[0], definitionRevisionRef: fixture.revision('page', fixture.page.pageId, { tenantScope: {
      ...fixture.tenantScope,
      teamRef: fixture.identity('team', 'team.other'),
    } }) }],
  }).success, false);
  assert.equal(sdk.DeclarativeAuthoringResourceSummarySchema.safeParse({
    ...summary,
    releasePlacements: [summary.releasePlacements[0], summary.releasePlacements[0]],
  }).success, false);
  assert.equal(sdk.DeclarativeAuthoringResourceSummarySchema.safeParse({
    ...summary,
    releasePlacements: [{
      releaseRevisionRef: fixture.pageReleaseRevisionRef,
      environmentRef: fixture.environmentRef,
      surface: 'studio',
      routePath: '/gallery',
    }],
  }).success, false);
  const target = fixture.workbench.appInstances[0];
  assert.equal(sdk.DeclarativeWorkbenchTargetChoiceSchema.safeParse({
    stableTargetRef: fixture.stable(target.targetRevisionRef.kind, target.targetRevisionRef.id),
    targetRevisionRef: target.targetRevisionRef,
    providerRevisionRef: target.providerRevisionRef,
    inputSchemaRevisionRef: target.inputSchemaRevisionRef,
    kind: target.kind,
    name: fixture.text('Workflow form'),
    targetAccessPolicy: target.accessPolicy,
    supportedSurfaces: ['studio'], status: 'active', provenanceContentHash: 'a'.repeat(64),
  }).success, true);
});

test('publication plan intent supports multiple resource kinds without release bodies', () => {
  const tenantScope = {
    tenantRef: { kind: 'tenant', id: 'tenant', ownerRepo: 'monkeys-server' },
    dataSpaceRef: { kind: 'data-space', id: 'monkeys-control', ownerRepo: 'monkeys-data-server' },
    teamRef: { kind: 'team', id: 'team', ownerRepo: 'monkeys-server' },
  };
  const environmentRef = { kind: 'environment', id: 'prod', ownerRepo: 'monkeys-server', visibility: 'tenant', tenantScope };
  const environmentRevisionRef = { ...environmentRef, revision: 2, schemaVersion: 1, contentHash: 'e'.repeat(64) };
  const intent = {
    idempotencyKey: 'batch-1',
    expectedGeneration: 0,
    operations: ['page', 'navigation', 'workbench'].map((resourceKind, index) => ({
      resourceKind,
      resourceId: `${resourceKind}-${index}`,
      intent: {
        idempotencyKey: `operation-${index}`,
        definitionVersion: 1,
        releaseSlotId: `${resourceKind}-slot`,
        releaseExpectedVersion: 0,
        publicationExpectedGeneration: 0,
        target: { environmentRef, environmentRevisionRef, surface: 'studio', ...(resourceKind === 'navigation' ? { placement: 'studio.headbar.primary' } : { routeClaimIndex: 0 }) },
      },
    })),
  };
  assert.equal(sdk.DeclarativePublicationPlanIntentSchema.safeParse(intent).success, true);
  const pageOperation = intent.operations[0];
  assert.equal(sdk.DeclarativePublicationPlanIntentSchema.parse(intent).operations[0].action, 'publish');
  assert.equal(sdk.DeclarativePublicationPlanIntentSchema.safeParse({
    ...intent,
    operations: [{ ...pageOperation, action: 'rollback', intent: { ...pageOperation.intent, targetReleaseVersion: 1 } }],
  }).success, true);
  assert.equal(sdk.DeclarativePublicationPlanIntentSchema.safeParse({
    ...intent,
    operations: [{ ...pageOperation, action: 'deactivate' }],
  }).success, true);
  assert.equal(sdk.DeclarativePublicationPlanIntentSchema.safeParse({
    ...intent,
    operations: [{ ...pageOperation, action: 'rollback' }],
  }).success, false);
  assert.equal(sdk.DeclarativePublicationPlanIntentSchema.safeParse({
    ...intent,
    operations: [{ ...pageOperation, action: 'deactivate', intent: { ...pageOperation.intent, targetReleaseVersion: 1 } }],
  }).success, false);
});

test('navigation placement exposes independent legacy and declarative editor read-only semantics', () => {
  const placement = {
    placement: 'studio.headbar.primary',
    surface: 'studio',
    authority: 'legacy',
    legacyReadOnly: false,
    declarativeEditorReadOnly: false,
  };
  assert.equal(sdk.DeclarativeNavigationPlacementSchema.safeParse(placement).success, true);
  assert.equal(sdk.DeclarativeNavigationPlacementSchema.safeParse({ ...placement, readOnly: false }).success, false);
});

test('runtime startup contracts make legacy authority explicit and reject ambiguous fallback state', () => {
  const hash = 'a'.repeat(64);
  const navigation = {
    placements: [{ placement: 'studio.headbar.primary', surface: 'studio', authority: 'legacy', state: 'active' }],
    bundles: [], releaseSlotIds: [], generation: 0, contentHash: hash, authDigest: hash, etag: `"${hash}.${hash}"`,
  };
  assert.equal(sdk.DeclarativeNavigationRuntimeBootstrapSchema.safeParse(navigation).success, true);
  assert.equal(sdk.DeclarativeNavigationRuntimeBootstrapSchema.safeParse({
    ...navigation,
    placements: [{ ...navigation.placements[0], authority: 'declarative' }],
  }).success, false);

  const workbenches = {
    defaultAuthority: 'legacy', authorities: [],
    legacySummaries: [{
      workbenchId: 'studio-legacy', authority: 'legacy',
      identity: { name: { defaultLocale: 'en-US', values: { 'en-US': 'Legacy Studio' } }, tags: ['legacy'] },
      order: 0, isDefaultCandidate: true,
    }],
    summaries: [], selected: { workbenchId: 'studio-legacy', authority: 'legacy', source: 'default' },
    authDigest: hash, etag: `"${hash}.${hash}"`,
  };
  assert.equal(sdk.DeclarativeWorkbenchRuntimeBootstrapSchema.safeParse(workbenches).success, true);
  assert.equal(sdk.DeclarativeWorkbenchRuntimeBootstrapSchema.safeParse({
    ...workbenches,
    selected: { ...workbenches.selected, releaseSlotId: 'invented-slot' },
  }).success, false);
});
