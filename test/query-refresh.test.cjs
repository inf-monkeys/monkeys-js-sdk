"use strict";
const assert = require("node:assert/strict");
const test = require("node:test");
const { QueryBindingSchema, DeclarativeRuntimeBindingQueryResultSchema, canonicalContentHash } = require("../lib");
const { revision } = require("./declarative-control-fixtures.cjs");
const binding = { bindingId: "status", queryDefinitionRevisionRef: revision("domain-query-definition", "status"), parameters: {}, target: { capabilityInstanceId: "status", port: "model" }, renderModelSchemaRevisionRef: revision("schema", "status.model"), execution: "server", pagination: "none", cache: "none", cancelOnChange: true };
test("query refresh is opt-in and bounded", () => {
  assert.equal(QueryBindingSchema.parse(binding).refreshPolicy, undefined);
  for (const intervalMs of [1000, 3000, 10000, 300000]) assert.deepEqual(QueryBindingSchema.parse({ ...binding, refreshPolicy: { intervalMs } }).refreshPolicy, { intervalMs });
  for (const intervalMs of [0, 999, 300001, 1000.5]) assert.equal(QueryBindingSchema.safeParse({ ...binding, refreshPolicy: { intervalMs } }).success, false);
});
test("refresh rejects local execution and pagination", () => {
  for (const overrides of [{ execution: "local-state" }, { pagination: "cursor" }, { pagination: "offset" }]) assert.equal(QueryBindingSchema.safeParse({ ...binding, ...overrides, refreshPolicy: { intervalMs: 3000 } }).success, false);
  assert.equal(QueryBindingSchema.safeParse({ ...binding, refreshPolicy: { intervalMs: 3000, script: "arbitrary" } }).success, false);
});
test("continuation is strict response metadata and changes evidence hash", () => {
  const result = { bindingId: "status", activeReleaseRevisionRef: revision("page-release", "release"), pageRevisionRef: revision("page", "page"), renderModelSchemaRevisionRef: revision("schema", "model"), model: {}, sourceRevisionRefs: [] };
  const parse = value => DeclarativeRuntimeBindingQueryResultSchema.safeParse({ ...value, contentHash: canonicalContentHash(value) });
  assert.equal(parse(result).success, true);
  for (const value of [true, false]) assert.equal(parse({ ...result, refresh: { continue: value } }).success, true);
  assert.equal(parse({ ...result, refresh: { continue: "false" } }).success, false);
  assert.equal(parse({ ...result, refresh: { continue: false, extra: true } }).success, false);
  assert.notEqual(canonicalContentHash({ ...result, refresh: { continue: true } }), canonicalContentHash({ ...result, refresh: { continue: false } }));
});
