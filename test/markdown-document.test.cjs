const { test } = require('node:test');
const assert = require('node:assert/strict');
const sdk = require('../lib/contracts');
const source = { agentId: 'agent', threadId: 'thread', artifactId: 'artifact', fileUri: 'file://original' };

test('document writes persist managed references and reject body or transient URL fields', () => {
  assert.ok(sdk.MarkdownDocumentSaveSchema, 'The shared document save contract must be exported');
  const input = { source, contentFileUri: 'file://edited', expectedHeadCommitId: '', requestId: 'save-1' };
  assert.deepEqual(sdk.MarkdownDocumentSaveSchema.parse(input), input);
  for (const extra of [{ markdown: '# Private body' }, { html: '<h1>Body</h1>' }, { editorState: {} }])
    assert.equal(sdk.MarkdownDocumentSaveSchema.safeParse({ ...input, ...extra }).success, false);
  assert.equal(sdk.MarkdownDocumentSaveSchema.safeParse({ ...input, contentFileUri: 'https://storage.test/a.md?signature=expired' }).success, false);
  assert.equal(sdk.MarkdownDocumentSaveSchema.safeParse({ ...input, source: { ...source, fileUri: 'blob:temporary' } }).success, false);
});

test('persisted document metadata contains immutable source and content identities only', () => {
  const value = { contract: 'MarkdownDocument', schemaVersion: 1, documentId: 'document', source,
    file: { uri: 'file://edited', sha256: 'a'.repeat(64), byteSize: 128 }, resources: ['file://image'] };
  assert.deepEqual(sdk.MarkdownDocumentRecordSchema.parse(value), value);
  assert.equal(sdk.MarkdownDocumentRecordSchema.safeParse({ ...value, body: '# Never persist here' }).success, false);
  assert.equal(sdk.MarkdownDocumentRecordSchema.safeParse({ ...value, resources: ['https://storage.test/image'] }).success, false);
  assert.equal(sdk.MarkdownDocumentRecordSchema.safeParse({ ...value, resources: ['file://image', 'file://image'] }).success, false);
});

test('history restore is conditional and cannot replace document identity or inject content', () => {
  const input = { source, targetCommitId: 'version-1', expectedHeadCommitId: 'version-2', requestId: 'restore-1' };
  assert.deepEqual(sdk.MarkdownDocumentRestoreSchema.parse(input), input);
  assert.equal(sdk.MarkdownDocumentRestoreSchema.safeParse({ ...input, expectedHeadCommitId: '' }).success, false);
  assert.equal(sdk.MarkdownDocumentRestoreSchema.safeParse({ ...input, contentFileUri: 'file://arbitrary' }).success, false);
});

test('editor policy is bounded and exposes its byte budget to every consumer', () => {
  assert.equal(sdk.MARKDOWN_DOCUMENT_MAX_BYTES, 2 * 1024 * 1024);
  const policy = { autoSave: true, idleMs: 2000, maxWaitMs: 10000 };
  assert.deepEqual(sdk.MarkdownDocumentPolicySchema.parse(policy), policy);
  assert.equal(sdk.MarkdownDocumentPolicySchema.safeParse({ ...policy, idleMs: 0 }).success, false);
  assert.equal(sdk.MarkdownDocumentPolicySchema.safeParse({ ...policy, maxWaitMs: 1000 }).success, false);
});
