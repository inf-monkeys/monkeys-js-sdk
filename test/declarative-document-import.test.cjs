const assert = require("node:assert/strict");
const { test } = require("node:test");
const sdk = require("../lib");
const fixtures = require("./declarative-control-fixtures.cjs");
const page = {
  contract: "Page",
  schemaVersion: 1,
  pageId: fixtures.page.pageId,
  tenantScope: fixtures.tenantScope,
  identity: fixtures.page.identity,
  surface: "studio",
  route: "/gallery",
  lifecycle: "active",
  body: { id: "gallery", component: fixtures.capabilityRevisionRef.id },
  access: fixtures.page.pageAccessPolicy,
  managementAccess: fixtures.managementAccess,
};

test("document import accepts canonical Page and Navigation without a create template", () => {
  for (const document of [page, fixtures.navigation]) {
    const surface =
      document.contract === "Page"
        ? document.surface
        : document.supportedSurfaces[0];
    assert.deepEqual(
      sdk.DeclarativeDocumentImportRequestSchema.parse({ document, surface }),
      {
        document: sdk.DeclarativeImportDocumentSchema.parse(document),
        surface,
      },
    );
    assert.throws(() =>
      sdk.DeclarativeDocumentImportRequestSchema.parse({
        document,
        surface,
        tenantId: "override",
      }),
    );
  }
});

test("document import commit requires an exact preflight and version fence", () => {
  const request = { document: page, surface: page.surface };
  assert.throws(() => sdk.DeclarativeDocumentImportIntentSchema.parse(request));
  const intent = {
    ...request,
    expectedVersion: 0,
    expectedPlanHash: "a".repeat(64),
    idempotencyKey: "import-test",
  };
  assert.equal(
    sdk.DeclarativeDocumentImportIntentSchema.parse(intent).expectedVersion,
    0,
  );
  assert.throws(() =>
    sdk.DeclarativeDocumentImportIntentSchema.parse({
      ...intent,
      expectedVersion: -1,
    }),
  );
});

test("document import refuses a surface different from the document", () => {
  assert.throws(() =>
    sdk.DeclarativeDocumentImportRequestSchema.parse({
      document: page,
      surface: "kernel",
    }),
  );
});

test("document import plans pin resource, scope, surface and environment identity", () => {
  const document = sdk.DeclarativeImportDocumentSchema.parse(page);
  const plan = {
    contract: "DeclarativeDocumentImportPlan",
    schemaVersion: 1,
    resourceKind: "page",
    resourceId: document.pageId,
    surface: "studio",
    sourceContentHash: sdk.canonicalContentHash(document),
    document,
    tenantScope: document.tenantScope,
    environmentRevisionRef: {
      ...fixtures.environmentRef,
      revision: 1,
      schemaVersion: 1,
      contentHash: "e".repeat(64),
    },
    requiresInitialization: false,
    expectedVersion: 0,
    currentContentHash: null,
    changed: true,
    diagnostics: [],
    dependencyContentHash: "d".repeat(64),
    planHash: "a".repeat(64),
  };
  assert.equal(
    sdk.DeclarativeDocumentImportPlanSchema.safeParse(plan).success,
    true,
  );
  for (const change of [
    { resourceKind: "navigation" },
    { resourceId: "other" },
    { surface: "kernel" },
    { requiresInitialization: true },
    { environmentRevisionRef: fixtures.pageRevisionRef },
  ]) {
    assert.equal(
      sdk.DeclarativeDocumentImportPlanSchema.safeParse({ ...plan, ...change })
        .success,
      false,
    );
  }
  const revisionRef = { ...fixtures.pageRevisionRef, revision: 1 };
  const result = { action: "import", changed: true, plan, revisionRef };
  assert.equal(
    sdk.DeclarativeDocumentImportResultSchema.safeParse(result).success,
    true,
  );
  assert.equal(
    sdk.DeclarativeDocumentImportResultSchema.safeParse({
      ...result,
      revisionRef: { ...revisionRef, revision: 2 },
    }).success,
    false,
  );
  assert.equal(
    sdk.DeclarativeDocumentImportResultSchema.safeParse({
      ...result,
      changed: false,
    }).success,
    false,
  );
});

test("document import routes keep preflight separate from writes", () => {
  assert.equal(
    sdk.declarativeControlRoutes.prepareDocumentImport("page"),
    "/api/declarative-control/authoring/documents/page/prepare",
  );
  assert.equal(
    sdk.declarativeControlRoutes.importDocument("navigation"),
    "/api/declarative-control/authoring/documents/navigation/import",
  );
});
