"use strict";

const assert = require("node:assert/strict");
const { existsSync } = require("node:fs");
const { resolve } = require("node:path");
const test = require("node:test");
const { AggregateCommitRequestSchema } = require("../lib/contracts");
const { canonicalContractSchemas } = require("../lib/schemas");
const packageContracts = require("@inf-monkeys-tech/monkeys/contracts");
const packagedAggregateSchema = require("@inf-monkeys-tech/monkeys/json-schema/aggregate-commit-request.schema.json");

const relationCommit = {
  contract: "AggregateCommitRequest",
  aggregate_id: "record-1",
  request_id: "request-1",
  idempotency_key: "relation-save-1",
  expected_head_commit_id: "commit-1",
  feature_relations: [
    {
      ontology_id: "ontology-source",
      asset_id: "record-1",
      column_id: "related-records",
      targets: [
        { ontology_id: "ontology-target", asset_id: "record-2" },
      ],
    },
  ],
  asset_relations: [
    {
      ontology_id: "ontology-source",
      asset_id: "record-1",
      relation_kind: "shared-with",
      objects: [
        {
          object_kind: "team",
          object_id: "team-2",
          properties: { role: "reader" },
        },
      ],
    },
  ],
};

test("aggregate commit exposes typed feature and asset relation replacements", () => {
  assert.deepEqual(AggregateCommitRequestSchema.parse(relationCommit), relationCommit);
});

test("aggregate relation mutations reject untyped or ambiguous payloads", () => {
  assert.throws(() =>
    AggregateCommitRequestSchema.parse({
      ...relationCommit,
      feature_relations: [
        {
          ontology_id: "ontology-source",
          asset_id: "record-1",
          column_id: "related-records",
          targets: [{ asset_id: "record-2" }],
        },
      ],
    }),
  );
  assert.throws(() =>
    AggregateCommitRequestSchema.parse({
      ...relationCommit,
      asset_relations: [
        {
          ontology_id: "ontology-source",
          asset_id: "record-1",
          relation_kind: "shared-with",
          objects: [{ object_kind: "team", object_id: "team-2", script: "arbitrary" }],
        },
      ],
    }),
  );
  assert.throws(() =>
    AggregateCommitRequestSchema.parse({
      contract: "AggregateCommitRequest",
      aggregate_id: "record-1",
      request_id: "request-1",
      idempotency_key: "empty-1",
    }),
  );
});

test("aggregate commit is published as a canonical generated contract", () => {
  assert.equal(canonicalContractSchemas["aggregate-commit-request"], AggregateCommitRequestSchema);
  assert.equal(packageContracts.AggregateCommitRequestSchema, AggregateCommitRequestSchema);
  assert.equal(packagedAggregateSchema.title, "aggregate-commit-request");
  assert.equal(existsSync(resolve(__dirname, "../lib/json-schema/aggregate-commit-request.schema.json")), true);
});
