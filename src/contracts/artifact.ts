import { z } from 'zod';
import {
  ContractIdentifierSchema,
  EntityRefV1Schema,
  IsoDateTimeSchema,
  JsonValueSchema,
  Sha256Schema,
} from './common';

export const StorageLocatorV1Schema = z
  .object({
    provider: ContractIdentifierSchema,
    bucket: ContractIdentifierSchema.optional(),
    key: ContractIdentifierSchema,
    region: ContractIdentifierSchema.optional(),
    url: z.string().url().optional(),
    expiresAt: IsoDateTimeSchema.optional(),
  })
  .catchall(JsonValueSchema);

export const ArtifactAccessV1Schema = z
  .object({
    tenantId: ContractIdentifierSchema.optional(),
    teamId: ContractIdentifierSchema.optional(),
    ownerRef: EntityRefV1Schema.optional(),
    visibility: z.enum(['private', 'team', 'tenant', 'public']),
  })
  .catchall(JsonValueSchema);

export const ArtifactManifestV1Schema = z
  .object({
    contract: z.literal('ArtifactManifest'),
    version: z.literal(1),
    artifactId: ContractIdentifierSchema,
    kind: ContractIdentifierSchema,
    mimeType: z.string().trim().min(1),
    byteSize: z.number().int().nonnegative().optional(),
    sha256: Sha256Schema,
    storage: StorageLocatorV1Schema,
    sourceRef: EntityRefV1Schema.optional(),
    runRef: EntityRefV1Schema,
    outputRef: EntityRefV1Schema,
    producer: z
      .object({
        service: ContractIdentifierSchema,
        version: ContractIdentifierSchema,
        capabilityRef: EntityRefV1Schema.optional(),
      })
      .catchall(JsonValueSchema),
    access: ArtifactAccessV1Schema,
    metadata: z.record(z.string(), JsonValueSchema).default({}),
    createdAt: IsoDateTimeSchema,
  })
  .catchall(JsonValueSchema);

export const OutputRecordV1Schema = z
  .object({
    contract: z.literal('OutputRecord'),
    version: z.literal(1),
    outputId: ContractIdentifierSchema,
    runRef: EntityRefV1Schema,
    outputPort: ContractIdentifierSchema,
    value: JsonValueSchema.optional(),
    artifactRefs: z.array(EntityRefV1Schema).default([]),
    schemaRef: ContractIdentifierSchema.optional(),
    createdAt: IsoDateTimeSchema,
  })
  .catchall(JsonValueSchema);

export type StorageLocatorV1 = z.infer<typeof StorageLocatorV1Schema>;
export type ArtifactAccessV1 = z.infer<typeof ArtifactAccessV1Schema>;
export type ArtifactManifestV1 = z.infer<typeof ArtifactManifestV1Schema>;
export type OutputRecordV1 = z.infer<typeof OutputRecordV1Schema>;

