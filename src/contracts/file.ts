import { z } from 'zod';
import { ContractIdentifierSchema, IsoDateTimeSchema, JsonObjectSchema, Sha256Schema } from './common';

export const FILE_PURPOSES = [
  'uploads',
  'agent-attachments',
  'agent-artifacts',
  'agent-edited-images',
  'agent-workbench',
  'agent-skill-archives',
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
  'file-resource',
  'agent-record',
  'agent-message',
  'agent-skill-archive',
  'data-asset',
  'data-export',
  'design-board',
  'markdown-document',
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

export const ManagedFileUriSchema = z.string().regex(/^file:\/\/[A-Za-z0-9][A-Za-z0-9_-]{0,127}(?:#[A-Za-z0-9_-]+)?$/);

const TransferUrlSchema = z.string().min(1).max(16384).refine((value) => {
  if (/^\/(?!\/)/.test(value)) return !/[\u0000-\u0020\\]/.test(value);
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password;
  } catch { return false; }
}, 'Expected an HTTP(S) URL or absolute same-origin path');

const TransferHeadersSchema = z.record(
  z.string().regex(/^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/),
  z.string().refine((value) => !/[\u0000\r\n]/.test(value), 'Invalid header value'),
);

/** Ephemeral transport only. A business record retains its managed URI. */
export const FileReadInstructionSchema = z.object({
  mode: z.enum(['direct', 'proxy']),
  url: TransferUrlSchema,
  method: z.literal('GET'),
  headers: TransferHeadersSchema,
  expiresAt: IsoDateTimeSchema.nullable(),
}).strict().superRefine((value, context) => {
  if (value.mode === 'proxy' && !/^\/(?!\/)/.test(value.url))
    context.addIssue({ code: 'custom', path: ['url'], message: 'A browser proxy must use a same-origin path' });
});

export const FileResourcePathSchema = z.string().min(1).max(1024).refine((path) => {
  if (/^[\/\\]|[\\\u0000-\u001f:?#]/.test(path)) return false;
  try {
    const decoded = decodeURIComponent(path);
    return !/^[\/\\]|[\\\u0000-\u001f:?#]/.test(decoded) && decoded.split('/').every((part) => part && part !== '.' && part !== '..');
  }
  catch { return false; }
}, 'Expected a safe relative resource path');

export const FileResourceManifestSchema = z.object({
  version: z.literal(1),
  entryPath: FileResourcePathSchema.optional(),
  resources: z.array(z.object({ path: FileResourcePathSchema, uri: ManagedFileUriSchema }).strict()).max(1000),
}).strict().superRefine((value, context) => {
  if (new Set(value.resources.map((resource) => resource.path)).size !== value.resources.length)
    context.addIssue({ code: 'custom', path: ['resources'], message: 'Resource paths must be unique' });
});

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
    resourceManifest: FileResourceManifestSchema.optional(),
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
    requestId: ContractIdentifierSchema.optional(),
    forceProxy: z.boolean().optional(),
  })
  .strict();

export const FileUploadInstructionSchema = z
  .object({
    url: TransferUrlSchema,
    method: z.string().trim().min(1),
    headers: TransferHeadersSchema,
    expiresAt: IsoDateTimeSchema,
    mode: z.enum(['direct', 'proxy']).optional(),
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
    resourceManifest: FileResourceManifestSchema.optional(),
  })
  .strict();

export const ResolvedFileSchema = z
  .object({
    fileId: ContractIdentifierSchema.optional(),
    status: FileStatusSchema.optional(),
    originalUri: z.string().trim().min(1).optional(),
    thumbnailUri: z.string().trim().min(1).optional(),
    version: z.number().int().positive().optional(),
    resourceManifest: FileResourceManifestSchema.optional(),
    originalAccess: FileReadInstructionSchema.optional(),
    thumbnailAccess: FileReadInstructionSchema.optional(),
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
    includeAccessInstructions: z.boolean().default(false),
    forceProxy: z.boolean().default(false),
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
export type FileReadInstruction = z.infer<typeof FileReadInstructionSchema>;
export type FileResourceManifest = z.infer<typeof FileResourceManifestSchema>;
export type FileUploadCreateResponse = z.infer<typeof FileUploadCreateResponseSchema>;
export type FileUploadCompleteRequest = z.infer<typeof FileUploadCompleteRequestSchema>;
export type ResolvedFile = z.infer<typeof ResolvedFileSchema>;
export type FileResolveBatchRequest = z.infer<typeof FileResolveBatchRequestSchema>;
export type FileResolveBatchResponse = z.infer<typeof FileResolveBatchResponseSchema>;
export type ManagedFileCommandType = z.infer<typeof ManagedFileCommandTypeSchema>;
export type ManagedFileCommand = z.infer<typeof ManagedFileCommandSchema>;
export type ManagedFileEventType = z.infer<typeof ManagedFileEventTypeSchema>;
export type ManagedFileEvent = z.infer<typeof ManagedFileEventSchema>;
