'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { AgentWorkDispatchSchema, AGENT_WORK_CONTRACT_VERSION } = require('../lib/contracts');
const { CODEX_APP_SERVER_CLI_VERSION } = require('../lib/codex-app-server');

const sha = 'a'.repeat(64);
const dispatch = () => ({
  contractVersion: AGENT_WORK_CONTRACT_VERSION,
  session: {
    sessionId: 's1',
    teamId: 't1',
    epoch: 1,
    token: 'run-capability',
    modelKey: 'upstream-key',
    skills: [{ id: 'k1', name: 'brand-voice', description: 'Brand voice', sha256: sha }],
  },
  command: {
    sessionId: 's1',
    teamId: 't1',
    epoch: 1,
    commandId: 'r1',
    runId: 'r1',
    sourceMessageId: 'm1',
    initialSessionSequence: 0,
    input: [{ type: 'text', text: 'hi', text_elements: [] }],
    model: 'gpt-5',
    developerInstructions: '',
    approvalPolicy: 'never',
    sandbox: 'workspace-write',
    config: { model_providers: { platform: { base_url: 'https://upstream.example/v1' } } },
    configRevision: 'rev',
  },
});

test('Work dispatch carries one model key and Skill references, never Skill files', () => {
  const parsed = AgentWorkDispatchSchema.parse(dispatch());
  assert.equal(parsed.session.modelKey, 'upstream-key');
  assert.deepEqual(parsed.session.skills[0].requiredMcpServers, []);
  assert.equal(parsed.session.skills[0].files, undefined);
});

test('Work dispatch rejects a missing model key, an unknown contract and an unsafe Skill name', () => {
  const noKey = dispatch();
  delete noKey.session.modelKey;
  assert.equal(AgentWorkDispatchSchema.safeParse(noKey).success, false);
  assert.equal(AgentWorkDispatchSchema.safeParse({ ...dispatch(), contractVersion: 'agent-work/0' }).success, false);
  const unsafe = dispatch();
  unsafe.session.skills[0].name = '../escape';
  assert.equal(AgentWorkDispatchSchema.safeParse(unsafe).success, false);
});

test('Codex protocol subpath pins the Worker CLI version', () => {
  assert.equal(CODEX_APP_SERVER_CLI_VERSION, require('../package.json').codexAppServerCliVersion);
});
