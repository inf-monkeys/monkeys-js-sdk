'use strict';

const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const test = require('node:test');

const runtime = require('@inf-monkeys-tech/monkeys/runtime');
const schemas = require('@inf-monkeys-tech/monkeys/schemas');

const stableSerialize = (value) => {
  if (value === undefined) return 'null';
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return `[${value.map(stableSerialize).join(',')}]`;
  return `{${Object.keys(value)
    .filter((key) => value[key] !== undefined)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableSerialize(value[key])}`)
    .join(',')}}`;
};

const capabilityRef = {
  kind: 'capability',
  id: 'asset-browser',
  version: '1.0.0',
  ownerRepo: 'monkeys-studio',
};

const page = ({
  applicationId = 'studio',
  pageId = 'data-browser',
  input = { schemaRef: 'schema://page/data-browser-input' },
  permissionAllOf = ['studio:access'],
  permissionAnyOf = ['data_asset:read', 'data_asset:manage'],
} = {}) => ({
  applicationId,
  page: {
    contract: 'PageDefinition',
    pageId,
    ownerRepo: applicationId === 'kernel' ? 'monkeys-ui-admin' : 'monkeys-studio',
    title: pageId,
    pageType: 'page',
    ownership: { builtIn: true },
    record: { deleted: false },
    surface: 'page',
    routeId: `${pageId}-route`,
    routePath: `/${pageId}`,
    rendererKey: 'asset-browser',
    capabilityRef: {
      ...capabilityRef,
      ownerRepo: applicationId === 'kernel' ? 'monkeys-ui-admin' : 'monkeys-studio',
    },
    capabilityRefs: [],
    binding: {},
    access: { actions: ['read'] },
    input,
    rendererConfig: { schemaRef: 'schema://renderer/asset-browser', value: {} },
    navigation: { label: pageId, hidden: false, pinned: false },
    visibility: {
      authenticated: true,
      permissionAllOf,
      permissionAnyOf,
      featureFlags: [],
      productContexts: [applicationId],
    },
  },
});

const navigateItem = ({ nodeId, activationId, scope, exposure = 'client', parentNodeId = 'assets' }) => ({
  nodeId,
  kind: 'item',
  ...(parentNodeId === null ? {} : { parentNodeId }),
  order: nodeId === 'my-assets' ? 10 : 20,
  label: nodeId,
  requiredPermission: 'menu:assets',
  behavior: {
    kind: 'navigate',
    page: { applicationId: 'studio', pageId: 'data-browser' },
    activationId,
    input: { exposure, value: { scope } },
  },
});

const studioHeaderbar = {
  contract: 'MenuDefinition',
  version: 1,
  applicationId: 'studio',
  surface: 'headerbar',
  menuId: 'default',
  nodes: [
    { nodeId: 'assets', kind: 'group', order: 10, label: 'Assets' },
    navigateItem({ nodeId: 'my-assets', activationId: 'mine', scope: 'mine' }),
    navigateItem({ nodeId: 'all-assets', activationId: 'all', scope: 'all', exposure: 'server' }),
    {
      nodeId: 'logout',
      kind: 'item',
      order: 100,
      label: 'Logout',
      behavior: { kind: 'action', actionRef: 'logout' },
    },
  ],
  contributions: [{ providerId: 'studio-account-controls', order: 90 }],
};

const studioCurrentUser = {
  ...studioHeaderbar,
  surface: 'current-user',
  nodes: [navigateItem({
    nodeId: 'profile-my-assets',
    activationId: 'mine',
    scope: 'mine',
    parentNodeId: null,
  })],
  contributions: [],
};

const kernelMenu = {
  contract: 'MenuDefinition',
  version: 1,
  applicationId: 'kernel',
  surface: 'primary-navigation',
  menuId: 'default',
  nodes: [{
    nodeId: 'kernel-home',
    kind: 'item',
    order: 1,
    label: 'Kernel',
    behavior: {
      kind: 'navigate',
      page: { applicationId: 'kernel', pageId: 'kernel-home' },
      input: { exposure: 'server', value: { hiddenForStudio: true } },
    },
  }],
  contributions: [],
};

const permissions = [
  'studio:access',
  'kernel:access',
  'data_asset:read',
  'data_asset:manage',
  'menu:assets',
];

const inputValidators = new Map([
  ['schema://page/data-browser-input', (value) => {
    if (value.scope !== 'mine' && value.scope !== 'all') throw new Error('scope must be mine or all');
    return { scope: value.scope };
  }],
  ['schema://page/kernel-home-input', (value) => value],
]);

const compile = (overrides = {}) => runtime.compileMenuRuntimeBundle({
  applicationId: 'studio',
  supportedSurfaces: ['headerbar', 'current-user'],
  sourceVersion: 'config-42',
  definitions: [kernelMenu, studioCurrentUser, studioHeaderbar],
  pages: [
    page(),
    page({
      applicationId: 'kernel',
      pageId: 'kernel-home',
      input: { schemaRef: 'schema://page/kernel-home-input' },
      permissionAllOf: ['kernel:access'],
      permissionAnyOf: [],
    }),
  ],
  actions: [{
    applicationId: 'studio',
    actionRef: 'logout',
    access: { authenticated: true, permissionAllOf: [], permissionAnyOf: [], featureFlags: [] },
  }],
  contributionProviders: [{
    applicationId: 'studio',
    providerId: 'studio-account-controls',
    surfaces: ['headerbar'],
  }],
  permissionCodes: permissions,
  inputValidators,
  sourceMap: {
    'z.other': 'other-version-1',
    'server.ui.menus': 'tenant-version-42',
  },
  ...overrides,
});

test('compiles only the requested application and strips server-bound values', () => {
  const compiled = compile();
  assert.deepEqual(compiled.document.menus.map((menu) => menu.surface), ['current-user', 'headerbar']);
  assert.equal(compiled.document.menus.some((menu) => menu.applicationId === 'kernel'), false);
  assert.deepEqual(
    compiled.document.menus.find((menu) => menu.surface === 'headerbar').nodes.map((node) => node.nodeId),
    ['assets', 'my-assets', 'all-assets', 'logout'],
  );
  assert.deepEqual(
    compiled.document.navigationTargets.map((target) => [target.activationId, target.input]),
    [
      ['all', { exposure: 'server' }],
      ['mine', { exposure: 'client', value: { scope: 'mine' } }],
    ],
  );
  assert.deepEqual([...compiled.serverInputByTargetKey.values()], [{ scope: 'all' }]);
  assert.equal(JSON.stringify(compiled.document).includes('hiddenForStudio'), false);
  assert.equal(schemas.MenuRuntimeBundleSchema.safeParse(compiled.document).success, true);
  assert.equal(compiled.document.contentHash.length, 64);
  assert.equal(Object.isFrozen(compiled.document.menus[0].nodes[0]), true);
  assert.deepEqual(Object.keys(compiled.document.sourceMap), ['server.ui.menus', 'z.other']);

  const { contentHash, ...unsigned } = compiled.document;
  assert.equal(
    contentHash,
    createHash('sha256').update(stableSerialize(unsigned)).digest('hex'),
  );
});

test('produces a deterministic document independent of source definition and node order', () => {
  const first = compile().document;
  const reordered = compile({
    definitions: [
      { ...studioHeaderbar, nodes: [...studioHeaderbar.nodes].reverse() },
      kernelMenu,
      studioCurrentUser,
    ],
  }).document;
  assert.deepEqual(reordered, first);
});

test('restores selected state from page and activation while ignoring business input', () => {
  const compiled = compile();
  const headerbar = compiled.document.menus.find((menu) => menu.surface === 'headerbar');
  assert.deepEqual(
    [...compiled.selectedNodeIds(
      headerbar,
      { applicationId: 'studio', pageId: 'data-browser' },
      'mine',
    )].sort(),
    ['assets', 'my-assets'],
  );
  assert.deepEqual(
    [...compiled.selectedNodeIds(
      headerbar,
      { applicationId: 'studio', pageId: 'data-browser' },
      'all',
    )].sort(),
    ['all-assets', 'assets'],
  );
});

test('serializes only non-default activation and resolves explicit stale states', () => {
  const pageRef = { applicationId: 'studio', pageId: 'data-browser' };
  assert.equal(runtime.serializeMenuActivationSearch('scope=private', pageRef), 'scope=private');
  assert.equal(
    runtime.serializeMenuActivationSearch('scope=private', pageRef, 'mine'),
    'scope=private&__menuActivation=mine',
  );
  assert.equal(
    runtime.readMenuActivationFromSearch('scope=private&__menuActivation=mine'),
    'mine',
  );

  const compiled = compile();
  assert.equal(compiled.resolveNavigationTarget(pageRef).status, 'unmatched');
  assert.deepEqual(compiled.resolveNavigationTarget(pageRef, 'mine'), {
    status: 'resolved',
    target: {
      page: pageRef,
      activationId: 'mine',
      input: { exposure: 'client', value: { scope: 'mine' } },
    },
  });
  assert.deepEqual(compiled.resolveNavigationTarget(pageRef, 'removed'), {
    status: 'invalid',
    reason: 'unknown-activation',
  });
  assert.deepEqual(
    compiled.resolveNavigationTarget({ applicationId: 'studio', pageId: 'other-page' }, 'mine'),
    { status: 'invalid', reason: 'page-mismatch' },
  );
});

test('applies target access and the simple menu permission as additive gates', () => {
  const compiled = compile();
  const item = compiled.document.menus
    .find((menu) => menu.surface === 'headerbar')
    .nodes.find((node) => node.nodeId === 'my-assets');

  assert.deepEqual(compiled.evaluateItemAccess(item, {
    sessionResolved: false,
    authenticated: false,
    permissionCodes: [],
    featureFlags: {},
  }).reasons, [
    'session-unresolved',
    'authentication',
    'permission-all',
    'permission-any',
    'required-permission',
  ]);
  assert.deepEqual(compiled.evaluateItemAccess(item, {
    sessionResolved: true,
    authenticated: true,
    permissionCodes: ['studio:access', 'data_asset:read'],
    featureFlags: {},
  }), {
    allowed: false,
    reasons: ['required-permission'],
  });
  assert.equal(compiled.evaluateItemAccess(item, {
    sessionResolved: true,
    authenticated: true,
    permissionCodes: ['studio:access', 'data_asset:read', '*'],
    featureFlags: {},
  }).allowed, true);
  assert.equal(compiled.evaluateItemAccess(item, {
    sessionResolved: true,
    authenticated: true,
    permissionCodes: ['studio:access', 'data_asset:read'],
    featureFlags: {},
    isKernelSuperAdmin: true,
  }).allowed, true);
  assert.deepEqual(compiled.evaluateItemAccess(item, {
    sessionResolved: true,
    authenticated: true,
    permissionCodes: ['*'],
    featureFlags: {},
  }).reasons, ['permission-all', 'permission-any']);
});

test('rejects unknown registries, permissions, invalid input, and conflicting target input with paths', () => {
  assert.throws(
    () => compile({ supportedSurfaces: ['headerbar'] }),
    (error) => error.code === 'unsupported-surface' && /surface/.test(error.path),
  );
  assert.throws(
    () => compile({
      pages: [{
        ...page(),
        applicationId: 'kernel',
      }],
    }),
    (error) => error.code === 'invalid-page-application' && /applicationId/.test(error.path),
  );
  assert.throws(
    () => compile({ permissionCodes: permissions.filter((permission) => permission !== 'menu:assets') }),
    (error) => error.code === 'unknown-permission' && /requiredPermission/.test(error.path),
  );
  assert.throws(
    () => compile({ contributionProviders: [] }),
    (error) => error.code === 'unknown-contribution-provider' && /contributions/.test(error.path),
  );
  assert.throws(
    () => compile({ actions: [] }),
    (error) => error.code === 'unknown-action' && /actionRef/.test(error.path),
  );
  assert.throws(
    () => compile({
      definitions: [{
        ...studioHeaderbar,
        nodes: [navigateItem({
          nodeId: 'bad',
          activationId: 'bad',
          scope: 'private',
          parentNodeId: null,
        })],
        contributions: [],
      }],
    }),
    (error) => error.code === 'invalid-input' && /input\.value/.test(error.path),
  );
  assert.throws(
    () => compile({
      definitions: [
        studioHeaderbar,
        {
          ...studioCurrentUser,
          nodes: [navigateItem({
            nodeId: 'conflict',
            activationId: 'mine',
            scope: 'all',
            parentNodeId: null,
          })],
        },
      ],
    }),
    (error) => error.code === 'conflicting-navigation-target' && /behavior/.test(error.path),
  );
});
