import { z } from 'zod';
import { ContractIdentifierSchema, IsoDateTimeSchema, JsonObjectSchema, JsonValueSchema } from './common';

export const AgentModeSchema = z.enum(['chatbot', 'agent']);

export const AgentConfigurationCapabilitySchema = z.enum([
  'models',
  'skills',
  'tools',
  'mcp',
  'reasoning',
]);

export const AgentModeCapabilitiesSchema = z
  .object({
    models: z.boolean(),
    skills: z.boolean(),
    tools: z.boolean(),
    mcp: z.boolean(),
    reasoning: z.boolean(),
  })
  .strict();

export const AgentResourceModeSupportSchema = z
  .object({
    modes: z.array(AgentModeSchema).min(1),
  })
  .strict();

export const AGENT_MODE_CAPABILITIES = Object.freeze({
  chatbot: AgentModeCapabilitiesSchema.parse({
    models: true,
    skills: true,
    tools: true,
    mcp: true,
    reasoning: false,
  }),
  agent: AgentModeCapabilitiesSchema.parse({
    models: true,
    skills: true,
    tools: true,
    mcp: true,
    reasoning: true,
  }),
}) satisfies Readonly<Record<AgentMode, AgentModeCapabilities>>;

export function getAgentModeCapabilities(mode: AgentMode): AgentModeCapabilities {
  return AGENT_MODE_CAPABILITIES[mode];
}

export function agentModeHasCapability(mode: AgentMode, capability: AgentConfigurationCapability): boolean {
  return getAgentModeCapabilities(mode)[capability];
}

export function isAgentResourceModeCompatible(
  support: AgentResourceModeSupport | undefined,
  mode: AgentMode,
): boolean {
  return support?.modes.includes(mode) ?? false;
}

export const AgentSessionCapabilitySchema = z.enum([
  'text',
  'reasoning',
  'plan',
  'tasks',
  'tools',
  'mcp',
  'shell',
  'fileChange',
  'skills',
  'approval',
  'artifacts',
  'usage',
  'resume',
  'diff',
  'workspaceFiles',
  'terminal',
  'testResults',
]);

export const AgentSessionCapabilitiesSchema = z
  .object({
    text: z.boolean().default(true),
    reasoning: z.boolean().default(false),
    plan: z.boolean().default(false),
    tasks: z.boolean().default(false),
    tools: z.boolean().default(false),
    mcp: z.boolean().default(false),
    shell: z.boolean().default(false),
    fileChange: z.boolean().default(false),
    skills: z.boolean().default(false),
    approval: z.boolean().default(false),
    artifacts: z.boolean().default(false),
    usage: z.boolean().default(false),
    resume: z.boolean().default(false),
    diff: z.boolean().default(false),
    workspaceFiles: z.boolean().default(false),
    terminal: z.boolean().default(false),
    testResults: z.boolean().default(false),
  })
  .strict();

export const AGENT_SESSION_RUNTIME_CAPABILITIES = Object.freeze({
  chatbot: AgentSessionCapabilitiesSchema.parse({ text: true, tools: true, mcp: true, skills: true, approval: true, usage: true }),
  agent: AgentSessionCapabilitiesSchema.parse({ text: true, tools: true, mcp: true, shell: true, fileChange: true, skills: true, approval: true, artifacts: true, usage: true, resume: true }),
}) satisfies Readonly<Record<AgentMode, AgentSessionCapabilities>>;

export function getAgentSessionRuntimeCapabilities(mode: AgentMode): AgentSessionCapabilities {
  return AGENT_SESSION_RUNTIME_CAPABILITIES[mode];
}

export const AGENT_SESSION_CAPABILITY_EVIDENCE = Object.freeze({
  text: { eventTypes: ['message'], commandTypes: [] },
  reasoning: { eventTypes: ['reasoning'], commandTypes: [] },
  plan: { eventTypes: ['plan'], commandTypes: [] },
  tasks: { eventTypes: ['task'], commandTypes: [] },
  tools: { eventTypes: ['tool'], commandTypes: [] },
  mcp: { eventTypes: ['tool'], commandTypes: [] },
  shell: { eventTypes: ['tool', 'terminal'], commandTypes: [] },
  fileChange: { eventTypes: ['tool', 'diff', 'workspace-file'], commandTypes: [] },
  skills: { eventTypes: ['tool'], commandTypes: [] },
  approval: { eventTypes: ['approval'], commandTypes: ['approval'] },
  artifacts: { eventTypes: ['artifact'], commandTypes: [] },
  usage: { eventTypes: ['usage'], commandTypes: [] },
  resume: { eventTypes: ['resume'], commandTypes: ['resume'] },
  diff: { eventTypes: ['diff'], commandTypes: [] },
  workspaceFiles: { eventTypes: ['workspace-file'], commandTypes: [] },
  terminal: { eventTypes: ['terminal'], commandTypes: [] },
  testResults: { eventTypes: ['test-result'], commandTypes: [] },
} as const) satisfies Readonly<Record<AgentSessionCapability, { readonly eventTypes: readonly string[]; readonly commandTypes: readonly string[] }>>;

export function findUnsupportedAgentSessionCapabilities(
  capabilities: AgentSessionCapabilities,
  evidence: { eventTypes?: readonly string[]; commandTypes?: readonly string[] },
): AgentSessionCapability[] {
  const eventTypes = new Set(evidence.eventTypes || []);
  const commandTypes = new Set(evidence.commandTypes || []);
  return AgentSessionCapabilitySchema.options.filter((capability) => {
    if (!capabilities[capability]) return false;
    const requirement = AGENT_SESSION_CAPABILITY_EVIDENCE[capability];
    return !requirement.eventTypes.some((eventType) => eventTypes.has(eventType)) && !requirement.commandTypes.some((commandType) => commandTypes.has(commandType));
  });
}

export const AgentSessionSnapshotSchema = z
  .object({
    mode: AgentModeSchema,
    modelId: z.string().trim().min(1),
    capabilities: AgentSessionCapabilitiesSchema,
  })
  .strict();

export const AgentSessionStatusSchema = z.enum([
  'queued',
  'running',
  'waiting_approval',
  'stopping',
  'stopped',
  'completed',
  'failed',
]);

export const AgentSessionTerminalStatusSchema = z.enum(['stopped', 'completed', 'failed']);

export const AgentSessionRunSchema = z
  .object({
    runId: ContractIdentifierSchema,
    sessionId: ContractIdentifierSchema,
    sourceMessageId: ContractIdentifierSchema,
    status: AgentSessionStatusSchema,
    startedAt: IsoDateTimeSchema,
    stoppingRequestedAt: IsoDateTimeSchema.optional(),
    stoppedAt: IsoDateTimeSchema.optional(),
    completedAt: IsoDateTimeSchema.optional(),
    failedAt: IsoDateTimeSchema.optional(),
    durationMs: z.number().nonnegative().optional(),
  })
  .strict()
  .superRefine((value, context) => {
    const terminalTimestamps = [value.stoppedAt, value.completedAt, value.failedAt].filter(Boolean);
    if (terminalTimestamps.length > 1) {
      context.addIssue({
        code: 'custom',
        path: ['status'],
        message: 'A run may declare only one terminal timestamp.',
      });
    }
    const expectedTimestamp =
      value.status === 'stopped'
        ? value.stoppedAt
        : value.status === 'completed'
          ? value.completedAt
          : value.status === 'failed'
            ? value.failedAt
            : undefined;
    if (AgentSessionTerminalStatusSchema.safeParse(value.status).success && !expectedTimestamp) {
      context.addIssue({
        code: 'custom',
        path: [value.status === 'stopped' ? 'stoppedAt' : value.status === 'completed' ? 'completedAt' : 'failedAt'],
        message: `Run status ${value.status} requires its matching terminal timestamp.`,
      });
    }
    if (!AgentSessionTerminalStatusSchema.safeParse(value.status).success && terminalTimestamps.length > 0) {
      context.addIssue({
        code: 'custom',
        path: ['status'],
        message: 'A non-terminal run must not declare a terminal timestamp.',
      });
    }
    if ((value.status === 'stopping' || value.status === 'stopped') && !value.stoppingRequestedAt) {
      context.addIssue({
        code: 'custom',
        path: ['stoppingRequestedAt'],
        message: `Run status ${value.status} requires stoppingRequestedAt.`,
      });
    }
    if (!isAgentSessionTerminalStatus(value.status) && value.durationMs !== undefined) {
      context.addIssue({
        code: 'custom',
        path: ['durationMs'],
        message: 'Only a terminal run may declare durationMs.',
      });
    }
    if (isAgentSessionTerminalStatus(value.status) && value.durationMs === undefined) {
      context.addIssue({
        code: 'custom',
        path: ['durationMs'],
        message: `Terminal run status ${value.status} requires durationMs.`,
      });
    }
  });

export const AgentSessionCommandTypeSchema = z.enum(['stop', 'resume', 'retry', 'approval']);

const AgentSessionCommandHeaderSchema = z
  .object({
    contract: z.literal('AgentSessionCommand'),
    commandId: ContractIdentifierSchema,
    sessionId: ContractIdentifierSchema,
    runId: ContractIdentifierSchema.optional(),
    idempotencyKey: ContractIdentifierSchema,
    expectedSequence: z.number().int().min(-1),
    issuedAt: IsoDateTimeSchema,
  })
  .strict();

const sessionCommand = <CommandType extends string, Payload extends z.ZodRawShape>(commandType: CommandType, payload: Payload) =>
  AgentSessionCommandHeaderSchema.extend({
    commandType: z.literal(commandType),
    payload: z.object(payload).strict(),
  }).strict();

export const AgentSessionCommandSchema = z.discriminatedUnion('commandType', [
  sessionCommand('stop', {
    reason: z.string().trim().min(1).optional(),
  }),
  sessionCommand('resume', {
    resumeEventId: ContractIdentifierSchema.optional(),
  }),
  sessionCommand('retry', {
    sourceEventId: ContractIdentifierSchema,
  }),
  sessionCommand('approval', {
    approvalId: ContractIdentifierSchema,
    decision: z.enum(['approved', 'rejected']),
    reason: z.string().trim().min(1).optional(),
  }),
]);

export const AgentSessionTargetedCommandSchema = AgentSessionCommandSchema.and(
  z.object({ runId: ContractIdentifierSchema }),
);

export const AgentSessionCommandErrorCodeSchema = z.enum([
  'SESSION_NOT_FOUND',
  'RUN_NOT_FOUND',
  'RUN_ALREADY_FINISHED',
  'STOP_TIMEOUT',
  'COMMAND_NOT_SUPPORTED',
  'CAPABILITY_UNAVAILABLE',
  'SEQUENCE_CONFLICT',
  'INVALID_SESSION_STATE',
  'TARGET_EVENT_NOT_FOUND',
  'TARGET_EVENT_NOT_RETRYABLE',
  'APPROVAL_NOT_FOUND',
  'APPROVAL_ALREADY_RESOLVED',
  'COMMAND_EXECUTION_FAILED',
]);

export const AgentSessionCommandResultSchema = z
  .object({
    contract: z.literal('AgentSessionCommandResult'),
    commandId: ContractIdentifierSchema,
    sessionId: ContractIdentifierSchema,
    runId: ContractIdentifierSchema.optional(),
    idempotencyKey: ContractIdentifierSchema,
    outcome: z.enum(['accepted', 'duplicate', 'rejected', 'failed']),
    sessionStatus: AgentSessionStatusSchema,
    acceptedSequence: z.number().int().nonnegative().optional(),
    resultEventIds: z.array(ContractIdentifierSchema).default([]),
    termination: z.enum(['requested', 'confirmed']).optional(),
    error: z
      .object({
        code: AgentSessionCommandErrorCodeSchema,
        message: z.string(),
        retryable: z.boolean(),
      })
      .strict()
      .optional(),
    occurredAt: IsoDateTimeSchema,
  })
  .strict()
  .superRefine((value, context) => {
    const requiresError = value.outcome === 'rejected' || value.outcome === 'failed';
    if (requiresError !== Boolean(value.error)) {
      context.addIssue({
        code: 'custom',
        path: ['error'],
        message: requiresError
          ? 'Rejected and failed command results require an error.'
          : 'Accepted and duplicate command results must not contain an error.',
      });
    }
    if (value.termination === 'requested' && value.sessionStatus !== 'stopping') {
      context.addIssue({
        code: 'custom',
        path: ['termination'],
        message: 'A requested termination must leave the run in stopping status.',
      });
    }
    if (value.termination === 'confirmed' && !isAgentSessionTerminalStatus(value.sessionStatus)) {
      context.addIssue({
        code: 'custom',
        path: ['termination'],
        message: 'A confirmed termination requires a terminal run status.',
      });
    }
  });

const AGENT_SESSION_COMMAND_TRANSITIONS: Record<AgentSessionCommandType, Partial<Record<AgentSessionStatus, AgentSessionStatus>>> = {
  stop: { queued: 'stopping', running: 'stopping', waiting_approval: 'stopping' },
  resume: { stopped: 'queued', completed: 'queued', failed: 'queued' },
  retry: { failed: 'queued' },
  approval: { waiting_approval: 'running' },
};

export function resolveAgentSessionCommandTransition(
  status: AgentSessionStatus,
  commandType: AgentSessionCommandType,
): AgentSessionStatus | undefined {
  return AGENT_SESSION_COMMAND_TRANSITIONS[commandType][status];
}

export function isAgentSessionTerminalStatus(status: AgentSessionStatus): status is AgentSessionTerminalStatus {
  return AgentSessionTerminalStatusSchema.safeParse(status).success;
}

export function canApplyAgentSessionRunStatus(current: AgentSessionStatus, next: AgentSessionStatus): boolean {
  if (current === next) return true;
  const transitions: Record<AgentSessionStatus, readonly AgentSessionStatus[]> = {
    queued: ['running', 'stopping', 'failed'],
    running: ['waiting_approval', 'stopping', 'completed', 'failed'],
    waiting_approval: ['running', 'stopping', 'failed'],
    stopping: ['stopped', 'completed', 'failed'],
    stopped: [],
    completed: [],
    failed: [],
  };
  return transitions[current].includes(next);
}

const AgentSessionEventHeaderSchema = z
  .object({
    contract: z.literal('AgentSessionEvent'),
    eventId: ContractIdentifierSchema,
    sessionId: ContractIdentifierSchema,
    runId: ContractIdentifierSchema.optional(),
    sourceMessageId: ContractIdentifierSchema.optional(),
    sequence: z.number().int().nonnegative(),
    idempotencyKey: ContractIdentifierSchema,
    occurredAt: IsoDateTimeSchema,
  })
  .strict();

const sessionEvent = <EventType extends string, Payload extends z.ZodRawShape>(eventType: EventType, payload: Payload) =>
  AgentSessionEventHeaderSchema.extend({
    eventType: z.literal(eventType),
    payload: z.object(payload).strict(),
  }).strict();

export const AgentSessionEventSchema = z.discriminatedUnion('eventType', [
  sessionEvent('message', {
    messageId: ContractIdentifierSchema,
    role: z.enum(['user', 'assistant', 'system']),
    operation: z.enum(['append', 'replace']).default('append'),
    parts: z.array(JsonValueSchema),
    status: z.enum(['streaming', 'completed', 'failed']).optional(),
  }),
  sessionEvent('reasoning', {
    reasoningId: ContractIdentifierSchema,
    text: z.string(),
    status: z.enum(['streaming', 'completed']),
  }),
  sessionEvent('plan', {
    planId: ContractIdentifierSchema,
    title: z.string().optional(),
    status: z.enum(['pending', 'running', 'completed', 'failed']),
    steps: z.array(
      z
        .object({
          id: ContractIdentifierSchema,
          title: z.string(),
          status: z.enum(['pending', 'running', 'completed', 'failed', 'skipped']),
        })
        .strict(),
    ),
  }),
  sessionEvent('task', {
    taskId: ContractIdentifierSchema,
    title: z.string(),
    status: z.enum(['pending', 'running', 'completed', 'failed', 'skipped']),
    detail: z.string().optional(),
  }),
  sessionEvent('tool', {
    toolCallId: ContractIdentifierSchema,
    toolName: z.string().trim().min(1),
    status: z.enum(['pending', 'running', 'completed', 'failed', 'denied']),
    input: JsonValueSchema.optional(),
    output: JsonValueSchema.optional(),
    error: z.string().optional(),
    startedAt: IsoDateTimeSchema.optional(),
    completedAt: IsoDateTimeSchema.optional(),
  }),
  sessionEvent('approval', {
    approvalId: ContractIdentifierSchema,
    toolCallId: ContractIdentifierSchema.optional(),
    status: z.enum(['requested', 'approved', 'rejected', 'expired']),
    title: z.string(),
    description: z.string().optional(),
    requestedAction: JsonValueSchema.optional(),
  }),
  sessionEvent('status', {
    status: AgentSessionStatusSchema,
    detail: z.string().optional(),
    startedAt: IsoDateTimeSchema.optional(),
    stoppingRequestedAt: IsoDateTimeSchema.optional(),
    stoppedAt: IsoDateTimeSchema.optional(),
    completedAt: IsoDateTimeSchema.optional(),
    failedAt: IsoDateTimeSchema.optional(),
    durationMs: z.number().nonnegative().optional(),
  }),
  sessionEvent('artifact', {
    artifactId: ContractIdentifierSchema,
    name: z.string().trim().min(1),
    kind: z.enum(['file', 'image', 'video', 'audio', 'web', 'other']),
    status: z.enum(['pending', 'ready', 'failed']),
    mimeType: z.string().optional(),
    url: z.string().url().optional(),
    size: z.number().int().nonnegative().optional(),
    sourceEventId: ContractIdentifierSchema.optional(),
  }),
  sessionEvent('usage', {
    inputTokens: z.number().int().nonnegative().optional(),
    outputTokens: z.number().int().nonnegative().optional(),
    totalTokens: z.number().int().nonnegative().optional(),
    contextTokens: z.number().int().nonnegative().optional(),
    contextWindow: z.number().int().positive().optional(),
  }),
  sessionEvent('resume', {
    resumable: z.boolean(),
    state: JsonObjectSchema.optional(),
    reason: z.string().optional(),
  }),
  sessionEvent('error', {
    code: z.string().trim().min(1),
    message: z.string(),
    retryable: z.boolean(),
    sourceEventId: ContractIdentifierSchema.optional(),
    details: JsonObjectSchema.optional(),
  }),
  sessionEvent('diff', {
    path: z.string().trim().min(1),
    status: z.enum(['added', 'modified', 'deleted', 'renamed']),
    patch: z.string().optional(),
  }),
  sessionEvent('workspace-file', {
    path: z.string().trim().min(1),
    operation: z.enum(['upsert', 'delete']),
    mimeType: z.string().optional(),
    size: z.number().int().nonnegative().optional(),
  }),
  sessionEvent('terminal', {
    terminalId: ContractIdentifierSchema,
    stream: z.enum(['stdin', 'stdout', 'stderr', 'status']),
    chunk: z.string(),
    exitCode: z.number().int().optional(),
  }),
  sessionEvent('test-result', {
    testId: ContractIdentifierSchema,
    name: z.string(),
    status: z.enum(['running', 'passed', 'failed', 'skipped']),
    durationMs: z.number().nonnegative().optional(),
    output: z.string().optional(),
  }),
]);

export const AgentSessionRunEventSchema = AgentSessionEventSchema.superRefine((value, context) => {
  if (!value.runId) {
    context.addIssue({ code: 'custom', path: ['runId'], message: 'Run events require runId.' });
  }
  if (!value.sourceMessageId) {
    context.addIssue({
      code: 'custom',
      path: ['sourceMessageId'],
      message: 'Run events require sourceMessageId.',
    });
  }
  if (value.eventType !== 'status') return;
  const requiredTimeField =
    value.payload.status === 'running'
      ? 'startedAt'
      : value.payload.status === 'stopping'
        ? 'stoppingRequestedAt'
        : value.payload.status === 'stopped'
          ? 'stoppedAt'
          : value.payload.status === 'completed'
            ? 'completedAt'
            : value.payload.status === 'failed'
              ? 'failedAt'
              : undefined;
  if (requiredTimeField && !value.payload[requiredTimeField]) {
    context.addIssue({
      code: 'custom',
      path: ['payload', requiredTimeField],
      message: `Run status ${value.payload.status} requires ${requiredTimeField}.`,
    });
  }
  if (isAgentSessionTerminalStatus(value.payload.status) && value.payload.durationMs === undefined) {
    context.addIssue({
      code: 'custom',
      path: ['payload', 'durationMs'],
      message: `Terminal run status ${value.payload.status} requires durationMs.`,
    });
  }
});

export const AgentSessionViewModelSchema = z
  .object({
    contract: z.literal('AgentSessionViewModel'),
    sessionId: ContractIdentifierSchema,
    snapshot: AgentSessionSnapshotSchema,
    status: AgentSessionStatusSchema,
    events: z.array(AgentSessionEventSchema),
    lastSequence: z.number().int().min(-1),
    resumable: z.boolean().default(false),
  })
  .strict()
  .superRefine((value, context) => {
    const eventIds = new Set<string>();
    const idempotencyKeys = new Set<string>();
    let previousSequence = -1;

    value.events.forEach((event, index) => {
      if (event.sessionId !== value.sessionId) {
        context.addIssue({
          code: 'custom',
          path: ['events', index, 'sessionId'],
          message: 'Event sessionId must match the view model sessionId.',
        });
      }
      if (event.sequence <= previousSequence) {
        context.addIssue({
          code: 'custom',
          path: ['events', index, 'sequence'],
          message: 'Events must be ordered by a strictly increasing sequence.',
        });
      }
      if (eventIds.has(event.eventId)) {
        context.addIssue({
          code: 'custom',
          path: ['events', index, 'eventId'],
          message: 'Event IDs must be unique within a session view model.',
        });
      }
      if (idempotencyKeys.has(event.idempotencyKey)) {
        context.addIssue({
          code: 'custom',
          path: ['events', index, 'idempotencyKey'],
          message: 'Idempotency keys must be unique within a session view model.',
        });
      }
      previousSequence = event.sequence;
      eventIds.add(event.eventId);
      idempotencyKeys.add(event.idempotencyKey);
    });

    const expectedLastSequence = value.events.length > 0 ? value.events[value.events.length - 1].sequence : -1;
    if (value.lastSequence !== expectedLastSequence) {
      context.addIssue({
        code: 'custom',
        path: ['lastSequence'],
        message: 'lastSequence must match the final event sequence, or -1 when there are no events.',
      });
    }
  });

export type AgentMode = z.infer<typeof AgentModeSchema>;
export type AgentConfigurationCapability = z.infer<typeof AgentConfigurationCapabilitySchema>;
export type AgentModeCapabilities = z.infer<typeof AgentModeCapabilitiesSchema>;
export type AgentResourceModeSupport = z.infer<typeof AgentResourceModeSupportSchema>;
export type AgentSessionCapability = z.infer<typeof AgentSessionCapabilitySchema>;
export type AgentSessionCapabilities = z.infer<typeof AgentSessionCapabilitiesSchema>;
export type AgentSessionSnapshot = z.infer<typeof AgentSessionSnapshotSchema>;
export type AgentSessionStatus = z.infer<typeof AgentSessionStatusSchema>;
export type AgentSessionTerminalStatus = z.infer<typeof AgentSessionTerminalStatusSchema>;
export type AgentSessionRun = z.infer<typeof AgentSessionRunSchema>;
export type AgentSessionCommandType = z.infer<typeof AgentSessionCommandTypeSchema>;
export type AgentSessionCommand = z.infer<typeof AgentSessionCommandSchema>;
export type AgentSessionTargetedCommand = z.infer<typeof AgentSessionTargetedCommandSchema>;
export type AgentSessionCommandErrorCode = z.infer<typeof AgentSessionCommandErrorCodeSchema>;
export type AgentSessionCommandResult = z.infer<typeof AgentSessionCommandResultSchema>;
export type AgentSessionEvent = z.infer<typeof AgentSessionEventSchema>;
export type AgentSessionRunEvent = z.infer<typeof AgentSessionRunEventSchema>;
export type AgentSessionViewModel = z.infer<typeof AgentSessionViewModelSchema>;

// Kept as a source-compatible type alias while consumers move to the product-level name.
export const AgentExecutionModeSchema = AgentModeSchema;
export type AgentExecutionMode = AgentMode;

export function normalizeAgentMode(value: unknown): AgentMode | undefined {
  const normalized = String(value ?? '')
    .trim()
    .toLowerCase();
  if (normalized === 'agent' || normalized === 'codex') return 'agent';
  if (normalized === 'chatbot' || normalized === 'vercel-ai' || normalized === 'vercel' || normalized === 'ai-sdk') {
    return 'chatbot';
  }
  return undefined;
}

export const normalizeAgentExecutionMode = normalizeAgentMode;
