import { z } from 'zod';
import {
  ContractIdentifierSchema,
  EntityRefSchema,
  IsoDateTimeSchema,
  JsonValueSchema,
  Sha256Schema,
} from './common';

export const SourceRecordRefSchema = z
  .object({
    sourceId: ContractIdentifierSchema,
    recordId: ContractIdentifierSchema,
    recordVersion: z.union([z.number().int().nonnegative(), ContractIdentifierSchema]),
    hash: Sha256Schema,
  })
  .strict();

export const OntologyDefinitionSchema = z
  .object({
    contract: z.literal('OntologyDefinition'),
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
      .strict(),
    relationKinds: z.array(ContractIdentifierSchema).default([]),
    metricKinds: z.array(ContractIdentifierSchema).default([]),
  })
  .strict();

export const ProjectionSpecSchema = z
  .object({
    contract: z.literal('ProjectionSpec'),
    projectionId: ContractIdentifierSchema,
    ontologyIds: z.array(ContractIdentifierSchema).min(1),
    outputSchemaRef: ContractIdentifierSchema,
    operator: z
      .object({
        kind: z.enum(['query', 'aggregate', 'relationship', 'search', 'custom']),
        configuration: z.record(z.string(), JsonValueSchema).default({}),
      })
      .strict(),
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
      .strict(),
  })
  .strict();

export const LineageRecordSchema = z
  .object({
    contract: z.literal('LineageRecord'),
    lineageId: ContractIdentifierSchema,
    subjectRef: EntityRefSchema,
    sourceRecords: z.array(SourceRecordRefSchema).default([]),
    bodyRefs: z.array(EntityRefSchema).default([]),
    runRefs: z.array(EntityRefSchema).default([]),
    outputRefs: z.array(EntityRefSchema).default([]),
    artifactRefs: z.array(EntityRefSchema).default([]),
    actorRefs: z.array(EntityRefSchema).default([]),
    evidenceRefs: z.array(EntityRefSchema).default([]),
    recordedAt: IsoDateTimeSchema,
  })
  .strict();

export const DomainEventSchema = z
  .object({
    contract: z.literal('DomainEvent'),
    eventId: ContractIdentifierSchema,
    eventType: ContractIdentifierSchema,
    aggregateRef: EntityRefSchema,
    aggregateVersion: z.number().int().nonnegative(),
    requestId: ContractIdentifierSchema,
    actorRef: EntityRefSchema,
    payload: JsonValueSchema,
    occurredAt: IsoDateTimeSchema,
  })
  .strict();

export type SourceRecordRef = z.infer<typeof SourceRecordRefSchema>;
export type OntologyDefinition = z.infer<typeof OntologyDefinitionSchema>;
export type ProjectionSpec = z.infer<typeof ProjectionSpecSchema>;
export type LineageRecord = z.infer<typeof LineageRecordSchema>;
export type DomainEvent = z.infer<typeof DomainEventSchema>;
