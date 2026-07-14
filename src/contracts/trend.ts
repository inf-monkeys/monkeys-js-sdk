import { z } from 'zod';
import {
  ContractIdentifierSchema,
  EntityRefV1Schema,
  IsoDateTimeSchema,
  JsonValueSchema,
} from './common';

export const TrendSourceV1Schema = z
  .object({
    sourceId: ContractIdentifierSchema,
    provider: ContractIdentifierSchema,
    channel: z.enum(['trend', 'ecommerce', 'social', 'search', 'internal']),
    collectedAt: IsoDateTimeSchema,
    sourceUrl: z.string().url().optional(),
    evidenceRefs: z.array(EntityRefV1Schema).default([]),
  })
  .catchall(JsonValueSchema);

export const HotwordBodyV1Schema = z
  .object({
    contract: z.literal('HotwordBody'),
    version: z.literal(1),
    hotwordId: ContractIdentifierSchema,
    label: z.string().trim().min(1),
    normalizedLabel: z.string().trim().min(1),
    categories: z.array(ContractIdentifierSchema).default([]),
    sourceRefs: z.array(TrendSourceV1Schema).min(1),
    relationRefs: z.array(EntityRefV1Schema).default([]),
    createdAt: IsoDateTimeSchema,
    updatedAt: IsoDateTimeSchema,
  })
  .catchall(JsonValueSchema);

export const TrendMetricSnapshotV1Schema = z
  .object({
    contract: z.literal('TrendMetricSnapshot'),
    version: z.literal(1),
    snapshotId: ContractIdentifierSchema,
    subjectRef: EntityRefV1Schema,
    observedAt: IsoDateTimeSchema,
    metrics: z.record(z.string(), z.number().finite()),
    confidence: z.number().min(0).max(1),
    evidenceRefs: z.array(EntityRefV1Schema).min(1),
  })
  .catchall(JsonValueSchema);

export const RadarScoreProjectionV1Schema = z
  .object({
    contract: z.literal('RadarScoreProjection'),
    version: z.literal(1),
    projectionId: ContractIdentifierSchema,
    subjectRef: EntityRefV1Schema,
    modelRef: EntityRefV1Schema,
    totalScore: z.number().finite(),
    dimensions: z.record(z.string(), z.number().finite()),
    evidenceRefs: z.array(EntityRefV1Schema).min(1),
    freshnessAt: IsoDateTimeSchema,
  })
  .catchall(JsonValueSchema);

export const RadarSelectionV1Schema = z
  .object({
    contract: z.literal('RadarSelection'),
    version: z.literal(1),
    selectionId: ContractIdentifierSchema,
    teamId: ContractIdentifierSchema,
    ownerRef: EntityRefV1Schema,
    subjectRefs: z.array(EntityRefV1Schema),
    status: z.enum(['stashed', 'selected', 'rejected', 'archived']),
    note: z.string().optional(),
    expectedVersion: z.number().int().nonnegative(),
    updatedAt: IsoDateTimeSchema,
  })
  .catchall(JsonValueSchema);

export type TrendSourceV1 = z.infer<typeof TrendSourceV1Schema>;
export type HotwordBodyV1 = z.infer<typeof HotwordBodyV1Schema>;
export type TrendMetricSnapshotV1 = z.infer<typeof TrendMetricSnapshotV1Schema>;
export type RadarScoreProjectionV1 = z.infer<typeof RadarScoreProjectionV1Schema>;
export type RadarSelectionV1 = z.infer<typeof RadarSelectionV1Schema>;

