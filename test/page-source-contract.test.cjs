"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const { PageSchema, ResolvedPageSchema } = require("@inf-monkeys-tech/monkeys");
const {
  compilePageRuntimeBundle,
  resolvePage,
} = require("@inf-monkeys-tech/monkeys/runtime");
const {
  capabilityRevisionRef,
  compilerRevisionRef,
  managementAccess,
  observationPolicyRevisionRef,
  page: legacyPage,
  pageRelease,
  pageReleaseRevisionRef,
  pageRevisionRef,
  performanceBudgetRef,
  providerRevisionRef,
  routeSpace,
  routeSpaceRevisionRef,
  shellRegistration,
  shellRevisionRef,
  tenantScope,
  tokenRevisionRef,
} = require("./declarative-control-fixtures.cjs");

const access = legacyPage.pageAccessPolicy;
const propertySchemaRevisionRef =
  legacyPage.capabilityInstances[0].propertySchemaRevisionRef;
const page = {
  contract: "Page",
  schemaVersion: 1,
  pageId: legacyPage.pageId,
  tenantScope,
  identity: legacyPage.identity,
  surface: "studio",
  route: "/Gallery/",
  lifecycle: "active",
  body: {
    id: "gallery",
    component: capabilityRevisionRef.id,
    props: { density: "comfortable" },
    style: {
      padding: "$semantic.spacing.lg",
      borderRadius: "12px",
    },
  },
  access,
  managementAccess,
};

const capabilityRegistry = [
  {
    capabilityRevisionRef,
    providerRevisionRef,
    propertySchemaRevisionRef,
    accessPolicy: access,
    editorEligible: true,
    inputPorts: [],
    outputPorts: [],
    allowedSideEffects: ["network"],
  },
];

const defaults = {
  routeSpace: routeSpaceRevisionRef,
  shell: shellRevisionRef,
  tokens: [tokenRevisionRef],
  performanceBudget: performanceBudgetRef,
  observationPolicy: observationPolicyRevisionRef,
};

test("Page is the single simple authoring contract", () => {
  const parsed = PageSchema.parse(page);
  assert.equal(parsed.body.component, capabilityRevisionRef.id);
  assert.equal(parsed.body.style.padding, "$semantic.spacing.lg");
  assert.equal(PageSchema.safeParse(legacyPage).success, false);
  assert.equal(
    PageSchema.safeParse({ ...page, contentHash: "a".repeat(64) }).success,
    false,
  );
  assert.equal(
    PageSchema.safeParse({ ...page, body: { ...page.body, className: "p-4" } })
      .success,
    false,
  );
});

test("Page style accepts tokens and bounded CSS values but rejects CSS injection paths", () => {
  assert.equal(PageSchema.safeParse(page).success, true);
  for (const value of [
    "var(--secret)",
    "url(https://example.com/x)",
    "red; display:none",
  ]) {
    assert.equal(
      PageSchema.safeParse({
        ...page,
        body: { ...page.body, style: { background: value } },
      }).success,
      false,
    );
  }
});

test("resolvePage pins active dependencies before runtime compilation", () => {
  const resolved = resolvePage({
    page,
    pageOwnerRepo: "monkeys-js-sdk",
    defaults,
    routeSpaces: [{ revisionRef: routeSpaceRevisionRef, routeSpace }],
    capabilityRegistry,
  });
  assert.equal(ResolvedPageSchema.safeParse(resolved).success, true);
  assert.equal(
    resolved.renderTree.nodes[0].style.padding,
    "$semantic.spacing.lg",
  );
  assert.equal(
    resolved.capabilityInstances[0].capabilityRevisionRef.contentHash,
    capabilityRevisionRef.contentHash,
  );
  const bundle = compilePageRuntimeBundle({
    page: resolved,
    pageRevisionRef,
    release: pageRelease,
    releaseRevisionRef: pageReleaseRevisionRef,
    routeSpaces: [{ revisionRef: routeSpaceRevisionRef, routeSpace }],
    compilerRevisionRef,
    generation: 1,
    limits: {
      maxNavigationNodes: 1024,
      maxNavigationDepth: 16,
      maxRenderNodes: 1024,
      maxRenderDepth: 32,
      maxWorkbenchGroups: 128,
      maxWorkbenchInstances: 1024,
    },
    capabilityRegistry,
    shellRegistration,
  });
  assert.equal(bundle.renderTree.nodes[0].style.borderRadius, "12px");
  assert.equal(bundle.contentHash.length, 64);
});

test("resolvePage rejects unknown stable component identities", () => {
  assert.throws(
    () =>
      resolvePage({
        page: {
          ...page,
          body: { ...page.body, component: "unknown.component" },
        },
        pageOwnerRepo: "monkeys-js-sdk",
        defaults,
        capabilityRegistry,
      }),
    (error) => error && error.code === "DEPENDENCY_MISSING",
  );
});

test("cursor event sources resolve before or after the query node and in descendants", () => {
  const queryId = "query.cursor-items";
  const definition = {
    contract: "DomainQueryDefinition",
    schemaVersion: 1,
    queryId,
    tenantScope,
    dataSource: { kind: "tenant-catalog", resource: "ontology" },
    handlerRef: { kind: "domain-query", id: queryId, ownerRepo: "monkeys-server", version: 1 },
    inputSchemaRevisionRef: propertySchemaRevisionRef,
    resultSchemaRevisionRef: propertySchemaRevisionRef,
    accessPolicy: access,
    lineageRequired: true,
  };
  const queryNode = {
    id: "items",
    component: capabilityRevisionRef.id,
    data: [{ bindingId: "items-query", query: queryId, port: "items", parameters: {}, pagination: "cursor", cache: "identity-scoped", cancelOnChange: true, cursorWindow: { sourceCapabilityInstanceId: "pager", pageChangePort: "page-change" } }],
  };
  const pager = { id: "pager", component: capabilityRevisionRef.id };
  const registry = [{ ...capabilityRegistry[0], inputPorts: [{ name: "items", schemaRevisionRef: propertySchemaRevisionRef }], outputPorts: [{ name: "page-change", schemaRevisionRef: propertySchemaRevisionRef }] }];
  const input = {
    pageOwnerRepo: "monkeys-js-sdk",
    defaults,
    capabilityRegistry: registry,
    domainQueryRegistry: [{ definition, definitionRevisionRef: { ...propertySchemaRevisionRef, kind: "domain-query-definition", id: queryId } }],
  };
  for (const body of [
    { ...page.body, children: [pager, queryNode] },
    { ...page.body, children: [queryNode, pager] },
    { ...queryNode, children: [pager] },
  ]) {
    const resolved = resolvePage({ ...input, page: { ...page, body } });
    assert.equal(resolved.queryBindings[0].cursorWindow.sourceCapabilityInstanceId, "pager");
    assert.deepEqual(resolved.queryBindings[0].cursorWindow.pageChangeIntentSchemaRevisionRef, propertySchemaRevisionRef);
  }
  for (const source of ["missing", "pager"]) {
    const invalid = structuredClone(queryNode);
    invalid.data[0].cursorWindow.sourceCapabilityInstanceId = source;
    if (source === "pager") invalid.data[0].cursorWindow.pageChangePort = "unknown-port";
    assert.throws(() => resolvePage({ ...input, page: { ...page, body: { ...invalid, children: [pager] } } }), (error) => error.code === "PORT_TYPE_MISMATCH");
  }
});
