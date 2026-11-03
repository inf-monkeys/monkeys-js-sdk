const { test } = require("node:test");
const assert = require("node:assert/strict");
const {
  RecipeRecordSchema,
  WorkflowCatalogEntrySchema,
} = require("../lib/contracts");

test("Recipe records bind one team, scope and workflow without a second graph", () => {
  const record = {
    contract: "RecipeRecord",
    id: "r1",
    teamId: "t1",
    scopeId: "s1",
    workflowId: "w1",
    sourceWorkflowId: "source",
    displayField: "name",
    creationHash: "a".repeat(64),
    lastCommandHash: "a".repeat(64),
    definitionRecordVersion: 1,
    formValues: { name: "Sample" },
    createdAt: "2026-11-03T00:00:00Z",
    updatedAt: "2026-11-03T00:00:00Z",
  };
  assert.equal(RecipeRecordSchema.parse(record).workflowId, "w1");
  assert.equal(
    RecipeRecordSchema.safeParse({ ...record, graph: {} }).success,
    false,
  );
  assert.equal(
    RecipeRecordSchema.safeParse({ ...record, scopeId: "" }).success,
    false,
  );
});

test("Recipe ownership cannot describe a public or unauthenticated workflow", () => {
  const catalog = {
    contract: "WorkflowCatalogEntry",
    workflowId: "w1",
    teamId: "t1",
    creatorRef: { kind: "user", id: "u1", ownerRepo: "monkeys-server" },
    currentDefinitionRef: {
      kind: "workflow-definition",
      id: "w1:release:1",
      ownerRepo: "monkeys-data-server",
    },
    lifecycle: "ACTIVE",
    owner: {
      kind: "recipe",
      creationHash: "a".repeat(64),
      recordId: "r1",
      scopeId: "s1",
    },
    asset: {
      preset: false,
      marketplacePublished: false,
      sort: 0,
      notAuthorized: false,
    },
    createdAt: "2026-11-03T00:00:00Z",
    updatedAt: "2026-11-03T00:00:00Z",
  };
  assert.equal(WorkflowCatalogEntrySchema.safeParse(catalog).success, true);
  assert.equal(
    WorkflowCatalogEntrySchema.safeParse({
      ...catalog,
      asset: { ...catalog.asset, notAuthorized: true },
    }).success,
    false,
  );
  assert.equal(
    WorkflowCatalogEntrySchema.safeParse({
      ...catalog,
      asset: { ...catalog.asset, marketplacePublished: true },
    }).success,
    false,
  );
});
