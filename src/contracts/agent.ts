import { z } from 'zod';
import { ContractIdentifierSchema, IsoDateTimeSchema, JsonObjectSchema, JsonValueSchema } from './common';

export const StudioAgentModeSchema = z.enum(['chat', 'work']);

/** @deprecated Use StudioAgentModeSchema. */
export const AgentModeSchema = StudioAgentModeSchema;

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
  chat: AgentModeCapabilitiesSchema.parse({
    models: true,
    skills: true,
    tools: true,
    mcp: true,
    reasoning: false,
  }),
  work: AgentModeCapabilitiesSchema.parse({
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
  'threadForking',
  'editAndRerun',
  'steering',
  'summary',
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
    threadForking: z.boolean().default(false),
    editAndRerun: z.boolean().default(false),
    steering: z.boolean().default(false),
    summary: z.boolean().default(false),
  })
  .strict();

/**
 * Session-level execution safety profile. This is a product contract; runtime
 * adapters map it to their own approval and sandbox settings.
 */
export const AgentSessionPermissionProfileSchema = z.enum([
  'approval-required',
  'auto-approve',
  'full-access',
]);

export const AGENT_SESSION_RUNTIME_CAPABILITIES = Object.freeze({
  chat: AgentSessionCapabilitiesSchema.parse({ text: true, tools: true, mcp: true, skills: true, approval: true, usage: true, editAndRerun: true, summary: true }),
  work: AgentSessionCapabilitiesSchema.parse({ text: true, tools: true, mcp: true, shell: true, fileChange: true, skills: true, approval: true, artifacts: true, usage: true, resume: true, editAndRerun: true, steering: true, summary: true }),
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
  threadForking: { eventTypes: [], commandTypes: ['fork'] },
  editAndRerun: { eventTypes: [], commandTypes: ['edit-and-rerun'] },
  steering: { eventTypes: ['steer'], commandTypes: ['steer'] },
  summary: { eventTypes: ['summary'], commandTypes: ['retry-summary'] },
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
    permissionProfile: AgentSessionPermissionProfileSchema.optional(),
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

export const AgentSessionLineageSchema = z
  .object({
    forkedFromThreadId: ContractIdentifierSchema,
    forkedFromMessageId: ContractIdentifierSchema,
    sourceRunId: ContractIdentifierSchema,
  })
  .strict();

export const AgentSessionContextInheritanceSchema = z
  .object({
    messages: z.enum(['through-source-message', 'exclude']),
    attachments: z.enum(['inherit', 'exclude']),
    summaries: z.enum(['inherit', 'exclude']),
    toolResults: z.enum(['inherit', 'exclude']),
    codeChanges: z.enum(['inherit', 'exclude']),
  })
  .strict();

export const AgentSessionInheritedContextMessageSchema = z
  .object({
    messageId: ContractIdentifierSchema,
    role: z.enum(['user', 'assistant']),
    parts: z.array(JsonValueSchema).min(1),
  })
  .strict();

export const AgentSessionUnavailableResourceSchema = z
  .object({
    messageId: ContractIdentifierSchema,
    kind: z.enum(['attachment', 'tool-result', 'code-change']),
    reason: z.enum(['excluded', 'unavailable', 'unsupported']),
  })
  .strict();

export const AgentSessionInheritedContextSchema = z
  .object({
    sourceThreadId: ContractIdentifierSchema,
    sourceMessageId: ContractIdentifierSchema,
    sourceRunId: ContractIdentifierSchema,
    messages: z.array(AgentSessionInheritedContextMessageSchema).max(24),
    summary: z.string().trim().min(1).optional(),
    unavailableResources: z.array(AgentSessionUnavailableResourceSchema).default([]),
    capturedAt: IsoDateTimeSchema,
  })
  .strict();

export const AgentSessionContinuationRequestSchema = z
  .object({
    contract: z.literal('AgentSessionContinuationRequest'),
    idempotencyKey: ContractIdentifierSchema,
    sourceMessageId: ContractIdentifierSchema,
    sourceRunId: ContractIdentifierSchema,
    inheritance: AgentSessionContextInheritanceSchema,
  })
  .strict();

export const AgentSessionContinuationResultSchema = z
  .object({
    contract: z.literal('AgentSessionContinuationResult'),
    idempotencyKey: ContractIdentifierSchema,
    threadId: ContractIdentifierSchema,
    lineage: AgentSessionLineageSchema,
    inheritance: AgentSessionContextInheritanceSchema,
    unavailableResources: z.array(AgentSessionUnavailableResourceSchema).default([]),
    duplicate: z.boolean(),
    createdAt: IsoDateTimeSchema,
  })
  .strict();

export const AgentSessionActiveBranchSchema = z
  .object({
    branchId: ContractIdentifierSchema,
    threadId: ContractIdentifierSchema,
    sourceMessageId: ContractIdentifierSchema,
    runId: ContractIdentifierSchema,
    lineage: AgentSessionLineageSchema.optional(),
    createdAt: IsoDateTimeSchema,
  })
  .strict();

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

export const AgentSessionCommandTypeSchema = z.enum([
  'stop',
  'resume',
  'retry',
  'retry-summary',
  'approval',
  'fork',
  'edit-and-rerun',
  'steer',
]);

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
  sessionCommand('retry-summary', {
    sourceEventId: ContractIdentifierSchema,
    sourceRunId: ContractIdentifierSchema,
  }),
  sessionCommand('approval', {
    approvalId: ContractIdentifierSchema,
    decision: z.enum(['approved', 'rejected']),
    reason: z.string().trim().min(1).optional(),
  }),
  sessionCommand('fork', {
    sourceThreadId: ContractIdentifierSchema,
    sourceMessageId: ContractIdentifierSchema,
    sourceRunId: ContractIdentifierSchema,
    inheritance: AgentSessionContextInheritanceSchema,
  }),
  sessionCommand('edit-and-rerun', {
    sourceThreadId: ContractIdentifierSchema,
    sourceMessageId: ContractIdentifierSchema,
    sourceRunId: ContractIdentifierSchema,
    replacementParts: z.array(JsonValueSchema).min(1),
    inheritance: AgentSessionContextInheritanceSchema,
  }),
  sessionCommand('steer', {
    targetRunId: ContractIdentifierSchema,
    text: z.string().trim().min(1),
  }),
]).superRefine((value, context) => {
  if (value.commandType === 'steer' && value.runId !== value.payload.targetRunId) {
    context.addIssue({
      code: 'custom',
      path: ['payload', 'targetRunId'],
      message: 'Steering targetRunId must match the command runId.',
    });
  }
  if (value.commandType === 'retry-summary' && value.runId !== value.payload.sourceRunId) {
    context.addIssue({
      code: 'custom',
      path: ['payload', 'sourceRunId'],
      message: 'Summary retry sourceRunId must match the command runId.',
    });
  }
});

export const AgentSessionTargetedCommandSchema = AgentSessionCommandSchema.and(
  z.object({ runId: ContractIdentifierSchema }),
);

export const AgentSessionCommandErrorCodeSchema = z.enum([
  'SESSION_NOT_FOUND',
  'RUN_NOT_FOUND',
  'ACTIVE_RUN_NOT_FOUND',
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
  'SOURCE_THREAD_NOT_FOUND',
  'SOURCE_MESSAGE_NOT_FOUND',
  'SOURCE_RUN_NOT_FOUND',
  'SOURCE_LINEAGE_INVALID',
  'ACTIVE_BRANCH_NOT_FOUND',
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
    operation: z
      .object({
        lineage: AgentSessionLineageSchema,
        activeBranch: AgentSessionActiveBranchSchema,
      })
      .strict()
      .optional(),
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
    if (value.operation && !value.operation.activeBranch.lineage) {
      context.addIssue({
        code: 'custom',
        path: ['operation', 'activeBranch', 'lineage'],
        message: 'A branch operation result requires lineage on its active branch.',
      });
    }
    const operation = value.operation;
    if (operation?.activeBranch.lineage) {
      const { lineage } = operation;
      const branchLineage = operation.activeBranch.lineage;
      if (
        lineage.forkedFromThreadId !== branchLineage.forkedFromThreadId ||
        lineage.forkedFromMessageId !== branchLineage.forkedFromMessageId ||
        lineage.sourceRunId !== branchLineage.sourceRunId
      ) {
        context.addIssue({
          code: 'custom',
          path: ['operation', 'activeBranch', 'lineage'],
          message: 'Active branch lineage must match the operation lineage.',
        });
      }
    }
    if (value.operation && value.runId !== value.operation.activeBranch.runId) {
      context.addIssue({
        code: 'custom',
        path: ['operation', 'activeBranch', 'runId'],
        message: 'Active branch runId must match the command result runId.',
      });
    }
  });

const AGENT_SESSION_COMMAND_TRANSITIONS: Record<AgentSessionCommandType, Partial<Record<AgentSessionStatus, AgentSessionStatus>>> = {
  stop: { queued: 'stopping', running: 'stopping', waiting_approval: 'stopping' },
  resume: { stopped: 'queued', completed: 'queued', failed: 'queued' },
  retry: { failed: 'queued' },
  'retry-summary': {},
  approval: { waiting_approval: 'running' },
  fork: {},
  'edit-and-rerun': {},
  steer: {},
};

export const AgentSessionCommandPolicySchema = z
  .object({
    capability: AgentSessionCapabilitySchema.optional(),
    allowedStatuses: z.array(AgentSessionStatusSchema).min(1),
    requiresRunId: z.boolean(),
    sourceSessionEffect: z.enum(['transition', 'preserve']),
    idempotencyScope: z.literal('session-command'),
    sequenceRule: z.enum(['match-current', 'target-run']),
  })
  .strict();

const sessionCommandPolicy = (policy: z.input<typeof AgentSessionCommandPolicySchema>) =>
  AgentSessionCommandPolicySchema.parse(policy);

export const AGENT_SESSION_COMMAND_POLICIES = Object.freeze({
  stop: sessionCommandPolicy({
    allowedStatuses: ['queued', 'running', 'waiting_approval'],
    requiresRunId: true,
    sourceSessionEffect: 'transition',
    idempotencyScope: 'session-command',
    sequenceRule: 'target-run',
  }),
  resume: sessionCommandPolicy({
    capability: 'resume',
    allowedStatuses: ['stopped', 'completed', 'failed'],
    requiresRunId: true,
    sourceSessionEffect: 'transition',
    idempotencyScope: 'session-command',
    sequenceRule: 'match-current',
  }),
  retry: sessionCommandPolicy({
    allowedStatuses: ['failed'],
    requiresRunId: true,
    sourceSessionEffect: 'transition',
    idempotencyScope: 'session-command',
    sequenceRule: 'match-current',
  }),
  'retry-summary': sessionCommandPolicy({
    capability: 'summary',
    allowedStatuses: ['stopped', 'completed', 'failed'],
    requiresRunId: true,
    sourceSessionEffect: 'preserve',
    idempotencyScope: 'session-command',
    sequenceRule: 'match-current',
  }),
  approval: sessionCommandPolicy({
    capability: 'approval',
    allowedStatuses: ['waiting_approval'],
    requiresRunId: true,
    sourceSessionEffect: 'transition',
    idempotencyScope: 'session-command',
    sequenceRule: 'match-current',
  }),
  fork: sessionCommandPolicy({
    capability: 'threadForking',
    allowedStatuses: AgentSessionStatusSchema.options,
    requiresRunId: false,
    sourceSessionEffect: 'preserve',
    idempotencyScope: 'session-command',
    sequenceRule: 'match-current',
  }),
  'edit-and-rerun': sessionCommandPolicy({
    capability: 'editAndRerun',
    allowedStatuses: ['stopped', 'completed', 'failed'],
    requiresRunId: false,
    sourceSessionEffect: 'preserve',
    idempotencyScope: 'session-command',
    sequenceRule: 'match-current',
  }),
  steer: sessionCommandPolicy({
    capability: 'steering',
    allowedStatuses: ['queued', 'running'],
    requiresRunId: true,
    sourceSessionEffect: 'preserve',
    idempotencyScope: 'session-command',
    sequenceRule: 'match-current',
  }),
}) satisfies Readonly<Record<AgentSessionCommandType, AgentSessionCommandPolicy>>;

export function getAgentSessionCommandPolicy(commandType: AgentSessionCommandType): AgentSessionCommandPolicy {
  return AGENT_SESSION_COMMAND_POLICIES[commandType];
}

export function canIssueAgentSessionCommand(
  status: AgentSessionStatus,
  commandType: AgentSessionCommandType,
): boolean {
  return getAgentSessionCommandPolicy(commandType).allowedStatuses.includes(status);
}

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
  sessionEvent('steer', {
    commandId: ContractIdentifierSchema,
    targetRunId: ContractIdentifierSchema,
    text: z.string().trim().min(1),
    status: z.enum(['accepted', 'applied', 'failed']),
    error: z
      .object({
        code: AgentSessionCommandErrorCodeSchema,
        message: z.string(),
        retryable: z.boolean(),
      })
      .strict()
      .optional(),
  }),
  sessionEvent('summary', {
    summaryId: ContractIdentifierSchema,
    runId: ContractIdentifierSchema,
    text: z.string(),
    highlights: z.array(z.string()),
    pendingItems: z.array(z.string()),
    status: z.enum(['generating', 'completed', 'failed']),
  }),
]).superRefine((value, context) => {
  if (value.eventType === 'steer') {
    if (value.runId !== value.payload.targetRunId) {
      context.addIssue({
        code: 'custom',
        path: ['payload', 'targetRunId'],
        message: 'Steering payload targetRunId must match the event runId.',
      });
    }
    const requiresError = value.payload.status === 'failed';
    if (requiresError !== Boolean(value.payload.error)) {
      context.addIssue({
        code: 'custom',
        path: ['payload', 'error'],
        message: requiresError
          ? 'Failed steering events require an error.'
          : 'Accepted and applied steering events must not contain an error.',
      });
    }
  }
  if (value.eventType === 'summary' && value.runId !== value.payload.runId) {
    context.addIssue({
      code: 'custom',
      path: ['payload', 'runId'],
      message: 'Summary payload runId must match the event runId.',
    });
  }
});

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
    lineage: AgentSessionLineageSchema.optional(),
    activeBranch: AgentSessionActiveBranchSchema.optional(),
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

export const AgentWorkbenchNavigationItemStatusSchema = z.enum(['idle', 'running', 'completed', 'error']);

export const AgentWorkbenchCollectionStatusSchema = z.enum(['loading', 'ready', 'error']);

export const AgentWorkbenchAgentItemSchema = z
  .object({
    id: ContractIdentifierSchema,
    name: z.string().min(1),
    description: z.string().optional(),
    iconUrl: z.string().url().optional(),
    builtIn: z.boolean().default(false),
    pinned: z.boolean().default(false),
    pinPending: z.boolean().default(false),
  })
  .strict();

export const AgentWorkbenchSessionItemSchema = z
  .object({
    id: ContractIdentifierSchema,
    title: z.string().min(1),
    updatedAt: IsoDateTimeSchema,
    thumbnailUrl: z.string().url().optional(),
    mode: AgentModeSchema.optional(),
    status: AgentWorkbenchNavigationItemStatusSchema.default('idle'),
    pinned: z.boolean().default(false),
    contextUsage: z
      .object({
        usedTokens: z.number().int().nonnegative(),
        maxTokens: z.number().int().positive(),
      })
      .strict()
      .optional(),
  })
  .strict();

export const AgentWorkbenchNavigationCapabilitiesSchema = z
  .object({
    createAgent: z.boolean().default(false),
    createSession: z.boolean().default(true),
    manageCapabilities: z.boolean().default(false),
    manageAgentSettings: z.boolean().default(false),
    pinAgents: z.boolean().default(false),
    pinSessions: z.boolean().default(false),
    renameSessions: z.boolean().default(false),
    deleteSessions: z.boolean().default(false),
  })
  .strict();

export const AgentWorkbenchNavigationViewModelSchema = z
  .object({
    contract: z.literal('AgentWorkbenchNavigationViewModel'),
    activeTab: z.enum(['agents', 'sessions']).default('sessions'),
    searchQuery: z.string().default(''),
    selectedAgentItem: ContractIdentifierSchema.optional(),
    selectedSessionItem: ContractIdentifierSchema.optional(),
    agents: z
      .object({
        status: AgentWorkbenchCollectionStatusSchema,
        items: z.array(AgentWorkbenchAgentItemSchema),
        error: z.string().optional(),
      })
      .strict(),
    sessions: z
      .object({
        status: AgentWorkbenchCollectionStatusSchema,
        items: z.array(AgentWorkbenchSessionItemSchema),
        error: z.string().optional(),
      })
      .strict(),
    capabilities: AgentWorkbenchNavigationCapabilitiesSchema,
  })
  .strict()
  .superRefine((value, context) => {
    const validateCollection = (
      collection: { status: 'loading' | 'ready' | 'error'; error?: string },
      path: 'agents' | 'sessions',
    ) => {
      if (collection.status === 'error' && !collection.error) {
        context.addIssue({
          code: 'custom',
          path: [path, 'error'],
          message: 'An error collection must include an error message.',
        });
      }
    };

    validateCollection(value.agents, 'agents');
    validateCollection(value.sessions, 'sessions');
  });

export const AgentWorkbenchComposerStatusSchema = z.enum([
  'idle',
  'loading',
  'streaming',
  'stopping',
  'error',
]);

export const AgentWorkbenchComposerAttachmentSchema = z
  .object({
    id: ContractIdentifierSchema,
    name: z.string().min(1),
    mediaType: z.string().min(1).optional(),
    previewUrl: z.string().min(1).optional(),
    status: z.enum(['uploading', 'ready', 'error']).default('ready'),
  })
  .strict();

export const AgentWorkbenchComposerQueueItemSchema = z
  .object({
    id: ContractIdentifierSchema,
    text: z.string(),
    attachmentCount: z.number().int().nonnegative().default(0),
    status: z.enum(['queued', 'sending', 'error']).default('queued'),
  })
  .strict();

export const AgentWorkbenchComposerInputActionIconSchema = z.enum([
  'file-text',
  'image',
]);

export const AgentWorkbenchComposerInputActionSchema = z
  .object({
    id: ContractIdentifierSchema,
    label: z.string().min(1),
    icon: AgentWorkbenchComposerInputActionIconSchema.optional(),
  })
  .strict();

export const AgentWorkbenchComposerModelOptionSchema = z
  .object({
    id: ContractIdentifierSchema,
    label: z.string().min(1),
    provider: z.string().min(1).optional(),
    mode: AgentModeSchema,
    disabled: z.boolean().default(false),
  })
  .strict();

export const AgentWorkbenchComposerCapabilitiesSchema = z
  .object({
    attachments: z.boolean().default(false),
    voiceInput: z.boolean().default(false),
    webSearch: z.boolean().default(false),
    modelSelection: z.boolean().default(false),
    reasoning: z.boolean().default(false),
    permissions: z.boolean().default(false),
    queue: z.boolean().default(false),
    stop: z.boolean().default(false),
  })
  .strict();

export const AgentWorkbenchQuickStartIconSchema = z.enum([
  'sparkles',
  'palette',
  'search',
  'file-text',
  'code',
  'shopping-bag',
]);

export const AgentWorkbenchQuickStartTemplateActionSchema = z.enum(['prompt', 'upload']);

export const AgentWorkbenchQuickStartTemplateSchema = z
  .object({
    id: ContractIdentifierSchema,
    title: z.string().min(1),
    description: z.string().min(1).optional(),
    prompt: z.string().min(1),
    action: AgentWorkbenchQuickStartTemplateActionSchema.default('prompt'),
    icon: AgentWorkbenchQuickStartIconSchema.optional(),
    coverImageUrl: z.string().min(1).optional(),
    accept: z.string().min(1).default('*/*'),
    multiple: z.boolean().default(false),
    modes: z.array(AgentModeSchema).min(1).optional(),
  })
  .strict();

export const AgentWorkbenchQuickStartSectionSchema = z
  .object({
    id: ContractIdentifierSchema,
    label: z.string().min(1),
    templates: z.array(AgentWorkbenchQuickStartTemplateSchema).min(1),
  })
  .strict();

export const AgentWorkbenchQuickStartCategorySchema = z
  .object({
    id: ContractIdentifierSchema,
    label: z.string().min(1),
    icon: AgentWorkbenchQuickStartIconSchema.optional(),
    sections: z.array(AgentWorkbenchQuickStartSectionSchema).min(1),
  })
  .strict();

export const AgentWorkbenchSidebarNavigationModeSchema = z.enum(['default', 'session', 'trend']);

export const AgentWorkbenchSidebarSectionSchema = z.enum([
  'header',
  'search',
  'new-session',
  'sessions',
  'agents',
  'groups',
  'footer',
]);

export const AgentWorkbenchSidebarGroupItemSchema = z
  .object({
    id: ContractIdentifierSchema,
    title: z.string().trim().min(1).max(120),
    subtitle: z.string().trim().min(1).max(240).optional(),
    imageUrl: z.string().trim().min(1).max(2048).optional(),
    prompt: z.string().trim().min(1).max(10_000),
    mediaVariant: z.enum(['cover', 'cover-with-label', 'logo']).optional(),
    mediaTreatment: z.enum(['preserve', 'monochrome-light', 'invert']).optional(),
  })
  .strict();

export const AgentWorkbenchSidebarGroupSchema = z
  .object({
    id: ContractIdentifierSchema,
    label: z.string().trim().min(1).max(120),
    items: z.array(AgentWorkbenchSidebarGroupItemSchema).min(1).max(50),
    itemAspectRatio: z.number().positive().max(10).optional(),
  })
  .strict();

export const AgentWorkbenchSidebarConfigSchema = z
  .object({
    navigationMode: AgentWorkbenchSidebarNavigationModeSchema.optional(),
    defaultOpen: z.boolean().optional(),
    /** Initial sidebar width as a percentage of the workbench split pane. */
    widthPercent: z.number().int().min(10).max(40).optional(),
    visibleSections: z.array(AgentWorkbenchSidebarSectionSchema).min(1).max(7).optional(),
    groups: z.array(AgentWorkbenchSidebarGroupSchema).max(20).optional(),
    defaultGroupId: ContractIdentifierSchema.optional(),
    quickStartEnabled: z.boolean().optional(),
    quickStartCategories: z.array(AgentWorkbenchQuickStartCategorySchema).max(20).optional(),
    trendEntryEnabled: z.boolean().optional(),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.visibleSections && new Set(value.visibleSections).size !== value.visibleSections.length) {
      context.addIssue({
        code: 'custom',
        path: ['visibleSections'],
        message: 'Sidebar sections must be unique.',
      });
    }
    if (value.defaultGroupId && !value.groups?.some((group) => group.id === value.defaultGroupId)) {
      context.addIssue({
        code: 'custom',
        path: ['defaultGroupId'],
        message: 'The default sidebar group must exist in groups.',
      });
    }
  });

export const DEFAULT_AGENT_WORKBENCH_SIDEBAR_SECTIONS = Object.freeze([
  'header',
  'search',
  'new-session',
  'sessions',
  'agents',
  'groups',
  'footer',
] as const);

export interface AgentWorkbenchSidebarLegacyConfig {
  navigationMode?: AgentWorkbenchSidebarNavigationMode;
  quickStartEnabled?: boolean;
}

export function resolveAgentWorkbenchSidebarConfig(
  config?: AgentWorkbenchSidebarConfig,
  legacy: AgentWorkbenchSidebarLegacyConfig = {},
): ResolvedAgentWorkbenchSidebarConfig {
  const parsed = AgentWorkbenchSidebarConfigSchema.parse(config ?? {});
  const navigationMode = parsed.navigationMode ?? legacy.navigationMode ?? 'default';
  return {
    ...parsed,
    navigationMode,
    defaultOpen: parsed.defaultOpen ?? true,
    widthPercent: parsed.widthPercent ?? 18,
    visibleSections: parsed.visibleSections ?? [...DEFAULT_AGENT_WORKBENCH_SIDEBAR_SECTIONS],
    groups: parsed.groups ?? [],
    quickStartEnabled: parsed.quickStartEnabled ?? legacy.quickStartEnabled ?? false,
    trendEntryEnabled: parsed.trendEntryEnabled ?? navigationMode === 'trend',
  };
}

export const AgentWorkbenchQuickStartViewModelSchema = z
  .object({
    contract: z.literal('AgentWorkbenchQuickStartViewModel'),
    mode: AgentModeSchema,
    categories: z.array(AgentWorkbenchQuickStartCategorySchema).min(1),
    disabled: z.boolean().default(false),
  })
  .strict();

export const AgentWorkbenchComposerViewModelSchema = z
  .object({
    contract: z.literal('AgentWorkbenchComposerViewModel'),
    value: z.string().default(''),
    status: AgentWorkbenchComposerStatusSchema.default('idle'),
    mode: AgentModeSchema,
    placeholder: z.string().optional(),
    attachments: z.array(AgentWorkbenchComposerAttachmentSchema).default([]),
    queuedDrafts: z.array(AgentWorkbenchComposerQueueItemSchema).default([]),
    inputActions: z.array(AgentWorkbenchComposerInputActionSchema).default([]),
    selectedInputActionId: ContractIdentifierSchema.optional(),
    model: z
      .object({
        selectedId: ContractIdentifierSchema.optional(),
        options: z.array(AgentWorkbenchComposerModelOptionSchema),
      })
      .strict(),
    reasoning: z
      .object({
        value: z.enum(['low', 'medium', 'high', 'xhigh']),
        options: z.array(z.enum(['low', 'medium', 'high', 'xhigh'])).min(1),
      })
      .strict()
      .optional(),
    permissionProfile: AgentSessionPermissionProfileSchema.optional(),
    webSearchEnabled: z.boolean().default(false),
    error: z.string().optional(),
    capabilities: AgentWorkbenchComposerCapabilitiesSchema,
  })
  .strict()
  .superRefine((value, context) => {
    if (value.status === 'error' && !value.error) {
      context.addIssue({
        code: 'custom',
        path: ['error'],
        message: 'An error composer must include an error message.',
      });
    }
    if (value.model.selectedId && !value.model.options.some((option) => option.id === value.model.selectedId)) {
      context.addIssue({
        code: 'custom',
        path: ['model', 'selectedId'],
        message: 'The selected model must exist in model options.',
      });
    }
  });

export type StudioAgentMode = z.infer<typeof StudioAgentModeSchema>;
/** @deprecated Use StudioAgentMode. */
export type AgentMode = StudioAgentMode;
export type AgentConfigurationCapability = z.infer<typeof AgentConfigurationCapabilitySchema>;
export type AgentModeCapabilities = z.infer<typeof AgentModeCapabilitiesSchema>;
export type AgentResourceModeSupport = z.infer<typeof AgentResourceModeSupportSchema>;
export type AgentSessionCapability = z.infer<typeof AgentSessionCapabilitySchema>;
export type AgentSessionCapabilities = z.infer<typeof AgentSessionCapabilitiesSchema>;
export type AgentSessionPermissionProfile = z.infer<typeof AgentSessionPermissionProfileSchema>;
export type AgentSessionSnapshot = z.infer<typeof AgentSessionSnapshotSchema>;
export type AgentSessionStatus = z.infer<typeof AgentSessionStatusSchema>;
export type AgentSessionTerminalStatus = z.infer<typeof AgentSessionTerminalStatusSchema>;
export type AgentSessionLineage = z.infer<typeof AgentSessionLineageSchema>;
export type AgentSessionContextInheritance = z.infer<typeof AgentSessionContextInheritanceSchema>;
export type AgentSessionInheritedContextMessage = z.infer<typeof AgentSessionInheritedContextMessageSchema>;
export type AgentSessionUnavailableResource = z.infer<typeof AgentSessionUnavailableResourceSchema>;
export type AgentSessionInheritedContext = z.infer<typeof AgentSessionInheritedContextSchema>;
export type AgentSessionContinuationRequest = z.infer<typeof AgentSessionContinuationRequestSchema>;
export type AgentSessionContinuationResult = z.infer<typeof AgentSessionContinuationResultSchema>;
export type AgentSessionActiveBranch = z.infer<typeof AgentSessionActiveBranchSchema>;
export type AgentSessionRun = z.infer<typeof AgentSessionRunSchema>;
export type AgentSessionCommandType = z.infer<typeof AgentSessionCommandTypeSchema>;
export type AgentSessionCommand = z.infer<typeof AgentSessionCommandSchema>;
export type AgentSessionTargetedCommand = z.infer<typeof AgentSessionTargetedCommandSchema>;
export type AgentSessionCommandErrorCode = z.infer<typeof AgentSessionCommandErrorCodeSchema>;
export type AgentSessionCommandResult = z.infer<typeof AgentSessionCommandResultSchema>;
export type AgentSessionCommandPolicy = z.infer<typeof AgentSessionCommandPolicySchema>;
export type AgentSessionEvent = z.infer<typeof AgentSessionEventSchema>;
export type AgentSessionRunEvent = z.infer<typeof AgentSessionRunEventSchema>;
export type AgentSessionViewModel = z.infer<typeof AgentSessionViewModelSchema>;
export type AgentWorkbenchNavigationItemStatus = z.infer<typeof AgentWorkbenchNavigationItemStatusSchema>;
export type AgentWorkbenchCollectionStatus = z.infer<typeof AgentWorkbenchCollectionStatusSchema>;
export type AgentWorkbenchAgentItem = z.infer<typeof AgentWorkbenchAgentItemSchema>;
export type AgentWorkbenchSessionItem = z.infer<typeof AgentWorkbenchSessionItemSchema>;
export type AgentWorkbenchNavigationCapabilities = z.infer<typeof AgentWorkbenchNavigationCapabilitiesSchema>;
export type AgentWorkbenchNavigationViewModel = z.infer<typeof AgentWorkbenchNavigationViewModelSchema>;
export type AgentWorkbenchComposerStatus = z.infer<typeof AgentWorkbenchComposerStatusSchema>;
export type AgentWorkbenchComposerAttachment = z.infer<typeof AgentWorkbenchComposerAttachmentSchema>;
export type AgentWorkbenchComposerQueueItem = z.infer<typeof AgentWorkbenchComposerQueueItemSchema>;
export type AgentWorkbenchComposerModelOption = z.infer<typeof AgentWorkbenchComposerModelOptionSchema>;
export type AgentWorkbenchComposerCapabilities = z.infer<typeof AgentWorkbenchComposerCapabilitiesSchema>;
export type AgentWorkbenchComposerInputAction = z.infer<typeof AgentWorkbenchComposerInputActionSchema>;
export type AgentWorkbenchComposerViewModel = z.infer<typeof AgentWorkbenchComposerViewModelSchema>;
export type AgentWorkbenchQuickStartIcon = z.infer<typeof AgentWorkbenchQuickStartIconSchema>;
export type AgentWorkbenchQuickStartTemplateAction = z.infer<typeof AgentWorkbenchQuickStartTemplateActionSchema>;
export type AgentWorkbenchQuickStartTemplate = z.infer<typeof AgentWorkbenchQuickStartTemplateSchema>;
export type AgentWorkbenchQuickStartSection = z.infer<typeof AgentWorkbenchQuickStartSectionSchema>;
export type AgentWorkbenchQuickStartCategory = z.infer<typeof AgentWorkbenchQuickStartCategorySchema>;
export type AgentWorkbenchQuickStartViewModel = z.infer<typeof AgentWorkbenchQuickStartViewModelSchema>;
export type AgentWorkbenchSidebarNavigationMode = z.infer<typeof AgentWorkbenchSidebarNavigationModeSchema>;
export type AgentWorkbenchSidebarSection = z.infer<typeof AgentWorkbenchSidebarSectionSchema>;
export type AgentWorkbenchSidebarGroupItem = z.infer<typeof AgentWorkbenchSidebarGroupItemSchema>;
export type AgentWorkbenchSidebarGroup = z.infer<typeof AgentWorkbenchSidebarGroupSchema>;
export type AgentWorkbenchSidebarConfig = z.infer<typeof AgentWorkbenchSidebarConfigSchema>;
export type ResolvedAgentWorkbenchSidebarConfig = AgentWorkbenchSidebarConfig & {
  navigationMode: AgentWorkbenchSidebarNavigationMode;
  defaultOpen: boolean;
  widthPercent: number;
  visibleSections: AgentWorkbenchSidebarSection[];
  groups: AgentWorkbenchSidebarGroup[];
  quickStartEnabled: boolean;
  trendEntryEnabled: boolean;
};

// Kept as a source-compatible type alias while consumers move to the product-level name.
export const AgentExecutionModeSchema = AgentModeSchema;
export type AgentExecutionMode = AgentMode;

export function normalizeStudioAgentMode(value: unknown): StudioAgentMode | undefined {
  const normalized = String(value ?? '')
    .trim()
    .toLowerCase();
  if (normalized === 'work' || normalized === 'agent' || normalized === 'codex') return 'work';
  if (normalized === 'chat' || normalized === 'chatbot' || normalized === 'vercel-ai' || normalized === 'vercel' || normalized === 'ai-sdk') {
    return 'chat';
  }
  return undefined;
}

/** @deprecated Use normalizeStudioAgentMode. */
export const normalizeAgentMode = normalizeStudioAgentMode;
export const normalizeAgentExecutionMode = normalizeStudioAgentMode;
