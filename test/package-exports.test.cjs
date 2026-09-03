'use strict';

const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const test = require('node:test');
const Ajv2020 = require('ajv/dist/2020');

const PACKAGE_NAME = '@inf-monkeys-tech/monkeys';

test('generated tenant JSON Schemas expose optional Home entry availability on strict pages', () => {
  for (const schemaName of ['tenant-product-config', 'tenant-runtime-config']) {
    const schema = require(`${PACKAGE_NAME}/json-schema/${schemaName}.schema.json`);
    const pages = schema.properties.applicationConfig.properties.theme.properties.pages;

    assert.deepEqual(pages.properties.homeEntryEnabled, { type: 'boolean' });
    assert.equal(pages.required.includes('homeEntryEnabled'), false);
    assert.equal(pages.additionalProperties, false);
  }
});

test('generated tenant JSON Schemas expose the optional email registration switch', () => {
  for (const schemaName of ['tenant-product-config', 'tenant-runtime-config']) {
    const schema = require(`${PACKAGE_NAME}/json-schema/${schemaName}.schema.json`);
    const password = schema.properties.applicationConfig.properties.auth.properties.password;

    assert.deepEqual(password.properties.registrationEnabled, { type: 'boolean' });
    assert.equal(password.required?.includes('registrationEnabled') ?? false, false);
    assert.equal(password.additionalProperties, false);
  }
});

test('generated tenant JSON Schemas expose the strict optional registration approval policy', () => {
  for (const schemaName of ['tenant-product-config', 'tenant-runtime-config']) {
    const schema = require(`${PACKAGE_NAME}/json-schema/${schemaName}.schema.json`);
    const auth = schema.properties.applicationConfig.properties.auth;
    const registrationApproval = auth.properties.registrationApproval;

    assert.deepEqual(registrationApproval.properties.enabled, { type: 'boolean' });
    assert.equal(auth.required?.includes('registrationApproval') ?? false, false);
    assert.equal(registrationApproval.required?.includes('enabled') ?? false, false);
    assert.equal(registrationApproval.additionalProperties, false);
  }
});

test('generated menu JSON Schemas expose optional disabled state only on groups and items', () => {
  const ajv = new Ajv2020({ strict: false });
  const definitionSchema = require(`${PACKAGE_NAME}/json-schema/menu-definition.schema.json`);
  const runtimeSchema = require(`${PACKAGE_NAME}/json-schema/menu-runtime-bundle.schema.json`);
  const fixture = JSON.parse(
    readFileSync(resolve(__dirname, './fixtures/menu-definition.v1.json'), 'utf8'),
  );
  const validateDefinition = ajv.compile(definitionSchema);
  const validateRuntime = ajv.compile(runtimeSchema);

  assert.equal(validateDefinition(fixture), true);
  assert.equal(validateDefinition({
    ...fixture,
    nodes: fixture.nodes.map((node, index) => ({ ...node, disabled: index === 0 })),
  }), true);
  assert.equal(validateDefinition({
    ...fixture,
    nodes: [...fixture.nodes, {
      nodeId: 'divider',
      kind: 'divider',
      order: 20,
      disabled: true,
    }],
  }), false);

  assert.equal(validateRuntime({
    contract: 'MenuRuntimeBundle',
    version: 1,
    applicationId: 'studio',
    sourceVersion: 'config-42',
    contentHash: 'a'.repeat(64),
    menus: [{
      applicationId: 'studio',
      surface: 'headerbar',
      menuId: 'default',
      nodes: [{
        nodeId: 'account',
        kind: 'group',
        order: 10,
      }, {
        nodeId: 'logout',
        parentNodeId: 'account',
        kind: 'item',
        order: 10,
        label: 'Logout',
        disabled: true,
        behavior: { kind: 'action', actionRef: 'logout' },
        access: {
          authenticated: true,
          permissionAllOf: [],
          permissionAnyOf: [],
          featureFlags: [],
        },
      }],
      contributions: [],
    }],
    navigationTargets: [],
    sourceMap: {},
  }), true);
});

test('generated declarative control JSON Schemas preserve strict public record boundaries', () => {
  const ajv = new Ajv2020({ strict: false });
  const pageSchema = require(`${PACKAGE_NAME}/json-schema/page.schema.json`);
  const publicationPlanSchema = require(`${PACKAGE_NAME}/json-schema/publication-plan.schema.json`);
  const { page } = require('./declarative-control-fixtures.cjs');
  const validatePage = ajv.compile(pageSchema);

  assert.equal(validatePage(page), true, JSON.stringify(validatePage.errors));
  assert.equal(validatePage({ ...page, businessRecords: [] }), false);
  assert.equal(publicationPlanSchema.additionalProperties, false);
});

test('runtime subpath preserves CommonJS resolution', () => {
  const runtime = require(`${PACKAGE_NAME}/runtime`);

  assert.equal(typeof runtime.resolveThemeTokens, 'function');
  assert.equal(typeof runtime.compileMenuRuntimeBundle, 'function');
  assert.equal(typeof runtime.compilePageRuntimeBundle, 'function');
  assert.equal(typeof runtime.compileWorkbenchRuntimeBundle, 'function');
  assert.equal(typeof runtime.compileNavigationRuntimeBundle, 'function');
});

test('runtime subpath exposes native ESM named exports', async () => {
  const runtime = await import(`${PACKAGE_NAME}/runtime`);

  assert.equal(typeof runtime.resolveThemeTokens, 'function');
  assert.equal(typeof runtime.mergeThemeTokenDocuments, 'function');
  assert.equal(typeof runtime.compileMenuRuntimeBundle, 'function');
  assert.equal(typeof runtime.compilePageRuntimeBundle, 'function');
  assert.equal(typeof runtime.compileWorkbenchRuntimeBundle, 'function');
  assert.equal(typeof runtime.compileNavigationRuntimeBundle, 'function');
});

test('all public module subpaths resolve through ESM import conditions', async () => {
  const [root, contracts, schemas] = await Promise.all([
    import(PACKAGE_NAME),
    import(`${PACKAGE_NAME}/contracts`),
    import(`${PACKAGE_NAME}/schemas`),
  ]);

  assert.equal(typeof root.resolveThemeTokens, 'function');
  assert.equal(typeof contracts.ThemeTokensSchema?.parse, 'function');
  assert.equal(typeof schemas.ThemeTokensSchema?.parse, 'function');
  assert.equal(typeof contracts.MenuDefinitionSchema?.parse, 'function');
  assert.equal(typeof schemas.MenuRuntimeBundleSchema?.parse, 'function');
  assert.equal(typeof contracts.PageSchema?.parse, 'function');
  assert.equal(typeof contracts.DeclarativeRouteClaimSchema?.parse, 'function');
  assert.equal(typeof schemas.LegacyRouteClaimSchema?.parse, 'function');
  assert.equal(typeof schemas.CompiledRouteMatcherSchema?.parse, 'function');
  assert.equal(typeof schemas.NavigationReleaseSchema?.parse, 'function');
});

test('browser ESM runtime does not expose the CommonJS Ajv boundary', () => {
  const runtimeBundle = readFileSync('lib/esm/runtime/index.mjs', 'utf8');

  assert.match(runtimeBundle, /node_modules\/ajv\//);
  assert.doesNotMatch(runtimeBundle, /^import\s+.*?(['"])ajv(?:\/[^'"]*)?\1;?$/m);
});
