'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const contracts = require('../lib/contracts');

const at = '2026-07-16T00:00:00.000Z';
const ref = (kind, id, version) => ({ kind, id, ...(version === undefined ? {} : { version }) });

test('data continuity envelope requires stable scope, request, actor and at least one ref', () => {
  const parsed = contracts.DataContinuityEnvelopeSchema.parse({
    contract: 'DataContinuityEnvelope',
    tenantId: 'tenant-1',
    teamId: 'team-1',
    runRef: ref('application-run', 'run-1', 2),
    requestId: 'request-1',
    actorRef: ref('service', 'monkeys-server'),
    schemaVersion: 1,
  });
  assert.equal(parsed.runRef.id, 'run-1');
  assert.throws(() => contracts.DataContinuityEnvelopeSchema.parse({ ...parsed, runRef: undefined }));
});

test('workflow relation and expiring run contracts are strict and version-aware', () => {
  assert.equal(contracts.BodyRelationRecordSchema.parse({
    contract: 'BodyRelationRecord', relationId: 'relation-1', relationKind: 'workflow.to-workflow',
    subjectRef: ref('workflow-definition', 'workflow-1', 3), objectRef: ref('workflow-definition', 'workflow-2', 5),
    ownerRepo: 'monkeys-server', authorityScope: 'team', properties: {}, createdAt: at, updatedAt: at,
  }).relationId, 'relation-1');
  assert.equal(contracts.ApplicationRunSchema.parse({
    contract: 'ApplicationRun', runId: 'run-1', definitionRef: ref('workflow-definition', 'workflow-1', 3),
    runtimeLedgerRef: ref('workflow-run', 'application-run-1'), requestId: 'request-1',
    actorRef: ref('human', 'user-1'), status: 'COMPLETED', inputRefs: [], outputRefs: [], metadata: {},
  }).status, 'COMPLETED');
  assert.equal(contracts.ExpiringAccessGrantSchema.parse({
    contract: 'ExpiringAccessGrant', grantId: 'grant-1', subjectRef: ref('human', 'user-1'),
    resourceRef: ref('application-run', 'run-1'), permissions: ['execute', 'read'], issuedAt: at,
    expiresAt: '2026-07-17T00:00:00.000Z',
  }).permissions.length, 2);
});
