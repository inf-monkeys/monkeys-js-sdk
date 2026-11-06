import { z } from 'zod';
import { ContractIdentifierSchema, IsoDateTimeSchema, JsonObjectSchema, JsonValueSchema } from './common';

const id = ContractIdentifierSchema;

/** Verified provenance. Transport credentials never belong in durable data. */
export const AgentDataOriginSchema = z.object({
  version: z.literal(1),
  tenantId: id,
  teamId: id,
  threadId: id,
  userId: id,
  actorId: id,
  runId: id.optional(),
  messageId: id.optional(),
  epoch: z.number().int().positive().optional(),
}).strict();

export const AgentDataOperationContextSchema = z.object({
  origin: AgentDataOriginSchema,
  operationId: id,
  resultScope: z.object({ ontologyId: id, assetIds: z.array(id).min(1).max(64) }).strict().optional(),
}).strict();
export type AgentDataOperationContext = z.infer<typeof AgentDataOperationContextSchema>;

export const AgentDataSourceSchema = z.object({
  teamId: id,
  ontologyId: id,
  viewId: id.optional(),
  viewRevision: z.number().int().positive().optional(),
  viewContentHash: z.string().regex(/^[a-f0-9]{64}$/).optional(),
}).strict();

export const AgentDataQueryOperationSchema = z.enum([
  'data.asset.list',
  'data.asset.search',
  'data.asset.searchAdvanced',
  'data.asset.searchGroupedTags',
  'data.asset.aggregate',
  'data.view.rows',
  'data.view.sample',
  'agent.view.legacy',
]);

/** A bounded selection from an existing native View query. Tag groups retain native DNF semantics. */
export const AgentDataViewQuerySchema = z.object({
  ontologyId: id, viewId: id.optional(), name: z.string().max(512).optional(), tagGroups: z.array(z.array(id).max(64)).max(64).optional(),
  pageSize: z.number().int().min(1).max(1000).default(50), pageToken: z.string().max(32768).optional(),
  priorityTagIds: z.array(id).max(500).optional(),
  sample: z.object({ size: z.number().int().min(1).max(200), poolSize: z.number().int().min(1).max(2000), seed: z.string().min(1).max(256), requireImage: z.boolean().default(true) }).strict().optional(),
}).strict();
export type AgentDataViewQuery = z.infer<typeof AgentDataViewQuerySchema>;

/** The registered operation owns parameter validation and query semantics. */
const parameters = JsonObjectSchema.superRefine((value, context) => {
  for (const key of ['pageToken', 'cursor', 'authorization', 'headers', 'accessToken', 'cookie']) {
    if (key in value) context.addIssue({ code: 'custom', path: [key], message: 'Transport state cannot be stored in a view definition.' });
  }
  if (JSON.stringify(value).length > 131072) context.addIssue({ code: 'custom', message: 'View parameters exceed 128 KiB.' });
});

export const AgentDataRecordRefSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('asset'), id, teamId: id, ontologyId: id, version: z.union([z.string().min(1), z.number().int().nonnegative()]).optional() }).strict(),
  z.object({ kind: z.literal('file'), id, teamId: id, version: z.number().int().nonnegative().optional() }).strict(),
  z.object({ kind: z.literal('domain-record'), id, teamId: id, contract: id, version: z.number().int().positive().optional() }).strict(),
]);

export const AgentDataSelectionSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('query'),
    operation: AgentDataQueryOperationSchema,
    source: AgentDataSourceSchema,
    parameters,
  }).strict(),
  z.object({
    kind: z.literal('results'),
    resultSetId: id,
    /** Bounded receipt page; the materializer preserves the complete set across pages. */
    members: z.array(AgentDataRecordRefSchema).max(500),
    complete: z.boolean(),
    query: z.object({ operation: AgentDataQueryOperationSchema, source: AgentDataSourceSchema, parameters }).strict().optional(),
  }).strict(),
]);

export const AgentDataStatusSchema = z.enum(['running', 'completed', 'failed', 'partial', 'cancelled']);

/** One replayable effect of a logical operation; phase keys deduplicate transport retries. */
export const AgentDataReceiptSchema = z.object({
  contract: z.literal('AgentDataReceipt'),
  version: z.literal(1),
  operationId: id,
  phaseId: id.optional(),
  origin: AgentDataOriginSchema,
  kind: z.enum(['query', 'generated']),
  selection: AgentDataSelectionSchema,
  status: AgentDataStatusSchema,
  title: z.string().max(500).optional(),
  occurredAt: IsoDateTimeSchema,
  result: z.object({
    returned: z.number().int().nonnegative(),
    total: z.number().int().nonnegative().optional(),
    hasMore: z.boolean().optional(),
    errorCode: z.string().regex(/^[A-Z][A-Z0-9_]{0,127}$/).optional(),
  }).strict(),
  sourceCommit: id.optional(),
}).strict();

/** Small read model for the artifact popover. Opening resolves the selection separately. */
export const AgentLinkedDataItemSchema = z.object({
  id,
  threadId: id,
  operationId: id,
  kind: z.enum(['query', 'generated']),
  status: AgentDataStatusSchema,
  title: z.string().max(500),
  occurredAt: IsoDateTimeSchema,
  returned: z.number().int().nonnegative(),
  total: z.number().int().nonnegative().optional(),
  source: AgentDataSourceSchema.optional(),
  runId: id.optional(),
  messageId: id.optional(),
}).strict();

/** Ephemeral, authorized projection of a canonical source record. */
export const AgentLinkedDataRowSchema = z.object({
  id,
  reference: AgentDataRecordRefSchema.optional(),
  openToken: z.string().max(8192).optional(),
  viewer: z.enum(['record', 'file', 'session-canvas']).optional(),
  title: z.string(),
  availability: z.enum(['ready', 'unavailable']),
  previewUrl: z.string().optional(),
  mimeType: z.string().optional(),
  fields: z.array(z.object({ id, label: z.string(), labelKey: z.string().optional(), value: JsonValueSchema }).strict()).max(200),
}).strict();

export const AgentLinkedDataPageInfoSchema = z.object({
  pageSize: z.number().int().positive().max(100), returned: z.number().int().nonnegative().max(100),
  hasMore: z.boolean(), nextPageToken: z.string().optional(), total: z.number().int().nonnegative().optional(),
}).strict();

export const AgentLinkedDataListSchema = z.object({ items: z.array(AgentLinkedDataItemSchema).max(100), pageInfo: AgentLinkedDataPageInfoSchema }).strict();
export const AgentLinkedDataPageSchema = z.object({
  contract: z.literal('AgentLinkedDataPage'), version: z.literal(1), view: AgentLinkedDataItemSchema,
  semantics: z.enum(['live-query', 'fixed-results']), items: z.array(AgentLinkedDataRowSchema).max(100), pageInfo: AgentLinkedDataPageInfoSchema,
}).strict();
export type AgentLinkedDataRow = z.infer<typeof AgentLinkedDataRowSchema>;
export type AgentLinkedDataPage = z.infer<typeof AgentLinkedDataPageSchema>;
export type AgentLinkedDataList = z.infer<typeof AgentLinkedDataListSchema>;

export type AgentDataOrigin = z.infer<typeof AgentDataOriginSchema>;
export type AgentDataSource = z.infer<typeof AgentDataSourceSchema>;
export type AgentDataQueryOperation = z.infer<typeof AgentDataQueryOperationSchema>;
export type AgentDataRecordRef = z.infer<typeof AgentDataRecordRefSchema>;
export type AgentDataSelection = z.infer<typeof AgentDataSelectionSchema>;
export type AgentDataReceipt = z.infer<typeof AgentDataReceiptSchema>;
export type AgentLinkedDataItem = z.infer<typeof AgentLinkedDataItemSchema>;

export const AGENT_DATA_CONTEXT_HEADER = 'x-monkeys-agent-context';
export const AGENT_DATA_OPERATION_HEADER = 'x-monkeys-agent-operation';
export const AGENT_DATA_CONTEXT_ENV = 'MONKEYS_AGENT_CONTEXT';
export const AGENT_DATA_CONTEXT_FILE_ENV = 'MONKEYS_AGENT_CONTEXT_FILE';
