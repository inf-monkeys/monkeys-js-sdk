'use strict';

const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const test = require('node:test');

const contracts = require('@inf-monkeys-tech/monkeys/contracts');
const schemas = require('@inf-monkeys-tech/monkeys/schemas');

const fixture = JSON.parse(
  readFileSync(resolve(__dirname, './fixtures/menu-definition.v1.json'), 'utf8'),
);

test('accepts one application-scoped source menu and inheritance sentinel', () => {
  const parsed = schemas.MenuDefinitionSchema.parse(fixture);
  assert.equal(parsed.applicationId, 'studio');
  assert.equal(parsed.nodes[1].behavior.activationId, 'mine');
  assert.equal(schemas.MenuDefinitionSetSchema.parse('*'), '*');
  assert.deepEqual(
    schemas.MenuDefinitionSetSchema.parse({ version: 1, definitions: [fixture] }).definitions,
    [parsed],
  );
  assert.equal(typeof contracts.MenuDefinitionSchema.parse, 'function');
});

test('rejects duplicate nodes, non-group parents, cycles, and duplicate providers', () => {
  const invalidMenus = [
    {
      ...fixture,
      nodes: [fixture.nodes[0], { ...fixture.nodes[1], nodeId: fixture.nodes[0].nodeId }],
    },
    {
      ...fixture,
      nodes: [
        { ...fixture.nodes[1], parentNodeId: undefined },
        { ...fixture.nodes[1], nodeId: 'nested', parentNodeId: 'my-assets' },
      ],
    },
    {
      ...fixture,
      nodes: [
        { nodeId: 'one', kind: 'group', parentNodeId: 'two', order: 1 },
        { nodeId: 'two', kind: 'group', parentNodeId: 'one', order: 2 },
      ],
    },
    {
      ...fixture,
      contributions: [
        { providerId: 'accounts', parentNodeId: 'assets', order: 1 },
        { providerId: 'accounts', parentNodeId: 'assets', order: 2 },
      ],
    },
  ];

  for (const menu of invalidMenus) {
    assert.equal(schemas.MenuDefinitionSchema.safeParse(menu).success, false);
  }
});

test('bounds configured input and keeps server values impossible in runtime bindings', () => {
  assert.equal(
    schemas.MenuBoundedInputSchema.safeParse({ nested: { value: 'ok' } }).success,
    true,
  );
  assert.equal(
    schemas.MenuBoundedInputSchema.safeParse({ value: 'x'.repeat(70_000) }).success,
    false,
  );
  assert.equal(
    schemas.MenuRuntimeInputBindingSchema.safeParse({
      exposure: 'server',
      value: { secret: true },
    }).success,
    false,
  );
  assert.equal(
    schemas.MenuContributionResultSchema.safeParse({
      contract: 'MenuContributionResult',
      applicationId: 'studio',
      surface: 'headerbar',
      menuId: 'default',
      providerId: 'accounts',
      nodes: [{
        nodeId: 'dynamic',
        kind: 'item',
        order: 1,
        label: 'Dynamic',
        behavior: {
          kind: 'navigate',
          page: { applicationId: 'studio', pageId: 'data-browser' },
          activationId: 'mine',
          input: { exposure: 'server', value: { secret: true } },
        },
        access: {
          authenticated: true,
          permissionAllOf: [],
          permissionAnyOf: [],
          featureFlags: [],
        },
      }],
    }).success,
    false,
  );
});

test('requires exactly one typed behavior on every interactive item', () => {
  const item = fixture.nodes[1];
  assert.equal(schemas.MenuItemNodeSchema.safeParse({ ...item, behavior: undefined }).success, false);
  assert.equal(schemas.MenuItemNodeSchema.safeParse({
    ...item,
    behavior: {
      kind: 'navigate',
      page: { applicationId: 'studio', pageId: 'data-browser' },
      actionRef: 'logout',
    },
  }).success, false);
  assert.equal(schemas.MenuItemNodeSchema.safeParse({
    ...item,
    behavior: { kind: 'action', actionRef: 'logout' },
  }).success, true);
});
