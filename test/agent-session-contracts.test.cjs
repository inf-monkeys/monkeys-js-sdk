'use strict';

const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const test = require('node:test');

const contracts = require('../lib/contracts');
const schemas = require('../lib/schemas');
const runtime = require('../lib/runtime');

const readFixture = (name) => JSON.parse(readFileSync(resolve(__dirname, 'fixtures', name), 'utf8'));

for (const name of ['agent-session-chat.json', 'agent-session-work.json', 'agent-session-kernel.json']) {
  test(`validates ${name}`, () => {
    const fixture = readFixture(name);
    assert.deepEqual(contracts.AgentSessionViewModelSchema.parse(fixture), fixture);
  });
}

test('validates the canonical Agent session lifecycle scenario set', () => {
  const scenarios = readFixture('agent-session-scenarios.json');
  assert.deepEqual(Object.keys(scenarios), [
    'streamInterrupted',
    'approvalWaiting',
    'toolFailed',
    'resumed',
    'artifactCompleted',
    'contextCompacted',
  ]);

  const parsed = Object.fromEntries(
    Object.entries(scenarios).map(([name, scenario]) => [
      name,
      contracts.AgentSessionViewModelSchema.parse(scenario),
    ]),
  );
  const eventTypes = (name) => parsed[name].events.map((event) => event.eventType);
  const statuses = (name) =>
    parsed[name].events
      .filter((event) => event.eventType === 'status')
      .map((event) => event.payload.status);

  assert.equal(parsed.streamInterrupted.status, 'stopped');
  assert.equal(parsed.streamInterrupted.resumable, true);
  assert.equal(parsed.streamInterrupted.events.some((event) => event.eventType === 'message' && event.payload.status === 'streaming'), true);

  assert.equal(parsed.approvalWaiting.status, 'waiting_approval');
  assert.equal(parsed.approvalWaiting.events.some((event) => event.eventType === 'approval' && event.payload.status === 'requested'), true);

  assert.equal(parsed.toolFailed.status, 'failed');
  assert.equal(parsed.toolFailed.events.some((event) => event.eventType === 'tool' && event.payload.status === 'failed'), true);
  assert.equal(parsed.toolFailed.events.some((event) => event.eventType === 'error'), true);

  assert.deepEqual(statuses('resumed'), ['stopped', 'queued', 'running', 'completed']);
  assert.equal(parsed.resumed.status, 'completed');

  const artifactEvents = parsed.artifactCompleted.events.filter((event) => event.eventType === 'artifact');
  assert.deepEqual(artifactEvents.map((event) => event.payload.status), ['pending', 'ready']);
  assert.equal(artifactEvents[0].payload.artifactId, artifactEvents[1].payload.artifactId);
  assert.equal(artifactEvents[1].payload.url, 'https://example.test/output.png');

  assert.deepEqual(eventTypes('contextCompacted'), ['message', 'usage', 'status']);
  assert.equal(parsed.contextCompacted.events[0].payload.parts[0].metadata.debugContext.contextUsage.compressed, true);
});

test('publishes Agent session contracts in the canonical schema registry', () => {
  assert.equal(schemas.canonicalContractSchemas['agent-session-command'], contracts.AgentSessionCommandSchema);
  assert.equal(schemas.canonicalContractSchemas['agent-session-command-result'], contracts.AgentSessionCommandResultSchema);
  assert.equal(
    schemas.canonicalContractSchemas['agent-session-continuation-request'],
    contracts.AgentSessionContinuationRequestSchema,
  );
  assert.equal(
    schemas.canonicalContractSchemas['agent-session-continuation-result'],
    contracts.AgentSessionContinuationResultSchema,
  );
  assert.equal(schemas.canonicalContractSchemas['agent-session-event'], contracts.AgentSessionEventSchema);
  assert.equal(schemas.canonicalContractSchemas['agent-session-view-model'], contracts.AgentSessionViewModelSchema);
  assert.equal(schemas.canonicalContractSchemas['agent-session-run'], contracts.AgentSessionRunSchema);
  assert.equal(
    schemas.canonicalContractSchemas['agent-session-targeted-command'],
    contracts.AgentSessionTargetedCommandSchema,
  );
  assert.equal(schemas.canonicalContractSchemas['agent-session-run-event'], contracts.AgentSessionRunEventSchema);
  assert.equal(
    schemas.canonicalContractSchemas['agent-workbench-composer-view-model'],
    contracts.AgentWorkbenchComposerViewModelSchema,
  );
  assert.equal(
    schemas.canonicalContractSchemas['agent-workbench-navigation-view-model'],
    contracts.AgentWorkbenchNavigationViewModelSchema,
  );
  assert.equal(
    schemas.canonicalContractSchemas['agent-workbench-quick-start-view-model'],
    contracts.AgentWorkbenchQuickStartViewModelSchema,
  );
});

test('validates the controlled Agent workbench composer view model', () => {
  const composer = {
    contract: 'AgentWorkbenchComposerViewModel',
    value: 'Review the current changes',
    status: 'streaming',
    mode: 'work',
    placeholder: 'Ask anything',
    attachments: [{
      id: 'attachment-1',
      name: 'screenshot.png',
      mediaType: 'image/png',
      previewUrl: 'https://example.test/screenshot.png',
      status: 'ready',
    }],
    queuedDrafts: [{
      id: 'draft-1',
      text: 'Run the focused tests',
      attachmentCount: 0,
      status: 'queued',
    }],
    inputActions: [],
    model: {
      selectedId: 'gpt-5.5',
      options: [{
        id: 'gpt-5.5',
        label: 'GPT 5.5',
        provider: 'OpenAI',
        mode: 'work',
        disabled: false,
      }],
    },
    reasoning: {
      value: 'high',
      options: ['low', 'medium', 'high', 'xhigh'],
    },
    permissionProfile: 'full-access',
    webSearchEnabled: true,
    capabilities: {
      attachments: true,
      voiceInput: true,
      webSearch: true,
      modelSelection: true,
      reasoning: true,
      permissions: true,
      queue: true,
      stop: true,
    },
  };

  assert.deepEqual(contracts.AgentWorkbenchComposerViewModelSchema.parse(composer), composer);
  assert.equal(
    contracts.AgentWorkbenchComposerViewModelSchema.safeParse({
      ...composer,
      model: { ...composer.model, selectedId: 'missing-model' },
    }).success,
    false,
  );
});

test('validates the Agent workbench quick start view model', () => {
  const quickStart = {
    contract: 'AgentWorkbenchQuickStartViewModel',
    mode: 'chat',
    categories: [{
      id: 'design',
      label: 'Design',
      icon: 'palette',
      sections: [{
        id: 'quick-start',
        label: 'Quick start',
        templates: [{
          id: 'collection-plan',
          title: 'Collection plan',
          prompt: 'Create a seasonal collection plan.',
          action: 'prompt',
          accept: '*/*',
          multiple: false,
          modes: ['chat', 'work'],
        }],
      }],
    }],
    disabled: false,
  };

  assert.deepEqual(contracts.AgentWorkbenchQuickStartViewModelSchema.parse(quickStart), quickStart);
  assert.equal(
    contracts.AgentWorkbenchQuickStartViewModelSchema.safeParse({
      ...quickStart,
      categories: [{ ...quickStart.categories[0], sections: [] }],
    }).success,
    false,
  );
});

test('validates and resolves the Agent workbench sidebar configuration', () => {
  const sidebar = {
    navigationMode: 'trend',
    defaultOpen: false,
    widthPercent: 22,
    visibleSections: ['header', 'search', 'new-session', 'sessions', 'groups', 'footer'],
    groups: [{
      id: 'scene',
      label: 'By scene',
      items: [{
        id: 'outdoor',
        title: 'Outdoor',
        subtitle: 'Technical protection',
        imageUrl: 'https://example.test/outdoor.webp',
        prompt: 'Analyse the outdoor apparel trend.',
        mediaVariant: 'cover-with-label',
      }],
    }],
    defaultGroupId: 'scene',
    quickStartEnabled: true,
    quickStartCategories: [{
      id: 'design',
      label: 'Design',
      sections: [{
        id: 'quick-start',
        label: 'Quick start',
        templates: [{
          id: 'collection-plan',
          title: 'Collection plan',
          prompt: 'Create a seasonal collection plan.',
          action: 'prompt',
          accept: '*/*',
          multiple: false,
        }],
      }],
    }],
    trendEntryEnabled: true,
  };

  assert.deepEqual(contracts.AgentWorkbenchSidebarConfigSchema.parse(sidebar), sidebar);
  const staticReportSidebar = {
    ...sidebar,
    navigationMode: 'trend',
    groups: sidebar.groups.map((group) => ({
      ...group,
      items: group.items.map(({ prompt: _prompt, ...item }) => item),
    })),
  };
  assert.deepEqual(contracts.AgentWorkbenchSidebarConfigSchema.parse(staticReportSidebar), staticReportSidebar);
  assert.deepEqual(contracts.resolveAgentWorkbenchSidebarConfig(undefined, {
    navigationMode: 'session',
    quickStartEnabled: true,
  }), {
    navigationMode: 'session',
    defaultOpen: true,
    widthPercent: 18,
    visibleSections: [...contracts.DEFAULT_AGENT_WORKBENCH_SIDEBAR_SECTIONS],
    groups: [],
    quickStartEnabled: true,
    trendEntryEnabled: false,
  });
  assert.equal(
    contracts.AgentWorkbenchSidebarConfigSchema.safeParse({
      ...sidebar,
      defaultGroupId: 'missing',
    }).success,
    false,
  );
  assert.equal(
    contracts.AgentWorkbenchSidebarConfigSchema.safeParse({
      ...sidebar,
      visibleSections: ['search', 'search'],
    }).success,
    false,
  );
});

test('validates the controlled Agent workbench navigation view model', () => {
  const navigation = {
    contract: 'AgentWorkbenchNavigationViewModel',
    activeTab: 'sessions',
    searchQuery: '',
    selectedAgentItem: 'agent-1',
    selectedSessionItem: 'session-1',
    agents: {
      status: 'ready',
      items: [
        {
          id: 'agent-1',
          name: 'Research Agent',
          description: 'Finds and summarizes sources',
          builtIn: false,
          pinned: true,
          pinPending: false,
        },
      ],
    },
    sessions: {
      status: 'ready',
      items: [
        {
          id: 'session-1',
          title: 'Launch research',
          updatedAt: '2026-08-02T08:00:00.000Z',
          mode: 'work',
          status: 'running',
          pinned: false,
          contextUsage: { usedTokens: 1024, maxTokens: 8192 },
        },
      ],
    },
    capabilities: {
      createAgent: true,
      createSession: true,
      manageCapabilities: true,
      manageAgentSettings: true,
      pinAgents: true,
      pinSessions: true,
      renameSessions: true,
      deleteSessions: true,
    },
  };

  assert.deepEqual(contracts.AgentWorkbenchNavigationViewModelSchema.parse(navigation), navigation);
  assert.equal(
    contracts.AgentWorkbenchNavigationViewModelSchema.safeParse({
      ...navigation,
      sessions: {
        ...navigation.sessions,
        items: navigation.sessions.items.map((item) => ({ ...item, mode: 'unsupported' })),
      },
    }).success,
    false,
  );
  assert.equal(
    contracts.AgentWorkbenchNavigationViewModelSchema.safeParse({
      ...navigation,
      sessions: { status: 'error', items: [] },
    }).success,
    false,
  );
});

test('defines idempotent continuation requests and bounded inherited context', () => {
  const request = {
    contract: 'AgentSessionContinuationRequest',
    idempotencyKey: 'continuation-request-1',
    sourceMessageId: 'message-source',
    sourceRunId: 'run-source',
    inheritance,
  };
  const lineage = {
    forkedFromThreadId: 'thread-source',
    forkedFromMessageId: 'message-source',
    sourceRunId: 'run-source',
  };
  const result = {
    contract: 'AgentSessionContinuationResult',
    idempotencyKey: request.idempotencyKey,
    threadId: 'thread-created',
    lineage,
    inheritance,
    unavailableResources: [],
    duplicate: false,
    createdAt: '2026-08-01T00:00:01.000Z',
  };
  const inheritedContext = {
    sourceThreadId: lineage.forkedFromThreadId,
    sourceMessageId: lineage.forkedFromMessageId,
    sourceRunId: lineage.sourceRunId,
    messages: [{ messageId: 'message-source', role: 'user', parts: [{ type: 'text', text: 'Source task' }] }],
    summary: 'The source task reached a stable result.',
    unavailableResources: [],
    capturedAt: result.createdAt,
  };

  assert.deepEqual(contracts.AgentSessionContinuationRequestSchema.parse(request), request);
  assert.deepEqual(contracts.AgentSessionContinuationResultSchema.parse(result), result);
  assert.deepEqual(contracts.AgentSessionInheritedContextSchema.parse(inheritedContext), inheritedContext);
  assert.equal(
    contracts.AgentSessionInheritedContextSchema.safeParse({
      ...inheritedContext,
      messages: Array.from({ length: 25 }, (_, index) => ({
        messageId: `message-${index}`,
        role: 'user',
        parts: [{ type: 'text', text: 'Too much context' }],
      })),
    }).success,
    false,
  );
});

const inheritance = {
  messages: 'through-source-message',
  attachments: 'inherit',
  summaries: 'inherit',
  toolResults: 'exclude',
  codeChanges: 'inherit',
};

const commandHeader = {
  contract: 'AgentSessionCommand',
  commandId: 'command-wp1',
  sessionId: 'session-wp1',
  idempotencyKey: 'session-wp1:command-wp1',
  expectedSequence: 12,
  issuedAt: '2026-08-01T00:00:00.000Z',
};

test('defines traceable fork, edit-and-rerun, and steering commands', () => {
  const fork = {
    ...commandHeader,
    commandType: 'fork',
    payload: {
      sourceThreadId: 'thread-source',
      sourceMessageId: 'message-source',
      sourceRunId: 'run-source',
      inheritance,
    },
  };
  const editAndRerun = {
    ...commandHeader,
    commandId: 'command-edit',
    idempotencyKey: 'session-wp1:command-edit',
    commandType: 'edit-and-rerun',
    payload: {
      sourceThreadId: 'thread-source',
      sourceMessageId: 'message-source',
      sourceRunId: 'run-source',
      replacementParts: [{ type: 'text', text: 'Use the corrected requirement.' }],
      inheritance,
    },
  };
  const steer = {
    ...commandHeader,
    commandId: 'command-steer',
    idempotencyKey: 'session-wp1:command-steer',
    runId: 'run-active',
    commandType: 'steer',
    payload: {
      targetRunId: 'run-active',
      text: 'Focus on the failing test.',
    },
  };

  for (const command of [fork, editAndRerun, steer]) {
    assert.deepEqual(contracts.AgentSessionCommandSchema.parse(command), command);
  }
  assert.equal(
    contracts.AgentSessionCommandSchema.safeParse({
      ...fork,
      payload: { ...fork.payload, sourceRunId: undefined },
    }).success,
    false,
  );
  assert.equal(
    contracts.AgentSessionCommandSchema.safeParse({
      ...steer,
      payload: { ...steer.payload, providerRuntime: 'codex' },
    }).success,
    false,
  );
  assert.equal(
    contracts.AgentSessionCommandSchema.safeParse({
      ...steer,
      runId: 'run-other',
    }).success,
    false,
  );
  assert.equal(
    contracts.AgentSessionCommandSchema.safeParse({
      ...steer,
      payload: { ...steer.payload, text: '   ' },
    }).success,
    false,
  );
});

test('defines lineage, active branch, and command result provenance', () => {
  const lineage = {
    forkedFromThreadId: 'thread-source',
    forkedFromMessageId: 'message-source',
    sourceRunId: 'run-source',
  };
  const activeBranch = {
    branchId: 'branch-created',
    threadId: 'thread-created',
    sourceMessageId: 'message-created',
    runId: 'run-created',
    lineage,
    createdAt: '2026-08-01T00:00:01.000Z',
  };
  const result = {
    contract: 'AgentSessionCommandResult',
    commandId: 'command-wp1',
    sessionId: 'session-wp1',
    runId: 'run-created',
    idempotencyKey: 'session-wp1:command-wp1',
    outcome: 'accepted',
    sessionStatus: 'queued',
    acceptedSequence: 13,
    resultEventIds: [],
    operation: { lineage, activeBranch },
    occurredAt: '2026-08-01T00:00:01.000Z',
  };

  assert.deepEqual(contracts.AgentSessionLineageSchema.parse(lineage), lineage);
  assert.deepEqual(contracts.AgentSessionActiveBranchSchema.parse(activeBranch), activeBranch);
  assert.deepEqual(contracts.AgentSessionCommandResultSchema.parse(result), result);
  assert.equal(
    contracts.AgentSessionCommandResultSchema.safeParse({
      ...result,
      runId: 'run-other',
    }).success,
    false,
  );
});

test('validates summary events and binds them to their source run', () => {
  const event = {
    contract: 'AgentSessionEvent',
    eventId: 'summary-event-1',
    sessionId: 'session-wp1',
    runId: 'run-source',
    sourceMessageId: 'message-source',
    sequence: 13,
    idempotencyKey: 'session-wp1:summary-1',
    occurredAt: '2026-08-01T00:00:01.000Z',
    eventType: 'summary',
    payload: {
      summaryId: 'summary-1',
      runId: 'run-source',
      text: 'Implemented the contract foundation.',
      highlights: ['Branching contracts added.'],
      pendingItems: ['Persist the contracts on the Server.'],
      status: 'completed',
    },
  };

  assert.deepEqual(contracts.AgentSessionEventSchema.parse(event), event);
  assert.equal(
    contracts.AgentSessionEventSchema.safeParse({
      ...event,
      payload: { ...event.payload, runId: 'run-other' },
    }).success,
    false,
  );
});

test('validates durable steering lifecycle events', () => {
  const event = {
    contract: 'AgentSessionEvent',
    eventId: 'steer-event-1',
    sessionId: 'session-wp1',
    runId: 'run-active',
    sourceMessageId: 'message-source',
    sequence: 13,
    idempotencyKey: 'session-wp1:steer-1:accepted',
    occurredAt: '2026-08-01T00:00:01.000Z',
    eventType: 'steer',
    payload: {
      commandId: 'command-steer',
      targetRunId: 'run-active',
      text: 'Focus on the failing test.',
      status: 'accepted',
    },
  };

  for (const status of ['accepted', 'applied']) {
    assert.equal(
      contracts.AgentSessionEventSchema.safeParse({
        ...event,
        payload: { ...event.payload, status },
      }).success,
      true,
    );
  }
  assert.equal(
    contracts.AgentSessionEventSchema.safeParse({
      ...event,
      payload: {
        ...event.payload,
        status: 'failed',
        error: { code: 'ACTIVE_RUN_NOT_FOUND', message: 'The target run is no longer active.', retryable: false },
      },
    }).success,
    true,
  );
  assert.equal(
    contracts.AgentSessionEventSchema.safeParse({
      ...event,
      payload: { ...event.payload, status: 'failed' },
    }).success,
    false,
  );
  assert.equal(
    contracts.AgentSessionEventSchema.safeParse({
      ...event,
      runId: 'run-other',
    }).success,
    false,
  );
});

test('publishes command policies without changing source sessions for branch operations', () => {
  assert.equal(contracts.canIssueAgentSessionCommand('completed', 'fork'), true);
  assert.equal(contracts.canIssueAgentSessionCommand('running', 'fork'), true);
  assert.equal(contracts.canIssueAgentSessionCommand('completed', 'edit-and-rerun'), true);
  assert.equal(contracts.canIssueAgentSessionCommand('running', 'edit-and-rerun'), false);
  assert.equal(contracts.canIssueAgentSessionCommand('running', 'steer'), true);
  assert.equal(contracts.canIssueAgentSessionCommand('completed', 'steer'), false);
  assert.equal(contracts.canIssueAgentSessionCommand('completed', 'retry-summary'), true);
  assert.equal(contracts.canIssueAgentSessionCommand('running', 'retry-summary'), false);
  assert.equal(contracts.getAgentSessionCommandPolicy('fork').sourceSessionEffect, 'preserve');
  assert.equal(contracts.getAgentSessionCommandPolicy('steer').requiresRunId, true);
  assert.equal(contracts.getAgentSessionCommandPolicy('steer').sequenceRule, 'match-current');
  assert.equal(contracts.getAgentSessionCommandPolicy('stop').sequenceRule, 'target-run');
  assert.equal(contracts.resolveAgentSessionCommandTransition('completed', 'fork'), undefined);
  assert.equal(contracts.resolveAgentSessionCommandTransition('completed', 'retry-summary'), undefined);
  for (const code of [
    'ACTIVE_RUN_NOT_FOUND',
    'SOURCE_THREAD_NOT_FOUND',
    'SOURCE_MESSAGE_NOT_FOUND',
    'SOURCE_RUN_NOT_FOUND',
    'SOURCE_LINEAGE_INVALID',
    'ACTIVE_BRANCH_NOT_FOUND',
  ]) {
    assert.equal(contracts.AgentSessionCommandErrorCodeSchema.safeParse(code).success, true, code);
  }
});

test('defines summary-only retry without transitioning or rerunning the source task', () => {
  const command = {
    contract: 'AgentSessionCommand',
    commandId: 'command-summary-retry',
    sessionId: 'session-wp1',
    runId: 'run-1',
    idempotencyKey: 'session-wp1:summary-retry:1',
    expectedSequence: 8,
    issuedAt: '2026-08-02T00:00:00.000Z',
    commandType: 'retry-summary',
    payload: { sourceEventId: 'summary-failed-1', sourceRunId: 'run-1' },
  };
  assert.deepEqual(contracts.AgentSessionCommandSchema.parse(command), command);
  const policy = contracts.getAgentSessionCommandPolicy('retry-summary');
  assert.equal(policy.capability, 'summary');
  assert.equal(policy.sourceSessionEffect, 'preserve');
  assert.equal(policy.requiresRunId, true);
  assert.deepEqual(contracts.AGENT_SESSION_CAPABILITY_EVIDENCE.summary.commandTypes, ['retry-summary']);
  assert.equal(
    contracts.AgentSessionCommandSchema.safeParse({
      ...command,
      payload: { ...command.payload, sourceRunId: 'run-other' },
    }).success,
    false,
  );
});

test('keeps pre-WP1 session contracts parseable with new capabilities disabled', () => {
  const legacy = structuredClone(readFixture('agent-session-work.json'));
  for (const capability of ['threadForking', 'editAndRerun', 'steering', 'summary']) {
    delete legacy.snapshot.capabilities[capability];
  }
  const parsed = contracts.AgentSessionViewModelSchema.parse(legacy);
  assert.equal(parsed.snapshot.capabilities.threadForking, false);
  assert.equal(parsed.snapshot.capabilities.editAndRerun, false);
  assert.equal(parsed.snapshot.capabilities.steering, false);
  assert.equal(parsed.snapshot.capabilities.summary, false);
});

test('validates session permission profiles without breaking legacy snapshots', () => {
  const fixture = structuredClone(readFixture('agent-session-work.json'));
  assert.equal(contracts.AgentSessionViewModelSchema.safeParse(fixture).success, true);

  fixture.snapshot.permissionProfile = 'approval-required';
  assert.equal(contracts.AgentSessionViewModelSchema.safeParse(fixture).success, true);
  assert.equal(
    contracts.AgentSessionViewModelSchema.safeParse({
      ...fixture,
      snapshot: { ...fixture.snapshot, permissionProfile: 'unrestricted' },
    }).success,
    false,
  );
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

test('keeps legacy commands compatible while requiring run identity at the upgraded boundary', () => {
  const legacyStop = readFixture('agent-session-commands.json').commands[0];
  assert.equal(contracts.AgentSessionCommandSchema.safeParse(legacyStop).success, true);
  assert.equal(contracts.AgentSessionTargetedCommandSchema.safeParse(legacyStop).success, false);
  assert.equal(
    contracts.AgentSessionTargetedCommandSchema.safeParse({ ...legacyStop, runId: 'run-1' }).success,
    true,
  );
});

test('defines stable runs with one mutually exclusive terminal status', () => {
  const completed = {
    runId: 'run-1',
    sessionId: 'agent-session-1',
    sourceMessageId: 'message-1',
    status: 'completed',
    startedAt: '2026-07-30T00:00:00.000Z',
    completedAt: '2026-07-30T00:00:10.000Z',
    durationMs: 10000,
  };
  assert.deepEqual(contracts.AgentSessionRunSchema.parse(completed), completed);
  assert.equal(
    contracts.AgentSessionRunSchema.safeParse({
      ...completed,
      stoppedAt: '2026-07-30T00:00:09.000Z',
    }).success,
    false,
  );
  assert.equal(
    contracts.AgentSessionRunSchema.safeParse({ ...completed, status: 'running' }).success,
    false,
  );
  const { durationMs: _durationMs, ...withoutDuration } = completed;
  assert.equal(contracts.AgentSessionRunSchema.safeParse(withoutDuration).success, false);
});

test('validates canonical run lifecycle fixtures and their required time points', () => {
  const fixture = readFixture('agent-session-runs.json');
  fixture.runs.forEach((run) => {
    assert.deepEqual(contracts.AgentSessionRunSchema.parse(run), run);
  });
  fixture.events.forEach((event) => {
    assert.deepEqual(contracts.AgentSessionRunEventSchema.parse(event), event);
  });
  assert.equal(
    contracts.AgentSessionRunEventSchema.safeParse({
      ...fixture.events[0],
      payload: { status: 'stopped', stoppedAt: fixture.events[0].payload.stoppedAt },
    }).success,
    false,
  );
});

test('distinguishes accepted stop requests from confirmed termination', () => {
  const result = readFixture('agent-session-commands.json').results[0];
  assert.equal(
    contracts.AgentSessionCommandResultSchema.safeParse({
      ...result,
      runId: 'run-1',
      termination: 'requested',
    }).success,
    true,
  );
  assert.equal(
    contracts.AgentSessionCommandResultSchema.safeParse({
      ...result,
      sessionStatus: 'stopped',
      termination: 'confirmed',
    }).success,
    true,
  );
  assert.equal(
    contracts.AgentSessionCommandResultSchema.safeParse({
      ...result,
      sessionStatus: 'running',
      termination: 'confirmed',
    }).success,
    false,
  );
});

test('requires upgraded run events to identify their run and source message', () => {
  const legacyEvent = readFixture('agent-session-work.json').events[0];
  assert.equal(contracts.AgentSessionEventSchema.safeParse(legacyEvent).success, true);
  assert.equal(contracts.AgentSessionRunEventSchema.safeParse(legacyEvent).success, false);
  assert.equal(
    contracts.AgentSessionRunEventSchema.safeParse({
      ...legacyEvent,
      runId: 'run-1',
      sourceMessageId: 'message-1',
      payload: { ...legacyEvent.payload, startedAt: legacyEvent.occurredAt },
    }).success,
    true,
  );
});

test('prevents terminal runs from accepting late status changes', () => {
  assert.equal(contracts.canApplyAgentSessionRunStatus('running', 'stopping'), true);
  assert.equal(contracts.canApplyAgentSessionRunStatus('stopping', 'stopped'), true);
  assert.equal(contracts.canApplyAgentSessionRunStatus('stopping', 'completed'), true);
  assert.equal(contracts.canApplyAgentSessionRunStatus('running', 'queued'), false);
  assert.equal(contracts.canApplyAgentSessionRunStatus('queued', 'completed'), false);
  assert.equal(contracts.canApplyAgentSessionRunStatus('stopped', 'completed'), false);
  assert.equal(contracts.canApplyAgentSessionRunStatus('completed', 'running'), false);
});

test('publishes stop targeting, timeout, completion race, and sequence conflict errors', () => {
  for (const code of ['RUN_NOT_FOUND', 'RUN_ALREADY_FINISHED', 'STOP_TIMEOUT', 'SEQUENCE_CONFLICT']) {
    assert.equal(contracts.AgentSessionCommandErrorCodeSchema.safeParse(code).success, true, code);
  }
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
  const sessionEvent = readFixture('agent-session-work.json').events[0];
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
  const fixture = readFixture('agent-session-work.json').events[0];
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
  const fixture = readFixture('agent-session-work.json');
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
  assert.equal(contracts.normalizeAgentMode('codex'), 'work');
  assert.equal(contracts.normalizeAgentMode('vercel-ai'), 'chat');
  assert.equal(contracts.normalizeAgentMode('unknown'), undefined);
});

test('publishes canonical configuration capabilities for each Agent mode', () => {
  assert.deepEqual(contracts.getAgentModeCapabilities('chat'), {
    models: true,
    skills: true,
    tools: true,
    mcp: true,
    reasoning: false,
  });
  assert.equal(contracts.agentModeHasCapability('work', 'reasoning'), true);
  assert.equal(contracts.agentModeHasCapability('chat', 'reasoning'), false);
});

test('requires resources to declare their compatible product modes', () => {
  const agentOnly = contracts.AgentResourceModeSupportSchema.parse({ modes: ['work'] });
  assert.equal(contracts.isAgentResourceModeCompatible(agentOnly, 'work'), true);
  assert.equal(contracts.isAgentResourceModeCompatible(agentOnly, 'chat'), false);
  assert.equal(contracts.isAgentResourceModeCompatible(undefined, 'work'), false);
  assert.equal(contracts.AgentResourceModeSupportSchema.safeParse({ modes: [] }).success, false);
});

test('keeps runtime capability truth backed by canonical events or commands', () => {
  const commandTypes = readFixture('agent-session-commands.json').commands.map((command) => command.commandType);
  for (const mode of ['chat', 'work']) {
    const fixture = readFixture(`agent-session-${mode}.json`);
    assert.deepEqual(fixture.snapshot.capabilities, contracts.getAgentSessionRuntimeCapabilities(mode));
    assert.deepEqual(contracts.findUnsupportedAgentSessionCapabilities(fixture.snapshot.capabilities, {
      eventTypes: [...fixture.events.map((event) => event.eventType), 'summary'], commandTypes,
    }), []);
    assert.equal(fixture.snapshot.capabilities.summary, true);
  }
  const kernel = readFixture('agent-session-kernel.json');
  assert.deepEqual(contracts.findUnsupportedAgentSessionCapabilities(kernel.snapshot.capabilities, {
    eventTypes: kernel.events.map((event) => event.eventType), commandTypes,
  }), []);
});

test('projects replayed and out-of-order events without advancing across a sequence gap', () => {
  const fixture = readFixture('agent-session-work.json');
  const initial = runtime.projectAgentSessionEvents(runtime.createAgentSessionEventProjection(fixture.sessionId), [fixture.events[1], fixture.events[0], fixture.events[0]]);
  assert.deepEqual(initial.events.map((event) => event.sequence), [0, 1]);
  const withGap = runtime.projectAgentSessionEvents(initial, [{ ...fixture.events[2], sequence: 3 }]);
  assert.equal(withGap.lastSequence, 1);
  assert.deepEqual(withGap.gap, { expectedSequence: 2, receivedSequence: 3 });
  const recovered = runtime.projectAgentSessionEvents(withGap, [fixture.events[2]]);
  const complete = runtime.projectAgentSessionEvents(recovered, fixture.events.slice(3));
  assert.deepEqual(runtime.toAgentSessionViewModel(complete, fixture.snapshot), fixture);
});

test('projects every shared session fixture into its declared view model', () => {
  for (const name of ['chat', 'work', 'kernel']) {
    const fixture = readFixture(`agent-session-${name}.json`);
    const projection = runtime.projectAgentSessionEvents(
      runtime.createAgentSessionEventProjection(fixture.sessionId),
      [...fixture.events].reverse(),
    );
    assert.deepEqual(runtime.toAgentSessionViewModel(projection, fixture.snapshot), fixture);
  }
});

test('session projection fails closed for unknown, foreign, and conflicting events', () => {
  const fixture = readFixture('agent-session-work.json');
  const projection = runtime.createAgentSessionEventProjection(fixture.sessionId);
  assert.throws(() => runtime.projectAgentSessionEvents(projection, [{ ...fixture.events[0], eventType: 'unknown' }]));
  assert.throws(() => runtime.projectAgentSessionEvents(projection, [{ ...fixture.events[0], sessionId: 'foreign' }]));
  const initial = runtime.projectAgentSessionEvents(projection, [fixture.events[0]]);
  assert.throws(() => runtime.projectAgentSessionEvents(initial, [{ ...fixture.events[0], eventId: 'conflict', idempotencyKey: 'conflict', payload: { status: 'failed' } }]));
});
