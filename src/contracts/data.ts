import { z } from 'zod';
import {
  ContractIdentifierSchema,
  EntityRefV1Schema,
  IsoDateTimeSchema,
  JsonValueSchema,
  Sha256Schema,
} from './common';

export const SourceRecordRefV1Schema = z
  .object({
    sourceId: ContractIdentifierSchema,
    recordId: ContractIdentifierSchema,
    recordVersion: z.union([z.number().int().nonnegative(), ContractIdentifierSchema]),
    hash: Sha256Schema,
  })
  .catchall(JsonValueSchema);

export const OntologyDefinitionV1Schema = z
  .object({
    contract: z.literal('OntologyDefinition'),
    version: z.literal(1),
    ontologyId: ContractIdentifierSchema,
    dataSpaceId: ContractIdentifierSchema,
    ownerRepo: ContractIdentifierSchema,
    bodySchemaRef: ContractIdentifierSchema,
    authority: z
      .object({
        service: ContractIdentifierSchema,
        storage: ContractIdentifierSchema,
        scope: z.enum(['tenant', 'team', 'user', 'global']),
      })
      .catchall(JsonValueSchema),
    relationKinds: z.array(ContractIdentifierSchema).default([]),
    metricKinds: z.array(ContractIdentifierSchema).default([]),
  })
  .catchall(JsonValueSchema);

export const ProjectionSpecV1Schema = z
  .object({
    contract: z.literal('ProjectionSpec'),
    version: z.literal(1),
    projectionId: ContractIdentifierSchema,
    ontologyIds: z.array(ContractIdentifierSchema).min(1),
    outputSchemaRef: ContractIdentifierSchema,
    operator: z
      .object({
        kind: z.enum(['query', 'aggregate', 'relationship', 'search', 'custom']),
        configuration: z.record(z.string(), JsonValueSchema).default({}),
      })
      .catchall(JsonValueSchema),
    materialization: z.enum(['on-demand', 'event-driven', 'scheduled']),
    invalidationEvents: z.array(ContractIdentifierSchema).default([]),
    rebuildable: z.literal(true),
    lineagePolicy: z
      .object({
        sourceRecords: z.boolean(),
        bodyVersions: z.boolean(),
        runRefs: z.boolean(),
        actorRefs: z.boolean(),
      })
      .catchall(JsonValueSchema),
  })
  .catchall(JsonValueSchema);

export const LineageRecordV1Schema = z
  .object({
    contract: z.literal('LineageRecord'),
    version: z.literal(1),
    lineageId: ContractIdentifierSchema,
    subjectRef: EntityRefV1Schema,
    sourceRecords: z.array(SourceRecordRefV1Schema).default([]),
    bodyRefs: z.array(EntityRefV1Schema).default([]),
    runRefs: z.array(EntityRefV1Schema).default([]),
    outputRefs: z.array(EntityRefV1Schema).default([]),
    artifactRefs: z.array(EntityRefV1Schema).default([]),
    actorRefs: z.array(EntityRefV1Schema).default([]),
    evidenceRefs: z.array(EntityRefV1Schema).default([]),
    recordedAt: IsoDateTimeSchema,
  })
  .catchall(JsonValueSchema);

export const DomainEventV1Schema = z
  .object({
    contract: z.literal('DomainEvent'),
    version: z.literal(1),
    eventId: ContractIdentifierSchema,
    eventType: ContractIdentifierSchema,
    aggregateRef: EntityRefV1Schema,
    aggregateVersion: z.number().int().nonnegative(),
    requestId: ContractIdentifierSchema,
    actorRef: EntityRefV1Schema,
    payload: JsonValueSchema,
    occurredAt: IsoDateTimeSchema,
  })
  .catchall(JsonValueSchema);

export type SourceRecordRefV1 = z.infer<typeof SourceRecordRefV1Schema>;
export type OntologyDefinitionV1 = z.infer<typeof OntologyDefinitionV1Schema>;
export type ProjectionSpecV1 = z.infer<typeof ProjectionSpecV1Schema>;
export type LineageRecordV1 = z.infer<typeof LineageRecordV1Schema>;
export type DomainEventV1 = z.infer<typeof DomainEventV1Schema>;

