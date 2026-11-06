'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const {
  AgentDataOriginSchema,
  AgentDataSelectionSchema,
  AgentDataReceiptSchema,
  AgentLinkedDataItemSchema,
} = require('../lib/contracts');

const origin = {
  version: 1,
  tenantId: 'tenant',
  teamId: 'team',
  threadId: 'thread',
  userId: 'human',
  actorId: 'human',
  runId: 'run',
  messageId: 'message',
};
const source = { teamId: 'resources', ontologyId: 'products', viewId: 'catalog' };
const query = {
  kind: 'query',
  operation: 'data.asset.search',
  source,
  parameters: { expression: { op: 'or', filters: [{ op: 'field', field: 'name', cmp: 'eq', value: 'A' }] } },
};
const receipt = () => ({
  contract: 'AgentDataReceipt',
  version: 1,
  operationId: 'operation',
  origin,
  selection: query,
  kind: 'query',
  status: 'completed',
  occurredAt: '2026-11-06T01:00:00Z',
  result: { returned: 0 },
});

test('origin separates the conversation owner from a delegated execution principal', () => {
  const parsed = AgentDataOriginSchema.parse({ ...origin, actorId: 'team-agent' });
  assert.equal(parsed.userId, 'human');
  assert.equal(parsed.actorId, 'team-agent');
  assert.equal(AgentDataOriginSchema.safeParse({ ...origin, threadId: '' }).success, false);
  assert.equal(AgentDataOriginSchema.safeParse({ ...origin, accessToken: 'secret' }).success, false);
});

test('query selection preserves the owning query language and resource scope', () => {
  const parsed = AgentDataSelectionSchema.parse(query);
  assert.deepEqual(parsed, query);
  assert.equal(AgentDataSelectionSchema.safeParse({ ...query, operation: 'http://external/query' }).success, false);
  assert.equal(AgentDataSelectionSchema.safeParse({ ...query, parameters: { pageToken: 'cursor' } }).success, false);
  assert.equal(AgentDataSelectionSchema.safeParse({ ...query, parameters: { authorization: 'secret' } }).success, false);
});

test('generated results retain canonical identities and use bounded member pages', () => {
  const target = { kind: 'file', id: 'file-1', teamId: 'team', version: 2 };
  const selection = { kind: 'results', resultSetId: 'generation', members: [target], complete: true };
  assert.deepEqual(AgentDataSelectionSchema.parse(selection), selection);
  assert.equal(AgentDataSelectionSchema.safeParse({ ...selection, members: Array(501).fill(target) }).success, false);
  assert.equal(AgentDataSelectionSchema.safeParse({ ...selection, members: [{ ...target, url: 'https://signed.example?token=s' }] }).success, false);
});

test('receipts carry operation outcome without treating materialization failure as generation failure', () => {
  const parsed = AgentDataReceiptSchema.parse(receipt());
  assert.equal(parsed.result.returned, 0);
  assert.equal(AgentDataReceiptSchema.safeParse({ ...receipt(), status: 'projection-failed' }).success, false);
  assert.equal(AgentDataReceiptSchema.safeParse({ ...receipt(), result: { returned: -1 } }).success, false);
  assert.equal(AgentDataReceiptSchema.safeParse({ ...receipt(), operationId: '' }).success, false);
});

test('list summaries cannot embed query payloads, result rows or access-bearing URLs', () => {
  const summary = { id: 'view', threadId: 'thread', operationId: 'operation', kind: 'query', status: 'completed', title: 'Products', occurredAt: receipt().occurredAt, returned: 10 };
  assert.equal(AgentLinkedDataItemSchema.safeParse(summary).success, true);
  for (const extra of [{ rows: [{ private: true }] }, { selection: query }, { url: 'https://signed.example' }]) {
    assert.equal(AgentLinkedDataItemSchema.safeParse({ ...summary, ...extra }).success, false);
  }
});
