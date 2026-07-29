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
  assert.equal(schemas.canonicalContractSchemas['agent-session-command'], contracts.AgentSessionCommandSchema);
  assert.equal(schemas.canonicalContractSchemas['agent-session-command-result'], contracts.AgentSessionCommandResultSchema);
  assert.equal(schemas.canonicalContractSchemas['agent-session-event'], contracts.AgentSessionEventSchema);
  assert.equal(schemas.canonicalContractSchemas['agent-session-view-model'], contracts.AgentSessionViewModelSchema);
});

test('validates idempotent Agent session commands and results', () => {
  const fixture = readFixture('agent-session-commands.json');
  fixture.commands.forEach((command) => {
    assert.deepEqual(contracts.AgentSessionCommandSchema.parse(command), command);
  });
  fixture.results.forEach((result) => {
    assert.deepEqual(contracts.AgentSessionCommandResultSchema.parse(result), result);
  });
});

test('fails closed for unknown commands, payload fields, and inconsistent results', () => {
  const fixture = readFixture('agent-session-commands.json');
  const command = fixture.commands[0];
  assert.equal(contracts.AgentSessionCommandSchema.safeParse({ ...command, commandType: 'regenerate' }).success, false);
  assert.equal(
    contracts.AgentSessionCommandSchema.safeParse({
      ...command,
      payload: { ...command.payload, providerRuntime: 'codex' },
    }).success,
    false,
  );
  assert.equal(
    contracts.AgentSessionCommandResultSchema.safeParse({
      ...fixture.results[0],
      outcome: 'accepted',
      error: { code: 'COMMAND_EXECUTION_FAILED', message: 'Unexpected error.', retryable: true },
    }).success,
    false,
  );
  assert.equal(
    contracts.AgentSessionCommandResultSchema.safeParse({
      ...fixture.results[1],
      outcome: 'rejected',
      error: undefined,
    }).success,
    false,
  );
});

test('defines deterministic command state transitions', () => {
  assert.equal(contracts.resolveAgentSessionCommandTransition('running', 'stop'), 'stopping');
  assert.equal(contracts.resolveAgentSessionCommandTransition('stopped', 'resume'), 'queued');
  assert.equal(contracts.resolveAgentSessionCommandTransition('failed', 'retry'), 'queued');
  assert.equal(contracts.resolveAgentSessionCommandTransition('waiting_approval', 'approval'), 'running');
  assert.equal(contracts.resolveAgentSessionCommandTransition('completed', 'stop'), undefined);
  assert.equal(contracts.resolveAgentSessionCommandTransition('running', 'retry'), undefined);
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
