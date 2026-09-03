'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const contracts = require('../lib/contracts');
const runtime = require('../lib/runtime');
const fixture = require('./declarative-control-fixtures.cjs');

const kernelRouteSpaceRevisionRef = fixture.revision('route-space', 'kernel.primary', {
  visibility: 'global',
  ownerRepo: 'monkeys-server',
  contentHash: fixture.HASH_B,
});
const kernelRouteSpace = {
  ...fixture.routeSpace,
  routeSpaceId: 'kernel.primary',
  supportedSurface: 'kernel',
  basePath: '/kernel',
  reservedPaths: [],
};
const routeSpaces = [{
  revisionRef: fixture.routeSpaceRevisionRef,
  routeSpace: fixture.routeSpace,
}, {
  revisionRef: kernelRouteSpaceRevisionRef,
  routeSpace: kernelRouteSpace,
}];

test('one multi-surface Page compiles only claims for the requested surface', () => {
  const claims = [{
    kind: 'canonical',
    surface: 'studio',
    routeSpaceRevisionRef: fixture.routeSpaceRevisionRef,
    pathTemplate: '/gallery',
  }, {
    kind: 'alias',
    surface: 'studio',
    routeSpaceRevisionRef: fixture.routeSpaceRevisionRef,
    pathTemplate: '/gallery-alias',
  }, {
    kind: 'canonical',
    surface: 'kernel',
    routeSpaceRevisionRef: kernelRouteSpaceRevisionRef,
    pathTemplate: '/data-assets',
  }];
  const page = contracts.PageSchema.parse({
    ...fixture.page,
    supportedSurfaces: ['studio', 'kernel'],
    routeClaims: claims,
  });

  const studio = runtime.compileRouteClaims({ claims: page.routeClaims, routeSpaces, surface: 'studio' });
  const kernel = runtime.compileRouteClaims({ claims: page.routeClaims, routeSpaces, surface: 'kernel' });

  assert.deepEqual(studio.map((claim) => claim.surface), ['studio', 'studio']);
  assert.deepEqual(kernel.map((claim) => claim.surface), ['kernel']);
  assert.equal(studio[0].matcher.caseSensitive, fixture.routeSpace.caseSensitive);
  assert.equal(kernel[0].matcher.trailingSlash, kernelRouteSpace.trailingSlash);
});

test('an explicit claim surface must match its exact RouteSpace', () => {
  assert.throws(
    () => runtime.compileRouteClaims({
      claims: [{
        kind: 'canonical',
        surface: 'studio',
        routeSpaceRevisionRef: kernelRouteSpaceRevisionRef,
        pathTemplate: '/data-assets',
      }],
      routeSpaces,
      surface: 'studio',
    }),
    (error) => error.code === 'ROUTE_SPACE_MISMATCH' && error.path === 'routeClaims[0].surface',
  );
});

test('Navigation route registrations reject a claim from another surface', () => {
  const pageTarget = {
    kind: 'route',
    stableTargetRef: fixture.stable('page', fixture.page.pageId),
    targetRevisionRef: fixture.pageRevisionRef,
    releaseRevisionRef: fixture.pageReleaseRevisionRef,
    surface: 'studio',
    accessPolicy: fixture.page.pageAccessPolicy,
    routeClaim: {
      kind: 'canonical',
      surface: 'kernel',
      routeSpaceRevisionRef: kernelRouteSpaceRevisionRef,
      pathTemplate: '/data-assets',
      normalizedPath: '/data-assets',
      matcher: {
        caseSensitive: kernelRouteSpace.caseSensitive,
        trailingSlash: kernelRouteSpace.trailingSlash,
        parameters: kernelRouteSpace.parameters,
      },
    },
  };
  const workbenchTarget = {
    kind: 'route',
    stableTargetRef: fixture.stable('workbench', fixture.workbench.workbenchId),
    targetRevisionRef: fixture.workbenchRevisionRef,
    releaseRevisionRef: fixture.workbenchReleaseRevisionRef,
    surface: 'studio',
    accessPolicy: fixture.workbench.workbenchAccessPolicy,
    routeClaim: {
      kind: 'canonical',
      surface: 'studio',
      routeSpaceRevisionRef: fixture.routeSpaceRevisionRef,
      pathTemplate: '/studio/:workbenchId',
      normalizedPath: '/studio/:workbenchId',
      matcher: fixture.routeMatcher,
    },
  };

  assert.throws(
    () => runtime.compileNavigationRuntimeBundle({
      navigation: fixture.navigation,
      navigationRevisionRef: fixture.navigationRevisionRef,
      release: fixture.navigationRelease,
      releaseRevisionRef: fixture.navigationReleaseRevisionRef,
      targetRegistry: [pageTarget, workbenchTarget],
      compilerRevisionRef: fixture.compilerRevisionRef,
      generation: 1,
      limits: {
        maxNavigationNodes: 1024,
        maxNavigationDepth: 16,
        maxRenderNodes: 1024,
        maxRenderDepth: 32,
        maxWorkbenchGroups: 128,
        maxWorkbenchInstances: 1024,
      },
    }),
    (error) => error.code === 'ROUTE_SPACE_MISMATCH' && error.path === 'targetRegistry[0].routeClaim.surface',
  );
});

test('fully explicit Page claims require exactly one canonical per supported surface', () => {
  const result = contracts.PageSchema.safeParse({
    ...fixture.page,
    supportedSurfaces: ['studio', 'kernel'],
    routeClaims: [{
      kind: 'canonical',
      surface: 'studio',
      routeSpaceRevisionRef: fixture.routeSpaceRevisionRef,
      pathTemplate: '/gallery',
    }, {
      kind: 'alias',
      surface: 'kernel',
      routeSpaceRevisionRef: kernelRouteSpaceRevisionRef,
      pathTemplate: '/data-assets',
    }],
  });

  assert.equal(result.success, false);
  assert.match(result.error.issues.map((issue) => issue.message).join('\n'), /Surface kernel requires exactly one canonical route claim/);
});

test('Page rejects mixed legacy and explicit-surface route claim groups', () => {
  const result = contracts.PageSchema.safeParse({
    ...fixture.page,
    routeClaims: [
      ...fixture.page.routeClaims,
      {
        kind: 'alias',
        surface: 'studio',
        routeSpaceRevisionRef: fixture.routeSpaceRevisionRef,
        pathTemplate: '/gallery-alias',
      },
    ],
  });

  assert.equal(result.success, false);
  assert.match(result.error.issues.map((issue) => issue.message).join('\n'), /must either all declare surface or all omit it/);
});

test('Workbench rejects mixed legacy and explicit-surface route claim groups', () => {
  const result = contracts.WorkbenchSchema.safeParse({
    ...fixture.workbench,
    routeClaims: [
      ...fixture.workbench.routeClaims,
      {
        kind: 'alias',
        surface: 'studio',
        routeSpaceRevisionRef: fixture.routeSpaceRevisionRef,
        pathTemplate: '/studio/:workbenchId/alias',
      },
    ],
  });

  assert.equal(result.success, false);
  assert.match(result.error.issues.map((issue) => issue.message).join('\n'), /must either all declare surface or all omit it/);
});

test('legacy Page, Workbench and release route claims remain readable', () => {
  assert.equal(contracts.PageSchema.safeParse(fixture.page).success, true);
  assert.equal(contracts.WorkbenchSchema.safeParse(fixture.workbench).success, true);
  assert.equal(contracts.PageReleaseSchema.safeParse(fixture.pageRelease).success, true);
  assert.equal(contracts.WorkbenchReleaseSchema.safeParse(fixture.workbenchRelease).success, true);
  assert.equal('surface' in fixture.pageRelease.target.routeClaim, false);
  assert.equal('surface' in fixture.workbenchRelease.target.routeClaim, false);

  assert.equal(contracts.PageReleaseSchema.safeParse({
    ...fixture.pageRelease,
    target: {
      ...fixture.pageRelease.target,
      routeClaim: {
        ...fixture.pageRelease.target.routeClaim,
        surface: 'kernel',
      },
    },
  }).success, false);
  assert.equal(contracts.WorkbenchReleaseSchema.safeParse({
    ...fixture.workbenchRelease,
    target: {
      ...fixture.workbenchRelease.target,
      routeClaim: {
        ...fixture.workbenchRelease.target.routeClaim,
        normalizedPath: '/wrong',
      },
    },
  }).success, false);
});

test('legacy claims gain one surface from their exact RouteSpace and runtime bundles reject legacy claims', () => {
  const [compiled] = runtime.compileRouteClaims({
    claims: fixture.page.routeClaims,
    routeSpaces: routeSpaces.slice(0, 1),
    surface: 'studio',
  });

  assert.equal(compiled.surface, 'studio');
  assert.deepEqual(compiled.matcher, fixture.routeMatcher);

  const legacyRuntimeBundle = {
    ...runtime.compilePageRuntimeBundle({
      page: fixture.page,
      pageRevisionRef: fixture.pageRevisionRef,
      release: fixture.pageRelease,
      releaseRevisionRef: fixture.pageReleaseRevisionRef,
      routeSpaces: routeSpaces.slice(0, 1),
      compilerRevisionRef: fixture.compilerRevisionRef,
      generation: 1,
      limits: {
        maxNavigationNodes: 1024,
        maxNavigationDepth: 16,
        maxRenderNodes: 1024,
        maxRenderDepth: 32,
        maxWorkbenchGroups: 128,
        maxWorkbenchInstances: 1024,
      },
      capabilityRegistry: [{
        capabilityRevisionRef: fixture.capabilityRevisionRef,
        providerRevisionRef: fixture.providerRevisionRef,
        editorEligible: true,
        inputPorts: [{ name: 'items', schemaRevisionRef: fixture.page.ontologyBindings[0].renderModelSchemaRevisionRef }],
        outputPorts: [{ name: 'favorite', schemaRevisionRef: fixture.page.actionBindings[0].sourceIntentSchemaRevisionRef }],
        allowedSideEffects: ['network'],
      }],
    }),
    routeClaims: [{
      kind: compiled.kind,
      routeSpaceRevisionRef: compiled.routeSpaceRevisionRef,
      pathTemplate: compiled.pathTemplate,
      normalizedPath: compiled.normalizedPath,
      matcher: compiled.matcher,
    }],
  };
  assert.equal(contracts.PageRuntimeBundleSchema.safeParse(legacyRuntimeBundle).success, false);

  const legacyWorkbenchTarget = {
    ...fixture.workbenchRelease.target,
  };
  const compiledWorkbench = runtime.compileWorkbenchRuntimeBundle({
    workbench: fixture.workbench,
    workbenchRevisionRef: fixture.workbenchRevisionRef,
    release: fixture.workbenchRelease,
    releaseRevisionRef: fixture.workbenchReleaseRevisionRef,
    routeSpaces: routeSpaces.slice(0, 1),
    targetRegistry: [{
      stableTargetRef: fixture.stable('workflow', fixture.workflowRevisionRef.id, { ownerRepo: fixture.workflowRevisionRef.ownerRepo }),
      targetRevisionRef: fixture.workflowRevisionRef,
      accessPolicy: fixture.access({ permissionAllOf: ['workflow.run'] }),
    }],
    compilerRevisionRef: fixture.compilerRevisionRef,
    generation: 1,
    limits: {
      maxNavigationNodes: 1024,
      maxNavigationDepth: 16,
      maxRenderNodes: 1024,
      maxRenderDepth: 32,
      maxWorkbenchGroups: 128,
      maxWorkbenchInstances: 1024,
    },
  });
  assert.equal(compiledWorkbench.target.routeClaim.surface, 'studio');
  assert.equal(contracts.WorkbenchRuntimeBundleSchema.safeParse({
    ...compiledWorkbench,
    target: legacyWorkbenchTarget,
  }).success, false);
});
