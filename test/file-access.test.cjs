const { test } = require('node:test');
const assert = require('node:assert/strict');
const contracts = require('../lib/contracts');
const runtime = require('../lib/runtime');

test('managed references preserve identity and named variants without accepting paths', () => {
  assert.deepEqual(runtime.parseManagedFileReference('file://abc-123#thumbnail-512'), { fileId: 'abc-123', variant: 'thumbnail-512' });
  for (const uri of ['file:///etc/passwd', 'file://../secret', 'file://id?token=secret', 'https://host/file'])
    assert.equal(runtime.parseManagedFileReference(uri), undefined);
});

test('read instructions retain provider headers and expiry independently of the durable reference', () => {
  const access = contracts.FileReadInstructionSchema.parse({
    mode: 'direct', url: 'https://storage.test/file?sig=temporary', method: 'GET',
    headers: { 'x-ms-version': '2023-11-03' }, expiresAt: '2026-11-06T12:00:00Z',
  });
  assert.equal(access.headers['x-ms-version'], '2023-11-03');
  assert.throws(() => contracts.FileReadInstructionSchema.parse({ ...access, method: 'PUT' }));
  assert.throws(() => contracts.FileReadInstructionSchema.parse({ ...access, url: 'file:///etc/passwd' }));
  assert.throws(() => contracts.FileReadInstructionSchema.parse({ ...access, headers: { token: 'a\r\nb' } }));
  assert.throws(() => contracts.FileReadInstructionSchema.parse({ ...access, mode: 'proxy' }));
});

test('resource manifests map safe relative paths to immutable file references', () => {
  assert.equal(contracts.FileResourceManifestSchema.parse({ version: 1, resources: [{ path: 'images/cover.webp', uri: 'file://cover' }] }).resources.length, 1);
  for (const path of ['../image.png', '/image.png', 'images/../image.png', 'https://host/image'])
    assert.throws(() => contracts.FileResourceManifestSchema.parse({ version: 1, resources: [{ path, uri: 'file://cover' }] }));
  assert.throws(() => contracts.FileResourceManifestSchema.parse({ version: 1, resources: [{ path: 'a', uri: 'file://one' }, { path: 'a', uri: 'file://two' }] }));
});

test('instruction negotiation is explicit and legacy resolution remains parseable', () => {
  assert.equal(contracts.FileResolveBatchRequestSchema.parse({ references: [{ uri: 'file://one' }] }).includeAccessInstructions, false);
  assert.equal(contracts.FileResolveBatchRequestSchema.parse({ references: [{ uri: 'file://one' }], includeAccessInstructions: true }).includeAccessInstructions, true);
  contracts.FileResolveBatchResponseSchema.parse({ items: [{ fileId: 'one', originalUri: 'https://host/one' }] });
  const upload = contracts.FileUploadCreateRequestSchema.parse({ purpose: 'agent-artifacts', filename: 'report.md', mimeType: 'text/markdown', requestId: 'turn-file-one' });
  assert.equal(upload.requestId, 'turn-file-one');
});

test('relative resource resolution follows the declared entry path and cannot leave the package', () => {
  const manifest = contracts.FileResourceManifestSchema.parse({ version: 1, entryPath: 'pages/report.html', resources: [{ path: 'images/cover.png', uri: 'file://cover' }] });
  assert.equal(runtime.resolveFileResourceReference('../images/cover.png?v=1', manifest), 'file://cover');
  assert.equal(runtime.resolveFileResourceReference('../../images/cover.png', manifest), undefined);
  assert.equal(runtime.resolveFileResourceReference('%2fimages/cover.png', manifest), undefined);
  assert.equal(runtime.resolveFileResourceReference('https://other.test/images/cover.png', manifest), undefined);
});

test('reference collection ignores workspace paths while retaining nested message and artifact identities', () => {
  const value = { parts: [{ text: '![image](file://image-1) and [archive](file://archive-1)' }, { url: 'file://image-2#thumbnail-512' }, { command: 'read file://inputs/source.png' }] };
  assert.deepEqual(runtime.collectManagedFileReferences(value), ['file://archive-1', 'file://image-1', 'file://image-2#thumbnail-512']);
});
