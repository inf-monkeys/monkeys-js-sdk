'use strict';

const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const test = require('node:test');

const contracts = require('../lib/contracts');
const schemas = require('../lib/schemas');

const readFixture = (name) => JSON.parse(readFileSync(resolve(__dirname, 'fixtures', name), 'utf8'));

for (const name of ['agent-session-chatbot.json', 'agent-session-agent.json', 'agent-session-kernel.json']) {
  test(`validates ${name}`, () => {
    const fixture = readFixture(name);
    assert.deepEqual(contracts.AgentSessionViewModelSchema.parse(fixture), fixture);
  });
}

test('publishes Agent session contracts in the canonical schema registry', () => {
  assert.equal(schemas.canonicalContractSchemas['agent-session-event'], contracts.AgentSessionEventSchema);
  assert.equal(schemas.canonicalContractSchemas['agent-session-view-model'], contracts.AgentSessionViewModelSchema);
});

test('carries canonical session events through the durable runtime envelope', () => {
  const sessionEvent = readFixture('agent-session-agent.json').events[0];
  const envelope = {
    contract: 'AgentRuntimeEvent',
    runtimeEventId: 'runtime-event-1',
    streamId: 'agent-session-1:request-1',
    sequence: 0,
    requestId: 'request-1',
    teamId: 'team-1',
    threadId: 'agent-session-1',
    eventType: 'session:event',
    payload: { event: sessionEvent },
    occurredAt: sessionEvent.occurredAt,
  };
  assert.deepEqual(contracts.AgentRuntimeEventSchema.parse(envelope), envelope);
});

test('fails closed for unknown event types and unknown payload fields', () => {
  const fixture = readFixture('agent-session-agent.json').events[0];
  assert.equal(contracts.AgentSessionEventSchema.safeParse({ ...fixture, eventType: 'provider-secret-event' }).success, false);
  assert.equal(
    contracts.AgentSessionEventSchema.safeParse({
      ...fixture,
      payload: { ...fixture.payload, providerRuntime: 'codex' },
    }).success,
    false,
  );
});

test('requires ordered events, a matching session, and the declared last sequence', () => {
  const fixture = readFixture('agent-session-agent.json');
  assert.equal(
    contracts.AgentSessionViewModelSchema.safeParse({ ...fixture, events: [...fixture.events].reverse() }).success,
    false,
  );
  assert.equal(
    contracts.AgentSessionViewModelSchema.safeParse({
      ...fixture,
      events: fixture.events.map((event, index) => (index === 1 ? { ...event, sessionId: 'other-session' } : event)),
    }).success,
    false,
  );
  assert.equal(contracts.AgentSessionViewModelSchema.safeParse({ ...fixture, lastSequence: 99 }).success, false);
});

test('normalizes legacy provider values only at the product boundary', () => {
  assert.equal(contracts.normalizeAgentMode('codex'), 'agent');
  assert.equal(contracts.normalizeAgentMode('vercel-ai'), 'chatbot');
  assert.equal(contracts.normalizeAgentMode('unknown'), undefined);
});
