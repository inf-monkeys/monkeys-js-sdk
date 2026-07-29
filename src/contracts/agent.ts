import { z } from 'zod';
import { ContractIdentifierSchema, IsoDateTimeSchema, JsonObjectSchema, JsonValueSchema } from './common';

export const AgentModeSchema = z.enum(['chatbot', 'agent']);

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

export const AgentSessionCommandTypeSchema = z.enum(['stop', 'resume', 'retry', 'approval']);

const AgentSessionCommandHeaderSchema = z
  .object({
    contract: z.literal('AgentSessionCommand'),
    commandId: ContractIdentifierSchema,
    sessionId: ContractIdentifierSchema,
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

export const AgentSessionCommandErrorCodeSchema = z.enum([
  'SESSION_NOT_FOUND',
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
    idempotencyKey: ContractIdentifierSchema,
    outcome: z.enum(['accepted', 'duplicate', 'rejected', 'failed']),
    sessionStatus: AgentSessionStatusSchema,
    acceptedSequence: z.number().int().nonnegative().optional(),
    resultEventIds: z.array(ContractIdentifierSchema).default([]),
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

const AgentSessionEventHeaderSchema = z
  .object({
    contract: z.literal('AgentSessionEvent'),
    eventId: ContractIdentifierSchema,
    sessionId: ContractIdentifierSchema,
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
export type AgentSessionCapability = z.infer<typeof AgentSessionCapabilitySchema>;
export type AgentSessionCapabilities = z.infer<typeof AgentSessionCapabilitiesSchema>;
export type AgentSessionSnapshot = z.infer<typeof AgentSessionSnapshotSchema>;
export type AgentSessionStatus = z.infer<typeof AgentSessionStatusSchema>;
export type AgentSessionCommandType = z.infer<typeof AgentSessionCommandTypeSchema>;
export type AgentSessionCommand = z.infer<typeof AgentSessionCommandSchema>;
export type AgentSessionCommandErrorCode = z.infer<typeof AgentSessionCommandErrorCodeSchema>;
export type AgentSessionCommandResult = z.infer<typeof AgentSessionCommandResultSchema>;
export type AgentSessionEvent = z.infer<typeof AgentSessionEventSchema>;
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
