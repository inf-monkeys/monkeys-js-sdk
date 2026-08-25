import { z } from 'zod';
import { ContractIdentifierSchema, IsoDateTimeSchema, Sha256Schema } from './common';

export const FilePurposeSchema = z
  .string()
  .trim()
  .min(1)
  .max(64)
  .regex(/^[a-z0-9][a-z0-9-]*$/);

export const FileStatusSchema = z.enum(['pending', 'ready', 'failed', 'deleted']);
export const FileVariantStatusSchema = z.enum(['queued', 'processing', 'ready', 'failed']);

export const FileUsageSchema = z
  .object({
    ownerType: ContractIdentifierSchema,
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
    url: z.string().url(),
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

export type FilePurpose = z.infer<typeof FilePurposeSchema>;
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
