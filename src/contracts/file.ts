import { z } from 'zod';
import { ContractIdentifierSchema, IsoDateTimeSchema, JsonObjectSchema, Sha256Schema } from './common';

export const FILE_PURPOSES = [
  'uploads',
  'agent-attachments',
  'agent-artifacts',
  'agent-edited-images',
  'agent-workbench',
  'asset-screenshots',
  'data-exports',
  'data-feature-media',
  'design-assets',
  'design-board-thumbnails',
  'design-images',
  'dev-agent-reference-images',
  'dev-agent-review-artifacts',
  'external-delivery-techpacks',
  'llm-generated-images',
  'media-generated',
  'media-uploads',
  'model-training-files',
  'models',
  'models-checkpoints',
  'models-clip',
  'models-controlnet',
  'models-diffusion-models',
  'models-loras-test',
  'models-vae',
  'output-images',
  'plugin-data-imports',
  'plugin-runtime',
  'plugin-runtime-outputs',
  'step-thumbnails',
  'techpack-design-intent',
  'user-files-base',
  'user-files-design-board-background',
  'user-files-design-project-cover',
  'user-files-designs',
  'user-files-icons',
  'user-files-import-comfyui-image',
  'user-files-import-comfyui-json',
  'user-files-import-comfyui-json-url',
  'user-files-instruction-input',
  'user-files-linesheet',
  'user-files-media',
  'user-files-other',
  'user-files-prompt-assistant',
  'user-files-table-data',
  'user-files-techpack-attachments',
  'user-files-text-data-file',
  'user-files-workflow-input',
  'workflow-image-mask',
  'workflow-image-overlay',
  'workflow-import',
] as const;

export const FilePurposeSchema = z.enum(FILE_PURPOSES);

export const FileStatusSchema = z.enum(['pending', 'ready', 'failed', 'deleted']);
export const FileVariantStatusSchema = z.enum(['queued', 'processing', 'ready', 'failed']);

export const FILE_USAGE_OWNER_TYPES = [
  'data-asset',
  'data-export',
  'design-board',
  'external-delivery',
  'kernel-runtime',
  'llm-generated-media',
  'model-training-media',
  'plugin-run',
] as const;

export const FileUsageOwnerTypeSchema = z.enum(FILE_USAGE_OWNER_TYPES);

export const FileUsageSchema = z
  .object({
    ownerType: FileUsageOwnerTypeSchema,
    ownerId: ContractIdentifierSchema,
    field: ContractIdentifierSchema.optional(),
  })
  .strict();

export const FileReferenceSchema = z
  .object({
    id: ContractIdentifierSchema.optional(),
    uri: z.string().trim().min(1).optional(),
    thumbnailUri: z.string().trim().min(1).optional(),
    mimeType: z.string().trim().min(1).max(128).optional(),
    byteSize: z.number().int().nonnegative().optional(),
    sha256: Sha256Schema.optional(),
  })
  .strict()
  .refine((value) => Boolean(value.id || value.uri), {
    message: 'File reference requires id or uri',
  });

export const FileVariantSchema = z
  .object({
    variantId: ContractIdentifierSchema,
    kind: z.literal('thumbnail-512'),
    status: FileVariantStatusSchema,
    mimeType: z.literal('image/webp'),
    byteSize: z.number().int().nonnegative().optional(),
    width: z.number().int().positive().optional(),
    height: z.number().int().positive().optional(),
    uri: z.string().trim().min(1).optional(),
    errorCode: ContractIdentifierSchema.optional(),
  })
  .strict();

export const FileRecordSchema = z
  .object({
    contract: z.literal('FileRecord'),
    contractVersion: z.literal(1),
    version: z.number().int().positive(),
    fileId: ContractIdentifierSchema,
    teamId: ContractIdentifierSchema,
    purpose: FilePurposeSchema,
    originalName: z.string().trim().min(1).max(255),
    mimeType: z.string().trim().min(1).max(128),
    byteSize: z.number().int().nonnegative().optional(),
    sha256: Sha256Schema.optional(),
    status: FileStatusSchema,
    storage: z
      .object({
        bucketId: ContractIdentifierSchema,
        objectKey: z.string().trim().min(1).max(1024),
        canonicalUri: z.string().trim().min(1),
        etag: z.string().trim().min(1).optional(),
      })
      .strict(),
    variants: z.array(FileVariantSchema).default([]),
    createdAt: IsoDateTimeSchema,
    updatedAt: IsoDateTimeSchema,
  })
  .strict()
  .superRefine((value, context) => {
    if (value.storage.canonicalUri !== `file://${value.fileId}`) {
      context.addIssue({
        code: 'custom',
        path: ['storage', 'canonicalUri'],
        message: 'Canonical file URI must match fileId',
      });
    }
  });

export const FileUploadCreateRequestSchema = z
  .object({
    purpose: FilePurposeSchema,
    filename: z.string().trim().min(1).max(255),
    mimeType: z.string().trim().min(1).max(128),
    byteSize: z.number().int().nonnegative().optional(),
    sha256: Sha256Schema.optional(),
    usage: FileUsageSchema.optional(),
  })
  .strict();

export const FileUploadInstructionSchema = z
  .object({
    url: z.union([
      z.string().url(),
      z.string().trim().regex(/^\/(?!\/)/, 'Expected an absolute same-origin path'),
    ]),
    method: z.string().trim().min(1),
    headers: z.record(z.string(), z.string()),
    expiresAt: IsoDateTimeSchema,
  })
  .strict();

export const FileUploadCreateResponseSchema = z
  .object({
    file: FileRecordSchema,
    upload: FileUploadInstructionSchema,
  })
  .strict();

export const FileUploadCompleteRequestSchema = z
  .object({
    byteSize: z.number().int().nonnegative().optional(),
    sha256: Sha256Schema.optional(),
    etag: z.string().trim().min(1).max(512).optional(),
  })
  .strict();

export const ResolvedFileSchema = z
  .object({
    fileId: ContractIdentifierSchema.optional(),
    status: FileStatusSchema.optional(),
    originalUri: z.string().trim().min(1).optional(),
    thumbnailUri: z.string().trim().min(1).optional(),
    mimeType: z.string().trim().min(1).max(128).optional(),
    byteSize: z.number().int().nonnegative().optional(),
    sha256: Sha256Schema.optional(),
    unresolved: z.boolean().optional(),
  })
  .strict();

export const FileResolveBatchRequestSchema = z
  .object({
    references: z.array(FileReferenceSchema).min(1).max(1000),
    includeOriginal: z.boolean().default(false),
    includeThumbnail: z.boolean().default(true),
  })
  .strict();

export const FileResolveBatchResponseSchema = z
  .object({
    items: z.array(ResolvedFileSchema),
  })
  .strict();

export const ManagedFileCommandTypeSchema = z.enum([
  'create-file',
  'attach-usage',
  'detach-usage',
  'record-upload',
  'verify-upload',
  'delete-file',
]);

export const ManagedFileCommandSchema = z
  .object({
    contract: z.literal('ManagedFileCommand'),
    contractVersion: z.literal(1),
    commandId: ContractIdentifierSchema,
    commandType: ManagedFileCommandTypeSchema,
    fileId: ContractIdentifierSchema,
    teamId: ContractIdentifierSchema,
    expectedVersion: z.number().int().nonnegative().optional(),
    actorId: ContractIdentifierSchema.optional(),
    payload: JsonObjectSchema.default({}),
    issuedAt: IsoDateTimeSchema,
  })
  .strict();

export const ManagedFileEventTypeSchema = z.enum([
  'file-created',
  'file-usage-attached',
  'file-usage-detached',
  'storage-operation-queued',
  'storage-operation-completed',
  'storage-operation-failed',
  'file-ready',
  'file-deleted',
]);

export const ManagedFileEventSchema = z
  .object({
    contract: z.literal('ManagedFileEvent'),
    contractVersion: z.literal(1),
    eventId: ContractIdentifierSchema,
    eventType: ManagedFileEventTypeSchema,
    fileId: ContractIdentifierSchema,
    teamId: ContractIdentifierSchema,
    aggregateVersion: z.number().int().positive(),
    commandId: ContractIdentifierSchema,
    actorId: ContractIdentifierSchema.optional(),
    payload: JsonObjectSchema.default({}),
    occurredAt: IsoDateTimeSchema,
  })
  .strict();

export type FilePurpose = z.infer<typeof FilePurposeSchema>;
export type FileUsageOwnerType = z.infer<typeof FileUsageOwnerTypeSchema>;
export type FileStatus = z.infer<typeof FileStatusSchema>;
export type FileVariantStatus = z.infer<typeof FileVariantStatusSchema>;
export type FileUsage = z.infer<typeof FileUsageSchema>;
export type FileReference = z.infer<typeof FileReferenceSchema>;
export type FileVariant = z.infer<typeof FileVariantSchema>;
export type FileRecord = z.infer<typeof FileRecordSchema>;
export type FileUploadCreateRequest = z.infer<typeof FileUploadCreateRequestSchema>;
export type FileUploadInstruction = z.infer<typeof FileUploadInstructionSchema>;
export type FileUploadCreateResponse = z.infer<typeof FileUploadCreateResponseSchema>;
export type FileUploadCompleteRequest = z.infer<typeof FileUploadCompleteRequestSchema>;
export type ResolvedFile = z.infer<typeof ResolvedFileSchema>;
export type FileResolveBatchRequest = z.infer<typeof FileResolveBatchRequestSchema>;
export type FileResolveBatchResponse = z.infer<typeof FileResolveBatchResponseSchema>;
export type ManagedFileCommandType = z.infer<typeof ManagedFileCommandTypeSchema>;
export type ManagedFileCommand = z.infer<typeof ManagedFileCommandSchema>;
export type ManagedFileEventType = z.infer<typeof ManagedFileEventTypeSchema>;
export type ManagedFileEvent = z.infer<typeof ManagedFileEventSchema>;
