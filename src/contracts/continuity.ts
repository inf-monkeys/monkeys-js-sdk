import { z } from 'zod';
import {
  ContractIdentifierSchema,
  ContractVersionSchema,
  EntityRefSchema,
  IsoDateTimeSchema,
  JsonObjectSchema,
} from './common';

export const DataContinuityEnvelopeSchema = z
  .object({
    contract: z.literal('DataContinuityEnvelope'),
    tenantId: ContractIdentifierSchema,
    teamId: ContractIdentifierSchema,
    sourceRef: EntityRefSchema.optional(),
    bodyRef: EntityRefSchema.optional(),
    runRef: EntityRefSchema.optional(),
    outputRef: EntityRefSchema.optional(),
    artifactRef: EntityRefSchema.optional(),
    requestId: ContractIdentifierSchema,
    actorRef: EntityRefSchema,
    schemaVersion: ContractVersionSchema,
  })
  .strict()
  .refine(
    value => Boolean(value.sourceRef || value.bodyRef || value.runRef || value.outputRef || value.artifactRef),
    'At least one continuity ref is required.',
  );

export const BodyRelationRecordSchema = z
  .object({
    contract: z.literal('BodyRelationRecord'),
    relationId: ContractIdentifierSchema,
    relationKind: ContractIdentifierSchema,
    subjectRef: EntityRefSchema,
    objectRef: EntityRefSchema,
    ownerRepo: ContractIdentifierSchema,
    authorityScope: z.enum(['tenant', 'team', 'global']),
    properties: JsonObjectSchema.default({}),
    createdAt: IsoDateTimeSchema,
    updatedAt: IsoDateTimeSchema,
  })
  .strict();

export const ApplicationRunSchema = z
  .object({
    contract: z.literal('ApplicationRun'),
    runId: ContractIdentifierSchema,
    definitionRef: EntityRefSchema,
    runtimeLedgerRef: EntityRefSchema,
    requestId: ContractIdentifierSchema,
    actorRef: EntityRefSchema,
    status: z.enum(['PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED', 'EXPIRED']),
    inputRefs: z.array(EntityRefSchema).default([]),
    outputRefs: z.array(EntityRefSchema).default([]),
    startedAt: IsoDateTimeSchema.optional(),
    completedAt: IsoDateTimeSchema.optional(),
    expiresAt: IsoDateTimeSchema.optional(),
    metadata: JsonObjectSchema.default({}),
  })
  .strict();

export const ExpiringAccessGrantSchema = z
  .object({
    contract: z.literal('ExpiringAccessGrant'),
    grantId: ContractIdentifierSchema,
    subjectRef: EntityRefSchema,
    resourceRef: EntityRefSchema,
    permissions: z.array(ContractIdentifierSchema).min(1),
    issuedAt: IsoDateTimeSchema,
    expiresAt: IsoDateTimeSchema,
    revokedAt: IsoDateTimeSchema.optional(),
  })
  .strict()
  .refine(value => Date.parse(value.expiresAt) > Date.parse(value.issuedAt), 'expiresAt must be after issuedAt');

export type DataContinuityEnvelope = z.infer<typeof DataContinuityEnvelopeSchema>;
export type BodyRelationRecord = z.infer<typeof BodyRelationRecordSchema>;
export type ApplicationRun = z.infer<typeof ApplicationRunSchema>;
export type ExpiringAccessGrant = z.infer<typeof ExpiringAccessGrantSchema>;
