const test = require('node:test');
const assert = require('node:assert/strict');
const sdk = require('../lib');

test('publication scope keeps global ownership separate from business teams', () => {
  assert.deepEqual(sdk.DeclarativePublicationScopeSchema.parse({ kind: 'global' }), { kind: 'global' });
  assert.deepEqual(sdk.DeclarativePublicationScopeSchema.parse({ kind: 'team', teamId: 'team-a' }), { kind: 'team', teamId: 'team-a' });
  for (const value of [{ kind: 'team', teamId: '0' }, { kind: 'team' }, { kind: 'global', teamId: 'team-a' }]) {
    assert.equal(sdk.DeclarativePublicationScopeSchema.safeParse(value).success, false);
  }
});

test('verification cannot label an unknown or superseded publication verified', () => {
  const base = {
    contract: 'DeclarativePublicationVerification', schemaVersion: 1,
    resourceKind: 'page', resourceId: 'example.page', scope: { kind: 'global' },
    publication: 'unknown', activation: 'unavailable', integrity: 'unverified',
    runtime: 'not-requested', diagnostics: [],
  };
  assert.equal(sdk.DeclarativePublicationVerificationSchema.safeParse(base).success, true);
  assert.equal(sdk.DeclarativePublicationVerificationSchema.safeParse({ ...base, integrity: 'verified' }).success, false);
  assert.equal(sdk.DeclarativePublicationVerificationSchema.safeParse({ ...base, runtime: 'verified' }).success, false);
});

test('verification addresses a resource without publishing or inventing a route', () => {
  const input = { resourceKind: 'page', resourceId: 'example.page', releaseSlotId: 'page.slot' };
  assert.deepEqual(sdk.DeclarativePublicationVerificationRequestSchema.parse(input), input);
  assert.equal(sdk.declarativeControlRoutes.publicationVerify(), '/api/declarative-control/authoring/publications/verify');
  assert.equal(sdk.DeclarativePublicationVerificationRequestSchema.safeParse({ ...input, audience: { path: '/page/:id' } }).success, true);
});
