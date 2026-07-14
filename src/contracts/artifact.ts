import { z } from 'zod';
import {
  ContractIdentifierSchema,
  EntityRefSchema,
  IsoDateTimeSchema,
  JsonValueSchema,
  Sha256Schema,
} from './common';

export const StorageLocatorSchema = z
  .object({
    provider: ContractIdentifierSchema,
    bucket: ContractIdentifierSchema.optional(),
    key: ContractIdentifierSchema,
    region: ContractIdentifierSchema.optional(),
    url: z.string().url().optional(),
    expiresAt: IsoDateTimeSchema.optional(),
  })
  .strict();

export const ArtifactAccessSchema = z
  .object({
    tenantId: ContractIdentifierSchema.optional(),
    teamId: ContractIdentifierSchema.optional(),
    ownerRef: EntityRefSchema.optional(),
    visibility: z.enum(['private', 'team', 'tenant', 'public']),
  })
  .strict();

export const ArtifactManifestSchema = z
  .object({
    contract: z.literal('ArtifactManifest'),
    artifactId: ContractIdentifierSchema,
    kind: ContractIdentifierSchema,
    mimeType: z.string().trim().min(1),
    byteSize: z.number().int().nonnegative().optional(),
    sha256: Sha256Schema,
    storage: StorageLocatorSchema,
    sourceRef: EntityRefSchema.optional(),
    runRef: EntityRefSchema,
    outputRef: EntityRefSchema,
    producer: z
      .object({
        service: ContractIdentifierSchema,
        version: ContractIdentifierSchema,
        capabilityRef: EntityRefSchema.optional(),
      })
      .strict(),
    access: ArtifactAccessSchema,
    metadata: z.record(z.string(), JsonValueSchema).default({}),
    createdAt: IsoDateTimeSchema,
  })
  .strict();

export const OutputRecordSchema = z
  .object({
    contract: z.literal('OutputRecord'),
    outputId: ContractIdentifierSchema,
    runRef: EntityRefSchema,
    outputPort: ContractIdentifierSchema,
    value: JsonValueSchema.optional(),
    artifactRefs: z.array(EntityRefSchema).default([]),
    schemaRef: ContractIdentifierSchema.optional(),
    createdAt: IsoDateTimeSchema,
  })
  .strict();

export type StorageLocator = z.infer<typeof StorageLocatorSchema>;
export type ArtifactAccess = z.infer<typeof ArtifactAccessSchema>;
export type ArtifactManifest = z.infer<typeof ArtifactManifestSchema>;
export type OutputRecord = z.infer<typeof OutputRecordSchema>;
