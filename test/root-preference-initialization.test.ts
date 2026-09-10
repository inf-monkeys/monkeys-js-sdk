import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createRequire } from 'node:module';
import { PageSchema } from '../src/contracts/declarative-control';
const require = createRequire(import.meta.url);
const { page, revision } = require('./declarative-control-fixtures.cjs');
const preference = { stateId: 'ontologyId', schemaRevisionRef: revision('schema', 'ontology-id'), persistence: 'tenant-preference', defaultValue: '' };
const requested = { stateId: 'requestedOntologyId', schemaRevisionRef: preference.schemaRevisionRef, persistence: 'none', defaultValue: '', initialValue: { kind: 'read', root: 'state', path: ['ontologyId'] } };
test('root request initialization reads one independently hydrated preference without adding a live dependency', () => {
  assert.equal(PageSchema.safeParse({ ...page, stateDefinitions: [preference, requested] }).success, true);
});
test('root initialization rejects secrets, instance scope, chains, nested reads and persistent destinations', () => {
  for (const initialValue of [{ kind: 'read', root: 'intent', path: ['secret'] }, { kind: 'read', root: 'scope', path: ['item'] }, { kind: 'read', root: 'state', path: ['ontologyId', 'nested'] }, { kind: 'literal', value: '' }]) assert.equal(PageSchema.safeParse({ ...page, stateDefinitions: [preference, { ...requested, initialValue }] }).success, false);
  assert.equal(PageSchema.safeParse({ ...page, stateDefinitions: [{ ...preference, persistence: 'none' }, requested] }).success, false);
  assert.equal(PageSchema.safeParse({ ...page, stateDefinitions: [preference, { ...requested, persistence: 'session' }] }).success, false);
  assert.equal(PageSchema.safeParse({ ...page, stateDefinitions: [preference, requested, { ...requested, stateId: 'chain', initialValue: { kind: 'read', root: 'state', path: ['requestedOntologyId'] } }] }).success, false);
});
