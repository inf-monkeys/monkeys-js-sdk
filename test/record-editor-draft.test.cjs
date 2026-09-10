const { test } = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');
const compiled = new Module(__filename, module); compiled.paths = module.paths;
compiled._compile(require('esbuild').buildSync({ entryPoints: [require('node:path').resolve(__dirname, '../src/runtime/record-editor-draft.ts')], bundle: true, packages: 'external', platform: 'node', format: 'cjs', write: false }).outputFiles[0].text, __filename);
const { createRecordEditorDraft: create, applyRecordEditorDraft: apply, recordEditorDraftIsDirty: dirty, readRecordEditorPath: read, recordEditorArrayItems: items } = compiled.exports;
const value = { settings: { enabled: true }, rows: [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }] };
const path = ['rows', { itemId: 'a', idKey: 'id' }, 'name'];
test('nested drafts retain stable touched paths through reorder and reset explicitly', () => {
 const initial = create('r1', value);
 const edited = apply(initial, { kind: 'set', path, value: 'edited' });
 const reordered = apply(edited, { kind: 'move', path: ['rows'], idKey: 'id', itemId: 'b', beforeId: 'a' });
 assert.equal(read(reordered.value, path), 'edited'); assert.deepEqual(reordered.touched[0], path);
 assert.equal(dirty(initial), false); assert.equal(dirty(reordered), true); assert.equal(value.rows[0].name, 'A');
 const reset = apply(reordered, { kind: 'reset', revision: 'r2', value });
 assert.equal(dirty(reset), false); assert.deepEqual(reset.touched, []); assert.equal(reset.revision, 'r2');
});
test('arrays add/remove by ID and reject duplicate, absent and mutable identity', () => {
 let draft = create('r', value);
 draft = apply(draft, { kind: 'insert', path: ['rows'], idKey: 'id', value: { id: 'c', name: 'C' }, beforeId: 'b' });
 assert.deepEqual(draft.value.rows.map(x => x.id), ['a', 'c', 'b']);
 draft = apply(draft, { kind: 'remove', path: ['rows'], idKey: 'id', itemId: 'c' });
 assert.equal(dirty(draft), false);
 for (const bad of [[{ id: 'a' }, { id: 'a' }], [{}]]) assert.throws(() => items(bad, 'id'), /stable IDs/);
 assert.throws(() => apply(draft, { kind: 'set', path: ['rows', { itemId: 'a', idKey: 'id' }, 'id'], value: 'c' }), /stable ID/);
 assert.throws(() => apply(draft, { kind: 'remove', path: ['rows'], idKey: 'id', itemId: 'missing' }), /missing/);
 assert.throws(() => apply(draft, { kind: 'set', path: ['__proto__'], value: {} }));
 assert.throws(() => apply(draft, { kind: 'set', path: ['rows', '0'], value: {} }), /object/);
});
test('dirty comparison ignores object key order while tracking array order', () => {
 const draft = create('r', { a: 1, b: 2 });
 assert.equal(dirty(apply(draft, { kind: 'set', path: [], value: { b: 2, a: 1 } })), false);
});

test('Action validation snapshots exclude secret changes and accept only the formal error envelope', () => {
 const { captureRecordEditorSubmission: capture, projectRecordEditorValidation: project } = compiled.exports;
 const payload = { draftRevision: 'r7', values: { name: 'Submitted' }, secretChanges: [{ path: ['token'], mode: 'replace', value: 'transient-only' }] };
 const snapshot = capture(payload);
 payload.values.name = 'Later';
 assert.deepEqual(snapshot, { revision: 'r7', value: { name: 'Submitted' } });
 const details = { contract: 'RecordEditorValidation', schemaVersion: 1, errors: [{ path: ['name'], code: 'name.invalid' }, { path: [], code: 'record.conflict' }] };
 assert.deepEqual(project(details, snapshot), { ...snapshot, errors: details.errors });
 assert.equal(JSON.stringify(project(details, snapshot)).includes('transient-only'), false);
 for (const invalid of [{ ...details, values: payload.values }, { ...details, secretChanges: payload.secretChanges }, { ...details, schemaVersion: 2 }, { ...details, errors: [{ path: ['__proto__'], code: 'invalid' }] }, [], undefined]) assert.equal(project(invalid, snapshot), undefined);
 assert.equal(project(details, undefined), undefined);
 assert.equal(capture({ values: {} }), undefined);
});
