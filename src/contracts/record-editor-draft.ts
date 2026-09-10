import { z } from 'zod';
import { JsonObjectSchema, JsonValueSchema } from './common';

const member = z.string().min(1).max(256).refine((value) => !['__proto__', 'prototype', 'constructor'].includes(value), 'Unsafe editor path.');
export const RecordEditorPathSchema = z.array(z.union([member, z.object({ itemId: z.string().min(1).max(256), idKey: member.default('id') }).strict()])).max(32);
export const RecordEditorFieldErrorSchema = z.object({ path: RecordEditorPathSchema, code: z.string().min(1).max(256) }).strict();
/** Only non-sensitive document values belong in a draft. Secret replacements remain component-local. */
export const RecordEditorDraftSchema = z.object({
  revision: z.string().min(1).max(256),
  original: JsonObjectSchema,
  value: JsonObjectSchema,
  touched: z.array(RecordEditorPathSchema).max(4096),
  errors: z.array(RecordEditorFieldErrorSchema).max(4096),
}).strict();
export const RecordEditorDraftOperationSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('set'), path: RecordEditorPathSchema, value: JsonValueSchema }).strict(),
  z.object({ kind: z.literal('touch'), path: RecordEditorPathSchema }).strict(),
  z.object({ kind: z.literal('reset'), revision: z.string().min(1).max(256), value: JsonObjectSchema }).strict(),
  z.object({ kind: z.literal('insert'), path: RecordEditorPathSchema, idKey: member.default('id'), value: JsonObjectSchema, beforeId: z.string().min(1).optional() }).strict(),
  z.object({ kind: z.literal('remove'), path: RecordEditorPathSchema, idKey: member.default('id'), itemId: z.string().min(1) }).strict(),
  z.object({ kind: z.literal('move'), path: RecordEditorPathSchema, idKey: member.default('id'), itemId: z.string().min(1), beforeId: z.string().min(1).optional() }).strict(),
]);
export type RecordEditorPath = z.infer<typeof RecordEditorPathSchema>;
export type RecordEditorDraft = z.infer<typeof RecordEditorDraftSchema>;
export type RecordEditorDraftOperation = z.infer<typeof RecordEditorDraftOperationSchema>;
export type RecordEditorFieldError = z.infer<typeof RecordEditorFieldErrorSchema>;

/** Safe Action diagnostics: paths and localization codes only, never submitted values. */
export const RecordEditorValidationDetailsSchema = z.object({
  contract: z.literal('RecordEditorValidation'),
  schemaVersion: z.literal(1),
  errors: z.array(RecordEditorFieldErrorSchema).min(1).max(256),
}).strict();
export const RecordEditorSubmissionSnapshotSchema = z.object({
  revision: z.string().min(1).max(256),
  value: JsonObjectSchema,
}).strict();
export type RecordEditorSubmissionSnapshot = z.infer<typeof RecordEditorSubmissionSnapshotSchema>;
