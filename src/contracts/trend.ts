import { z } from 'zod';
import {
  ContractIdentifierSchema,
  EntityRefSchema,
  IsoDateTimeSchema,
  JsonValueSchema,
} from './common';

export const TrendSourceSchema = z
  .object({
    sourceId: ContractIdentifierSchema,
    provider: ContractIdentifierSchema,
    channel: z.enum(['trend', 'ecommerce', 'social', 'search', 'internal']),
    collectedAt: IsoDateTimeSchema,
    sourceUrl: z.string().url().optional(),
    evidenceRefs: z.array(EntityRefSchema).default([]),
  })
  .strict();

export const HotwordBodySchema = z
  .object({
    contract: z.literal('HotwordBody'),
    hotwordId: ContractIdentifierSchema,
    label: z.string().trim().min(1),
    normalizedLabel: z.string().trim().min(1),
    categories: z.array(ContractIdentifierSchema).default([]),
    sourceRefs: z.array(TrendSourceSchema).min(1),
    relationRefs: z.array(EntityRefSchema).default([]),
    createdAt: IsoDateTimeSchema,
    updatedAt: IsoDateTimeSchema,
  })
  .strict();

export const TrendMetricSnapshotSchema = z
  .object({
    contract: z.literal('TrendMetricSnapshot'),
    snapshotId: ContractIdentifierSchema,
    subjectRef: EntityRefSchema,
    observedAt: IsoDateTimeSchema,
    metrics: z.record(z.string(), z.number().finite()),
    confidence: z.number().min(0).max(1),
    evidenceRefs: z.array(EntityRefSchema).min(1),
  })
  .strict();

export const RadarScoreProjectionSchema = z
  .object({
    contract: z.literal('RadarScoreProjection'),
    projectionId: ContractIdentifierSchema,
    subjectRef: EntityRefSchema,
    modelRef: EntityRefSchema,
    totalScore: z.number().finite(),
    dimensions: z.record(z.string(), z.number().finite()),
    evidenceRefs: z.array(EntityRefSchema).min(1),
    freshnessAt: IsoDateTimeSchema,
  })
  .strict();

export const RadarSelectionSchema = z
  .object({
    contract: z.literal('RadarSelection'),
    selectionId: ContractIdentifierSchema,
    teamId: ContractIdentifierSchema,
    ownerRef: EntityRefSchema,
    subjectRefs: z.array(EntityRefSchema),
    status: z.enum(['stashed', 'selected', 'rejected', 'archived']),
    note: z.string().optional(),
    expectedVersion: z.number().int().nonnegative(),
    updatedAt: IsoDateTimeSchema,
  })
  .strict();

export type TrendSource = z.infer<typeof TrendSourceSchema>;
export type HotwordBody = z.infer<typeof HotwordBodySchema>;
export type TrendMetricSnapshot = z.infer<typeof TrendMetricSnapshotSchema>;
export type RadarScoreProjection = z.infer<typeof RadarScoreProjectionSchema>;
export type RadarSelection = z.infer<typeof RadarSelectionSchema>;
