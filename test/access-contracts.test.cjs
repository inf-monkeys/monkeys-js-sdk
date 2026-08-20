'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { compileProductAccessDeclaration } = require('../lib/runtime');

const declaration = {
  contract: 'ProductAccessDeclaration',
  declarationId: 'monkeys.access',
  version: 1,
  ownerRepo: 'monkeys-server',
  permissions: [
    { code: 'studio:access', name: 'Access Studio', resource: 'studio', action: 'access', domain: 'studio' },
    { code: 'kernel_base:access', name: 'Access Kernel', resource: 'kernel_base', action: 'access', domain: 'kernel' },
  ],
  permissionBundles: [
    { bundleId: 'member', name: 'Member', permissionCodes: ['studio:access'] },
    { bundleId: 'platform-admin', name: 'Platform administrator', permissionCodes: ['studio:access', 'kernel_base:access'] },
  ],
  systemGroups: [
    { groupCode: 'member', name: 'Member', permissionPolicy: 'studio_current' },
    { groupCode: 'platform_admin', name: 'Platform administrator', permissionPolicy: 'all_current' },
    { groupCode: 'super_admin', name: 'Super administrator', permissionPolicy: 'all_current' },
  ],
};

test('compiles additive system groups from canonical permission bundles', () => {
  const compiled = compileProductAccessDeclaration(declaration);
  assert.deepEqual(compiled.permissionCodesBySystemGroup.get('member'), ['studio:access']);
  assert.deepEqual(compiled.permissionCodesBySystemGroup.get('platform_admin'), ['studio:access', 'kernel_base:access']);
  assert.deepEqual(compiled.permissionCodesBySystemGroup.get('super_admin'), ['studio:access', 'kernel_base:access']);
  assert.equal(compiled.permissionPolicyBySystemGroup.get('member'), 'studio_current');
  assert.equal(compiled.permissionPolicyBySystemGroup.get('platform_admin'), 'all_current');
});

test('rejects a permission bundle with an unknown permission', () => {
  const invalid = structuredClone(declaration);
  invalid.permissionBundles[0].permissionCodes.push('missing:permission');
  assert.throws(() => compileProductAccessDeclaration(invalid), /unknown permission/);
});
