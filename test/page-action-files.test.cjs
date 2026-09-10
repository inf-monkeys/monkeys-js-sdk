const { test } = require('node:test');
const assert = require('node:assert/strict');
const { ActionBindingSchema, PageSchema } = require('../lib/contracts/declarative-control.js');
const { page, revision } = require('./declarative-control-fixtures.cjs');
const fileAction = () => ({ ...page.actionBindings[0], fileInputs: [{ inputId: 'config', source: { kind: 'intent-field', path: 'handleId' }, maxBytes: 1048576, accept: '.json' }], inputMapping: { content: { kind: 'file-field', fileInputId: 'config', path: 'content' } }, sensitiveInputPaths: ['/content'] });
test('file bytes require declared inputs and sensitive command mapping', () => {
  const value = fileAction();
  assert.equal(ActionBindingSchema.safeParse(value).success, true);
  assert.equal(ActionBindingSchema.safeParse({ ...value, sensitiveInputPaths: [] }).success, false);
  assert.equal(ActionBindingSchema.safeParse({ ...value, fileInputs: undefined }).success, false);
  assert.equal(ActionBindingSchema.safeParse({ ...value, fileInputs: [...value.fileInputs, ...value.fileInputs] }).success, false);
  assert.equal(ActionBindingSchema.safeParse({ ...value, fileInputs: [{ ...value.fileInputs[0], maxBytes: 1048577 }] }).success, false);
});
test('managed uploads carry canonical references without inline binary content', () => {
  const value = fileAction();
  value.fileInputs[0] = { ...value.fileInputs[0], maxBytes: 5368709120, upload: { purpose: 'workflow-import' } };
  value.inputMapping = { uri: { kind: 'file-field', fileInputId: 'config', path: 'canonicalUri' } };
  value.sensitiveInputPaths = [];
  assert.equal(ActionBindingSchema.safeParse(value).success, true);
  assert.equal(ActionBindingSchema.safeParse({ ...value, inputMapping: { content: { kind: 'file-field', fileInputId: 'config', path: 'content' } } }).success, false);
  assert.equal(ActionBindingSchema.safeParse({ ...value, fileInputs: [{ ...value.fileInputs[0], upload: undefined }] }).success, false);
});
test('file handles cannot be persisted or read from undeclared Page state', () => {
  const action = fileAction();
  action.fileInputs[0].source = { kind: 'page-state', stateId: 'file-handle' };
  const state = { stateId: 'file-handle', schemaRevisionRef: revision('schema', 'file-handle'), defaultValue: '', persistence: 'none' };
  const value = { ...page, actionBindings: [action], stateDefinitions: [state] };
  assert.equal(PageSchema.safeParse(value).success, true);
  assert.equal(PageSchema.safeParse({ ...value, stateDefinitions: [] }).success, false);
  assert.equal(PageSchema.safeParse({ ...value, stateDefinitions: [{ ...state, persistence: 'session' }] }).success, false);
});
test('Action conditions are explicit and reject unavailable query/model context', () => {
  const value = page.actionBindings[0];
  assert.equal(ActionBindingSchema.safeParse({ ...value, when: { kind: 'literal', value: false } }).success, true);
  assert.equal(ActionBindingSchema.safeParse({ ...value, when: { kind: 'read', root: 'model', path: ['enabled'] } }).success, false);
});
