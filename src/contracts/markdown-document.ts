import { z } from 'zod';
import { ContractIdentifierSchema, IsoDateTimeSchema, Sha256Schema } from './common';
import { ManagedFileUriSchema } from './file';

export const MARKDOWN_DOCUMENT_MAX_BYTES = 2 * 1024 * 1024;
export const MarkdownDocumentSourceSchema = z.object({
  agentId: ContractIdentifierSchema,
  threadId: ContractIdentifierSchema,
  artifactId: z.string().min(1).max(512),
  fileUri: ManagedFileUriSchema,
}).strict();

export const MarkdownDocumentFileSchema = z.object({
  uri: ManagedFileUriSchema,
  sha256: Sha256Schema,
  byteSize: z.number().int().nonnegative().max(MARKDOWN_DOCUMENT_MAX_BYTES),
}).strict();

/** Persisted content is an immutable managed file; editor values never enter this record. */
export const MarkdownDocumentRecordSchema = z.object({
  contract: z.literal('MarkdownDocument'),
  schemaVersion: z.literal(1),
  documentId: ContractIdentifierSchema,
  source: MarkdownDocumentSourceSchema,
  file: MarkdownDocumentFileSchema,
  resources: z.array(ManagedFileUriSchema).max(1000),
}).strict().superRefine((value, context) => {
  if (new Set(value.resources).size !== value.resources.length)
    context.addIssue({ code: 'custom', path: ['resources'], message: 'Document resource references must be unique.' });
});

export const MarkdownDocumentSaveSchema = z.object({
  source: MarkdownDocumentSourceSchema,
  contentFileUri: ManagedFileUriSchema,
  expectedHeadCommitId: z.string().max(128),
  requestId: ContractIdentifierSchema,
}).strict();

export const MarkdownDocumentRestoreSchema = z.object({
  source: MarkdownDocumentSourceSchema,
  targetCommitId: ContractIdentifierSchema,
  expectedHeadCommitId: ContractIdentifierSchema,
  requestId: ContractIdentifierSchema,
}).strict();

export const MarkdownDocumentPolicySchema = z.object({
  autoSave: z.boolean(),
  idleMs: z.number().int().min(1000).max(30000),
  maxWaitMs: z.number().int().min(1000).max(120000),
}).strict().superRefine((value, context) => {
  if (value.maxWaitMs < value.idleMs)
    context.addIssue({ code: 'custom', path: ['maxWaitMs'], message: 'Maximum save wait must include the idle interval.' });
});

export const MarkdownDocumentViewSchema = z.object({
  documentId: ContractIdentifierSchema,
  name: z.string().min(1).max(500),
  source: MarkdownDocumentSourceSchema,
  record: MarkdownDocumentRecordSchema.nullable(),
  headCommitId: z.string().max(128),
  savedAt: IsoDateTimeSchema.nullable(),
  canEdit: z.boolean(),
  maxBytes: z.number().int().positive().max(MARKDOWN_DOCUMENT_MAX_BYTES),
}).strict();

export const MarkdownDocumentVersionSchema = z.object({
  commitId: ContractIdentifierSchema,
  createdAt: IsoDateTimeSchema,
  actorId: z.string().max(256),
  operation: z.enum(['save', 'restore']),
  record: MarkdownDocumentRecordSchema,
}).strict();

export const MarkdownDocumentHistoryQuerySchema = z.object({
  source: MarkdownDocumentSourceSchema,
  pageSize: z.number().int().min(1).max(50),
  pageToken: z.string().max(4096).optional(),
}).strict();
export const MarkdownDocumentHistorySchema = z.object({
  items: z.array(MarkdownDocumentVersionSchema).max(50),
  nextPageToken: z.string().max(4096).nullable(),
}).strict();
export const MarkdownDocumentReceiptSchema = z.object({
  commitId: ContractIdentifierSchema,
  file: MarkdownDocumentFileSchema,
  savedAt: IsoDateTimeSchema,
}).strict();
export const MarkdownDocumentWorkspaceQuerySchema = z.object({ source: MarkdownDocumentSourceSchema, receiptRequestId: z.string().max(256).default('') }).strict();
export const MarkdownDocumentWorkspaceSchema = z.object({
  document: MarkdownDocumentViewSchema,
  history: MarkdownDocumentHistorySchema,
  receipt: MarkdownDocumentReceiptSchema.nullable(),
}).strict();

export const MarkdownDocumentSaveResultSchema = z.object({
  view: MarkdownDocumentViewSchema,
  receipt: MarkdownDocumentReceiptSchema,
}).strict();

export const MarkdownDocumentErrorCodeSchema = z.enum([
  'MARKDOWN_DOCUMENT_FORBIDDEN', 'MARKDOWN_DOCUMENT_SOURCE_UNAVAILABLE', 'MARKDOWN_DOCUMENT_INVALID',
  'MARKDOWN_DOCUMENT_TOO_LARGE', 'MARKDOWN_DOCUMENT_RESOURCE_UNAVAILABLE', 'MARKDOWN_DOCUMENT_CONFLICT',
  'MARKDOWN_DOCUMENT_REQUEST_REUSED', 'MARKDOWN_DOCUMENT_SAVE_UNCONFIRMED', 'MARKDOWN_DOCUMENT_UNAVAILABLE',
]);
export type MarkdownDocumentSource = z.infer<typeof MarkdownDocumentSourceSchema>;
export type MarkdownDocumentFile = z.infer<typeof MarkdownDocumentFileSchema>;
export type MarkdownDocumentRecord = z.infer<typeof MarkdownDocumentRecordSchema>;
export type MarkdownDocumentSave = z.infer<typeof MarkdownDocumentSaveSchema>;
export type MarkdownDocumentRestore = z.infer<typeof MarkdownDocumentRestoreSchema>;
export type MarkdownDocumentPolicy = z.infer<typeof MarkdownDocumentPolicySchema>;
export type MarkdownDocumentView = z.infer<typeof MarkdownDocumentViewSchema>;
export type MarkdownDocumentVersion = z.infer<typeof MarkdownDocumentVersionSchema>;
export type MarkdownDocumentHistoryQuery = z.infer<typeof MarkdownDocumentHistoryQuerySchema>;
export type MarkdownDocumentHistory = z.infer<typeof MarkdownDocumentHistorySchema>;
export type MarkdownDocumentWorkspaceQuery = z.infer<typeof MarkdownDocumentWorkspaceQuerySchema>;
export type MarkdownDocumentWorkspace = z.infer<typeof MarkdownDocumentWorkspaceSchema>;
export type MarkdownDocumentSaveResult = z.infer<typeof MarkdownDocumentSaveResultSchema>;
export type MarkdownDocumentErrorCode = z.infer<typeof MarkdownDocumentErrorCodeSchema>;
