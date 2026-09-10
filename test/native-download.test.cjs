"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { ActionBindingSchema, DeclarativeNativeDownloadSchema, DeclarativeRuntimeActionExecuteResultSchema } = require("../lib");
const { page, revision, stable } = require("./declarative-control-fixtures.cjs");
test("native download is opt-in and carries no literal URL", () => {
 const action = page.actionBindings[0];
 assert.equal(ActionBindingSchema.parse(action).success.download, undefined);
 assert.equal(ActionBindingSchema.safeParse({ ...action, success: { ...action.success, download: { kind: "native" } } }).success, true);
 assert.equal(ActionBindingSchema.safeParse({ ...action, success: { ...action.success, download: { kind: "native", url: "https://example.com" } } }).success, false);
});
test("download targets reject unsafe schemes credentials and filenames", () => {
 for (const url of ["javascript:alert(1)", "file:///tmp/model", "https://user:pass@example.com/model", "not-a-url"]) assert.equal(DeclarativeNativeDownloadSchema.safeParse({url,fileName:"model.bin"}).success,false);
 for (const fileName of ["../model", "a\\b", "a\nb", ""]) assert.equal(DeclarativeNativeDownloadSchema.safeParse({url:"https://example.com/model",fileName}).success,false);
 const url="https://example.com/model?sig=a%2Fb%3D";
 assert.equal(DeclarativeNativeDownloadSchema.parse({url,fileName:"model.bin"}).url,url);
});
test("response download failure preserves success evidence and excludes target", () => {
 const value={actionBindingId:"download",activeReleaseRevisionRef:revision("page-release","release"),pageRevisionRef:revision("page","page"),commandRevisionRef:revision("domain-command","download"),resultSchemaRevisionRef:revision("schema","descriptor"),result:{recordId:"record",modelName:"model"},idempotentReplay:true,lineageRef:stable("lineage","lineage"),refreshBindingIds:[],contentHash:"a".repeat(64)};
 const failed={...value,downloadError:{code:"DECLARATIVE_DOWNLOAD_FORBIDDEN"}};
 assert.deepEqual(DeclarativeRuntimeActionExecuteResultSchema.parse(failed).result,value.result);
 assert.equal(DeclarativeRuntimeActionExecuteResultSchema.safeParse({...failed,download:{url:"https://example.com",fileName:"model"}}).success,false);
 assert.equal(DeclarativeRuntimeActionExecuteResultSchema.safeParse({...failed,downloadError:{code:"DECLARATIVE_DOWNLOAD_UNAVAILABLE",message:"sensitive"}}).success,false);
});
test('text artifact download pins explicit safe result paths and a bounded size', () => {
 const action = page.actionBindings[0];
 const download = { kind: 'text-artifact', fileNamePath: ['artifact', 'fileName'], mimeTypePath: ['artifact', 'mimeType'], contentPath: ['artifact', 'content'], maxBytes: 1048576 };
 assert.equal(ActionBindingSchema.safeParse({ ...action, success: { ...action.success, download } }).success, true);
 for (const change of [{ maxBytes: 1048577 }, { contentPath: [] }, { contentPath: ['__proto__'] }]) assert.equal(ActionBindingSchema.safeParse({ ...action, success: { ...action.success, download: { ...download, ...change } } }).success, false);
});
