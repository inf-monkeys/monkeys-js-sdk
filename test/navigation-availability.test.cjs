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

// A Navigation release can no longer describe a Page it did not verify, so a
// missing Page is simply an unreleased target reference.
const missingInput = () => {
  const value = input();
  value.release.resolvedTargets.shift();
  value.targetRegistry.shift();
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
  const before=structuredClone(value.navigation);
  const bundle=sdk.compileNavigationRuntimeBundle(value);
  assert.equal(bundle.nodes.filter(node=>node.parentNodeId===null).length,3);
  assert.equal(bundle.nodes.filter(node=>node.kind==='target').length,33);
  assert.equal(bundle.nodes.filter(node=>node.kind==='target'&&node.resolvedTarget.kind==='route').length,33);
  assert.deepEqual(value.navigation,before);
});

test('NavigationRelease rejects an available-target list and cannot describe a missing Page', () => {
  const value = input();
  value.release.unavailableTargets = [];
  assert.equal(sdk.NavigationReleaseSchema.safeParse(value.release).success, false);
});

test('a Navigation target whose Page is not released blocks compilation', () => {
  const value = missingInput();
  const before = structuredClone(value);
  assert.throws(() => sdk.compileNavigationRuntimeBundle(value), /NAV_TARGET_UNRELEASED|unreleased/i);
  assert.deepEqual(value, before);
});

test('missing pages do not relax duplicate, action, or tree validation', () => {
  const duplicate = input();
  duplicate.targetRegistry.push(duplicate.targetRegistry[0]);
  assert.throws(() => sdk.compileNavigationRuntimeBundle(duplicate));
  const tree = input();
  tree.navigation.nodes[0].parentNodeId = 'missing-parent';
  assert.throws(() => sdk.compileNavigationRuntimeBundle(tree));
});

test('restoration follows a current Page identity and preserves manual disabled', () => {
  const restored = input();
  const target = restored.release.resolvedTargets.find((entry) => entry.nodeId === f.resolvedPageTarget.nodeId);
  target.targetRevisionRef = { ...target.targetRevisionRef, revision: 4, contentHash: '4'.repeat(64) };
  restored.targetRegistry[0].targetRevisionRef = target.targetRevisionRef;
  // The release evidence must name the same Page revision the registry serves.
  const evidence = restored.release.dependencySnapshot.find((entry) => entry.role === 'page' && entry.revisionRef.id === target.targetRevisionRef.id);
  if (evidence) evidence.revisionRef = target.targetRevisionRef;
  const bundle = sdk.compileNavigationRuntimeBundle(restored);
  assert.equal(bundle.nodes.find(node => node.nodeId === f.resolvedPageTarget.nodeId).resolvedTarget.targetRevisionRef.revision, 4);
  restored.navigation.nodes.find((node) => node.nodeId === f.resolvedPageTarget.nodeId).disabled = true;
  assert.equal(sdk.compileNavigationRuntimeBundle(restored).nodes.find((node) => node.nodeId === f.resolvedPageTarget.nodeId).disabled, true);
});

test('Page links follow current releases and rollback without changing Navigation release evidence', () => {
  const value = input();
  const release = structuredClone(value.release);
  for (const revision of [3, 2, 4]) {
    value.targetRegistry[0].targetRevisionRef = { ...f.resolvedPageTarget.targetRevisionRef, revision, contentHash: String(revision).repeat(64) };
    value.targetRegistry[0].routeClaim.normalizedPath = `/gallery-${revision}`;
    value.targetRegistry[0].routeClaim.pathTemplate = `/gallery-${revision}`;
    value.targetRegistry[0].accessPolicy = f.access({ permissionAllOf: ['new.permission'] });
    const bundle = sdk.compileNavigationRuntimeBundle(value);
    const node = bundle.nodes.find(n => n.nodeId === f.resolvedPageTarget.nodeId);
    assert.equal(node.resolvedTarget.targetRevisionRef.revision, revision);
    assert.equal(node.resolvedTarget.routeClaim.normalizedPath, `/gallery-${revision}`);
    assert.deepEqual(node.resolvedTarget.accessPolicy, value.targetRegistry[0].accessPolicy);
    assert.deepEqual(value.release, release);
  }
});

test('cold Navigation rebuild fails when a previously published Page is unreleased', () => {
  const value = input();
  value.targetRegistry.shift();
  assert.throws(() => sdk.compileNavigationRuntimeBundle(value), /NAV_TARGET_UNRELEASED|unreleased/i);
});

test('Page revision independence never relaxes Workbench exact bindings', () => {
  const value = input();
  value.targetRegistry[1].targetRevisionRef = { ...value.targetRegistry[1].targetRevisionRef, revision: 7 };
  assert.throws(() => sdk.compileNavigationRuntimeBundle(value), /exact|released/i);
});

test('runtime projection restores current Page routes, authored disablement and parameter mappings', () => {
  const value = input();
  const source = sdk.compileNavigationRuntimeBundle(value);
  const missing = sdk.projectCurrentNavigationPages(source, value.navigation, value.targetRegistry.slice(1));
  assert.equal(missing.nodes.find(n => n.nodeId === f.resolvedPageTarget.nodeId).resolvedTarget.kind, 'unavailable');
  const targets = structuredClone(value.targetRegistry);
  targets[0].targetRevisionRef.revision = 4;
  targets[0].routeClaim.normalizedPath = '/latest';
  const restored = sdk.projectCurrentNavigationPages(missing, value.navigation, targets);
  const node = restored.nodes.find(n => n.nodeId === f.resolvedPageTarget.nodeId);
  assert.equal(node.disabled, value.navigation.nodes.find(n => n.nodeId === node.nodeId).disabled);
  assert.equal(node.resolvedTarget.routeClaim.normalizedPath, '/latest');
  targets[0].routeClaim.normalizedPath = '/latest/:recordId';
  targets[0].routeClaim.matcher.parameters = [{ name: 'recordId', type: 'identifier', required: true }];
  assert.equal(sdk.projectCurrentNavigationPages(source, value.navigation, targets).nodes.find(n => n.nodeId === node.nodeId).resolvedTarget.kind, 'unavailable');
  assert.throws(() => sdk.projectCurrentNavigationPages(source, value.navigation, [...targets, targets[0]]), /CATALOG_INVALID/);
  assert.deepEqual(source, sdk.compileNavigationRuntimeBundle(value));
});
