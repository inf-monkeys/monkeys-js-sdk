'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const sdk = require('../lib');
const f = require('./declarative-control-fixtures.cjs');

const input = () => ({
  navigation: structuredClone(f.navigation),
  navigationRevisionRef: f.navigationRevisionRef,
  release: structuredClone(f.navigationRelease),
  releaseRevisionRef: f.navigationReleaseRevisionRef,
  targetRegistry: [
    [f.resolvedPageTarget, f.page.pageAccessPolicy, '/gallery'],
    [f.resolvedWorkbenchTarget, f.workbench.workbenchAccessPolicy, '/studio/:workbenchId'],
  ].map(([target, accessPolicy, path]) => ({
    ...target, kind: 'route', surface: 'studio', accessPolicy,
    routeClaim: { kind: 'canonical', surface: 'studio', routeSpaceRevisionRef: f.routeSpaceRevisionRef,
      pathTemplate: path, normalizedPath: path, matcher: { ...f.routeMatcher, surface: 'studio' } },
  })),
  compilerRevisionRef: f.compilerRevisionRef, generation: 1,
  limits: { maxNavigationNodes: 1024, maxNavigationDepth: 16 },
});

const missingInput = () => {
  const value = input();
  const target = value.release.resolvedTargets.shift();
  value.targetRegistry.shift();
  value.release.unavailableTargets = [{ nodeId: target.nodeId, stableTargetRef: target.stableTargetRef,
    reason: 'page-missing', accessPolicy: structuredClone(f.page.pageAccessPolicy) }];
  return value;
};

test('replays the BSD three-root topology without deleting any of its 33 targets', () => {
  const topology = require('./fixtures/navigation-three-roots-topology.json');
  const value = input();
  value.navigation.nodes = topology.nodes.map((node) => node.kind === 'group'
    ? { ...node, label:f.text(node.nodeId), collapsedByDefault:false, audience:f.access() }
    : { ...node, label:f.text(node.nodeId), targetRef:f.stable('page', `sanitized.${node.nodeId}`), parameterMapping:{}, audience:f.access() });
  const leaves=value.navigation.nodes.filter(node=>node.kind==='target');
  value.release.resolvedTargets=leaves.map(node=>({nodeId:node.nodeId,stableTargetRef:node.targetRef,targetRevisionRef:f.revision('page',node.targetRef.id)}));
  value.targetRegistry=value.release.resolvedTargets.map((target,index)=>({ ...target,kind:'route',surface:'studio',accessPolicy:f.access(),routeClaim:{kind:'canonical',surface:'studio',routeSpaceRevisionRef:f.routeSpaceRevisionRef,pathTemplate:`/fixture/${index}`,normalizedPath:`/fixture/${index}`,matcher:{...f.routeMatcher,surface:'studio'}} }));
  value.release.dependencySnapshot.push(...value.release.resolvedTargets.map(target=>({role:'page',revisionRef:target.targetRevisionRef})));
  const missing=value.release.resolvedTargets.shift();
  value.targetRegistry.shift();
  value.release.unavailableTargets=[{nodeId:missing.nodeId,stableTargetRef:missing.stableTargetRef,reason:'page-missing',accessPolicy:f.access()}];
  const before=structuredClone(value.navigation);
  const bundle=sdk.compileNavigationRuntimeBundle(value);
  assert.equal(bundle.nodes.filter(node=>node.parentNodeId===null).length,3);
  assert.equal(bundle.nodes.filter(node=>node.kind==='target').length,33);
  assert.equal(bundle.nodes.filter(node=>node.kind==='target'&&node.resolvedTarget.kind==='unavailable').length,1);
  assert.deepEqual(value.navigation,before);
});

test('isolates a missing Page without mutating source or inventing executable bindings', () => {
  const value = missingInput();
  const before = structuredClone(value);
  const bundle = sdk.compileNavigationRuntimeBundle(value);
  const missing = bundle.nodes.find((node) => node.nodeId === f.resolvedPageTarget.nodeId);
  assert.equal(missing.disabled, true);
  assert.equal(missing.resolvedTarget.kind, 'unavailable');
  assert.deepEqual(missing.parameterMapping, {});
  assert.equal('targetRevisionRef' in missing.resolvedTarget, false);
  assert.equal(bundle.nodes.find((node) => node.nodeId === f.resolvedWorkbenchTarget.nodeId).resolvedTarget.kind, 'route');
  assert.deepEqual(value, before);
});

test('unknown target with no trusted policy remains explicitly untrusted', () => {
  const value = missingInput();
  value.release.unavailableTargets[0].accessPolicy = null;
  const node = sdk.compileNavigationRuntimeBundle(value).nodes.find((node) => node.nodeId === f.resolvedPageTarget.nodeId);
  assert.equal(node.resolvedTarget.accessPolicy, null);
});

test('rejects unmatched unavailable records and cross-tenant references', () => {
  const value = missingInput();
  value.release.unavailableTargets[0].nodeId = 'not-a-source-node';
  assert.throws(() => sdk.compileNavigationRuntimeBundle(value), /source Page node/);
  const crossTenant = missingInput();
  const ref = crossTenant.navigation.nodes.find((node) => node.nodeId === f.resolvedPageTarget.nodeId).targetRef;
  ref.tenantScope.tenantRef.id = 'another-tenant';
  crossTenant.release.unavailableTargets[0].stableTargetRef = ref;
  assert.throws(() => sdk.compileNavigationRuntimeBundle(crossTenant), /tenant/i);
});

test('missing pages do not relax duplicate, action, audience, or tree validation', () => {
  const duplicate = missingInput();
  duplicate.targetRegistry.push(duplicate.targetRegistry[0]);
  assert.throws(() => sdk.compileNavigationRuntimeBundle(duplicate));
  const action = missingInput();
  action.release.unavailableTargets[0].stableTargetRef.kind = 'menu-action';
  assert.throws(() => sdk.compileNavigationRuntimeBundle(action));
  const audience = missingInput();
  audience.release.unavailableTargets[0].accessPolicy.permissionAllOf.push('ungranted.permission');
  assert.throws(() => sdk.compileNavigationRuntimeBundle(audience), /audience/i);
  const tree = missingInput();
  tree.navigation.nodes[0].parentNodeId = 'missing-parent';
  assert.throws(() => sdk.compileNavigationRuntimeBundle(tree));
});

test('restoration requires a governed exact binding and preserves manual disabled', () => {
  const unresolved = missingInput();
  unresolved.targetRegistry = input().targetRegistry;
  assert.throws(() => sdk.compileNavigationRuntimeBundle(unresolved), /exact|released/i);
  const restored = input();
  restored.navigation.nodes.find((node) => node.nodeId === f.resolvedPageTarget.nodeId).disabled = true;
  assert.equal(sdk.compileNavigationRuntimeBundle(restored).nodes.find((node) => node.nodeId === f.resolvedPageTarget.nodeId).disabled, true);
});

test('old readers receive only representable nodes with a matching content hash', () => {
  const bundle = sdk.compileNavigationRuntimeBundle(missingInput());
  assert.equal(sdk.projectNavigationCompatibility(bundle, true), bundle);
  const legacy = sdk.projectNavigationCompatibility(bundle, false);
  assert.equal(legacy.nodes.some((node) => node.nodeId === f.resolvedPageTarget.nodeId), false);
  assert.equal(legacy.nodes.some((node) => node.nodeId === f.resolvedWorkbenchTarget.nodeId), true);
  const { contentHash, ...unsigned } = legacy;
  assert.equal(contentHash, sdk.canonicalContentHash(unsigned));
});

test('wire validation rejects executable or identity-swapped unavailable nodes', () => {
  const bundle = structuredClone(sdk.compileNavigationRuntimeBundle(missingInput()));
  const node = bundle.nodes.find((node) => node.nodeId === f.resolvedPageTarget.nodeId);
  node.disabled = false;
  assert.equal(sdk.NavigationRuntimeBundleSchema.safeParse(bundle).success, false);
  node.disabled = true;
  node.resolvedTarget.nodeId = 'other-node';
  assert.equal(sdk.NavigationRuntimeBundleSchema.safeParse(bundle).success, false);
});
