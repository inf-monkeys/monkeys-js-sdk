import { z } from 'zod';
import {
  ContractIdentifierSchema,
  EntityRefSchema,
  IsoDateTimeSchema,
  JsonObjectSchema,
  JsonValueSchema,
  Sha256Schema,
} from './common';
import { LineageRecordSchema } from './data';
import { OutputRecordSchema } from './artifact';

export const RadarDecisionMetricsSchema = z
  .object({
    currentSales: z.number().finite(),
    forecastSales: z.number().finite(),
    searchHeat: z.number().finite(),
    socialHeat: z.number().finite(),
    confidence: z.number().min(0).max(1),
  })
  .strict();

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

export const TrendIngestRunSchema = z
  .object({
    contract: z.literal('TrendIngestRun'),
    ingestRunId: ContractIdentifierSchema,
    sourceId: ContractIdentifierSchema,
    requestId: ContractIdentifierSchema,
    idempotencyKey: ContractIdentifierSchema,
    status: z.enum(['RUNNING', 'SUCCEEDED', 'FAILED', 'PARTIAL']),
    recordCount: z.number().int().nonnegative(),
    errorCount: z.number().int().nonnegative(),
    startedAt: IsoDateTimeSchema,
    completedAt: IsoDateTimeSchema.optional(),
  })
  .strict();

export const TrendSourceRecordSchema = z
  .object({
    contract: z.literal('TrendSourceRecord'),
    sourceRecordId: ContractIdentifierSchema,
    source: TrendSourceSchema,
    ingestRunRef: EntityRefSchema,
    recordVersion: z.number().int().positive(),
    contentHash: Sha256Schema,
    payload: JsonValueSchema,
    idempotencyKey: ContractIdentifierSchema,
    collectedAt: IsoDateTimeSchema,
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

const CommerceBodyFieldsSchema = {
  displayName: z.string().trim().min(1),
  normalizedName: z.string().trim().min(1),
  categories: z.array(ContractIdentifierSchema).default([]),
  sourceRefs: z.array(EntityRefSchema).min(1),
  relationRefs: z.array(EntityRefSchema).default([]),
  createdAt: IsoDateTimeSchema,
  updatedAt: IsoDateTimeSchema,
};

export const BrandBodySchema = z
  .object({
    contract: z.literal('BrandBody'),
    brandId: ContractIdentifierSchema,
    ...CommerceBodyFieldsSchema,
  })
  .strict();

export const ProductBodySchema = z
  .object({
    contract: z.literal('ProductBody'),
    productId: ContractIdentifierSchema,
    brandRef: EntityRefSchema.optional(),
    ...CommerceBodyFieldsSchema,
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

export const RadarScoreModelBodySchema = z
  .object({
    contract: z.literal('RadarScoreModelBody'),
    modelId: ContractIdentifierSchema,
    version: z.number().int().positive(),
    weights: RadarDecisionMetricsSchema,
    thresholds: z.record(z.string(), z.number().finite()).default({}),
    explanationRules: z.record(z.string(), z.string().trim().min(1)).default({}),
    createdAt: IsoDateTimeSchema,
  })
  .strict();

export const RadarScoreProjectionSchema = z
  .object({
    contract: z.literal('RadarScoreProjection'),
    projectionId: ContractIdentifierSchema,
    subjectRef: EntityRefSchema,
    modelRef: EntityRefSchema,
    totalScore: z.number().finite(),
    dimensions: RadarDecisionMetricsSchema,
    evidenceRefs: z.array(EntityRefSchema).min(1),
    freshnessAt: IsoDateTimeSchema,
  })
  .strict();

export const RadarPanoramaNodeSchema = z
  .object({
    ref: EntityRefSchema,
    label: z.string().trim().min(1),
    categories: z.array(ContractIdentifierSchema).default([]),
    score: z.number().finite().optional(),
    freshnessAt: IsoDateTimeSchema.optional(),
  })
  .strict();

export const RadarPanoramaEdgeSchema = z
  .object({
    sourceRef: EntityRefSchema,
    targetRef: EntityRefSchema,
    relation: ContractIdentifierSchema,
    evidenceRefs: z.array(EntityRefSchema).default([]),
  })
  .strict();

export const RadarPanoramaSchema = z
  .object({
    contract: z.literal('RadarPanorama'),
    nodes: z.array(RadarPanoramaNodeSchema),
    edges: z.array(RadarPanoramaEdgeSchema),
    generatedAt: IsoDateTimeSchema,
  })
  .strict();

export const BrandGeneticsProfileSchema = z
  .object({
    contract: z.literal('BrandGeneticsProfile'),
    brandRef: EntityRefSchema,
    categories: z.array(ContractIdentifierSchema).default([]),
    signature: z.record(ContractIdentifierSchema, z.number().finite()),
    relatedRefs: z.array(EntityRefSchema).default([]),
    evidenceRefs: z.array(EntityRefSchema).default([]),
    computedAt: IsoDateTimeSchema,
  })
  .strict();

export const RadarOpportunityMatrixPointSchema = z
  .object({
    subjectRef: EntityRefSchema,
    label: z.string().trim().min(1),
    x: z.number().finite(),
    y: z.number().finite(),
    score: z.number().finite(),
    evidenceRefs: z.array(EntityRefSchema).default([]),
  })
  .strict();

export const RadarOpportunityMatrixSchema = z
  .object({
    contract: z.literal('RadarOpportunityMatrix'),
    xMetric: z.enum(['currentSales', 'forecastSales', 'searchHeat', 'socialHeat', 'confidence']),
    yMetric: z.enum(['currentSales', 'forecastSales', 'searchHeat', 'socialHeat', 'confidence']),
    points: z.array(RadarOpportunityMatrixPointSchema),
    computedAt: IsoDateTimeSchema,
  })
  .strict();

export const RadarQueryBodySchema = z
  .object({
    contract: z.literal('RadarQueryBody'),
    queryId: ContractIdentifierSchema,
    filters: z.record(z.string(), JsonValueSchema).default({}),
    sort: z
      .object({
        field: ContractIdentifierSchema,
        direction: z.enum(['asc', 'desc']),
      })
      .strict(),
    pageSize: z.number().int().min(1).max(200),
    updatedAt: IsoDateTimeSchema,
  })
  .strict();

export const SavedRadarQuerySchema = z
  .object({
    contract: z.literal('SavedRadarQuery'),
    savedQueryId: ContractIdentifierSchema,
    teamId: ContractIdentifierSchema,
    ownerRef: EntityRefSchema,
    name: z.string().trim().min(1),
    queryRef: EntityRefSchema,
    expectedVersion: z.number().int().nonnegative(),
    updatedAt: IsoDateTimeSchema,
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

const versionedRefFields = {
  id: ContractIdentifierSchema,
  version: z.union([z.number().int().positive(), z.string().trim().min(1)]).optional(),
  ownerRepo: ContractIdentifierSchema.optional(),
};

export const TrendRadarCollectionAssetRefSchema = z
  .object({
    kind: z.literal('asset'),
    ...versionedRefFields,
  })
  .strict();

export const TrendRadarCollectionSelectionRefSchema = z
  .object({
    kind: z.literal('radar-selection'),
    ...versionedRefFields,
  })
  .strict();

export const TrendRadarCollectionRunRefSchema = z
  .object({
    kind: z.literal('radar-analysis-run'),
    ...versionedRefFields,
  })
  .strict();

export const TrendRadarCollectionSubjectRefSchema = z
  .object({
    kind: z.literal('hotword'),
    ...versionedRefFields,
  })
  .strict();

export const TrendRadarCollectionArtifactRefSchema = z
  .object({
    kind: z.literal('artifact'),
    ...versionedRefFields,
  })
  .strict();

export const TrendRadarCollectionRecipeEntrySchema = z
  .object({
    subjectRef: TrendRadarCollectionSubjectRefSchema,
    label: z.string().trim().min(1).max(200),
  })
  .strict();

export const TrendRadarCollectionRecipeSchema = z
  .object({
    category: z.array(TrendRadarCollectionRecipeEntrySchema),
    design: z.array(TrendRadarCollectionRecipeEntrySchema),
    audience: z.array(TrendRadarCollectionRecipeEntrySchema),
  })
  .strict()
  .refine(
    recipe => recipe.category.length + recipe.design.length + recipe.audience.length > 0,
    'A Trend Radar collection recipe must contain at least one subject.',
  );

export const TrendRadarCollectionDecisionAxisSchema = z
  .object({
    key: ContractIdentifierSchema,
    label: z.string().trim().min(1).max(200).optional(),
    value: z.number().finite(),
  })
  .strict();

export const TrendRadarCollectionDecisionProjectionSchema = z
  .object({
    axes: z.array(TrendRadarCollectionDecisionAxisSchema).max(32).optional(),
    overallScore: z.number().finite().optional(),
    itemRank: z.number().finite().optional(),
    sourceRefs: z.array(EntityRefSchema).optional(),
    outputRefs: z.array(EntityRefSchema).optional(),
  })
  .strict()
  .superRefine((projection, context) => {
    const hasProjection = Boolean(
      projection.axes?.length
      || projection.overallScore !== undefined
      || projection.itemRank !== undefined
      || projection.sourceRefs?.length
      || projection.outputRefs?.length,
    );
    if (!hasProjection) {
      context.addIssue({
        code: 'custom',
        message: 'A decision projection must contain canonical decision data or references.',
      });
    }

    const seenAxisKeys = new Set<string>();
    projection.axes?.forEach((axis, index) => {
      if (seenAxisKeys.has(axis.key)) {
        context.addIssue({
          code: 'custom',
          path: ['axes', index, 'key'],
          message: `Duplicate decision axis key: ${axis.key}`,
        });
      }
      seenAxisKeys.add(axis.key);
    });
  });

export const TrendRadarCollectionArtifactProjectionSchema = z
  .object({
    artifactRef: TrendRadarCollectionArtifactRefSchema,
    url: z.string().url().optional(),
    thumbnailUrl: z.string().url().optional(),
    mimeType: z.string().trim().min(1).optional(),
    metadata: JsonObjectSchema.optional(),
  })
  .strict();

export const TrendRadarCollectionProjectionWritebackSchema = z
  .object({
    status: z.enum(['PENDING', 'APPLIED', 'FAILED']),
    updatedAt: IsoDateTimeSchema,
    error: z
      .object({
        code: ContractIdentifierSchema,
        message: z.string().trim().min(1),
        retryable: z.boolean(),
      })
      .strict()
      .optional(),
  })
  .strict()
  .superRefine((writeback, context) => {
    if (writeback.status === 'FAILED' && !writeback.error) {
      context.addIssue({
        code: 'custom',
        path: ['error'],
        message: 'A failed collection projection writeback must include an error.',
      });
    }
    if (writeback.status !== 'FAILED' && writeback.error) {
      context.addIssue({
        code: 'custom',
        path: ['error'],
        message: 'Only a failed collection projection writeback may include an error.',
      });
    }
  });

export const TrendRadarCollectionItemSchema = z
  .object({
    contract: z.literal('TrendRadarCollectionItem'),
    schemaVersion: z.literal(1),
    selectionRef: TrendRadarCollectionSelectionRefSchema,
    recipe: TrendRadarCollectionRecipeSchema,
    status: z.enum(['SAVED', 'QUEUED', 'RUNNING', 'SUCCEEDED', 'FAILED', 'CANCELLED', 'PARTIAL']),
    latestRunRef: TrendRadarCollectionRunRefSchema.optional(),
    decisionProjection: TrendRadarCollectionDecisionProjectionSchema.optional(),
    artifactProjection: TrendRadarCollectionArtifactProjectionSchema.optional(),
    createdAt: IsoDateTimeSchema,
    updatedAt: IsoDateTimeSchema,
    generatedAt: IsoDateTimeSchema.optional(),
  })
  .strict();

export const RadarAnalysisRunSchema = z
  .object({
    contract: z.literal('RadarAnalysisRun'),
    runId: ContractIdentifierSchema,
    teamId: ContractIdentifierSchema,
    selectionRef: EntityRefSchema,
    workflowRef: EntityRefSchema,
    executionRef: EntityRefSchema.optional(),
    designProjectRef: EntityRefSchema.optional(),
    replayedFromRef: EntityRefSchema.optional(),
    collectionAssetRef: TrendRadarCollectionAssetRefSchema.optional(),
    collectionProjectionWriteback: TrendRadarCollectionProjectionWritebackSchema.optional(),
    workflowDefinitionTeamId: ContractIdentifierSchema.optional(),
    workflowInput: z.record(z.string(), JsonValueSchema).default({}),
    createDesignProject: z.boolean().default(true),
    designProjectName: z.string().trim().min(1).max(200).optional(),
    modelRef: EntityRefSchema,
    requestId: ContractIdentifierSchema,
    idempotencyKey: ContractIdentifierSchema,
    status: z.enum(['QUEUED', 'RUNNING', 'SUCCEEDED', 'FAILED', 'CANCELLED', 'PARTIAL']),
    outputRefs: z.array(EntityRefSchema).default([]),
    error: z
      .object({
        code: ContractIdentifierSchema,
        message: z.string().trim().min(1),
        retryable: z.boolean(),
      })
      .strict()
      .optional(),
    startedAt: IsoDateTimeSchema.optional(),
    completedAt: IsoDateTimeSchema.optional(),
    createdAt: IsoDateTimeSchema,
  })
  .strict();

export const RadarAnalysisAssetSchema = z
  .object({
    artifactRef: EntityRefSchema,
    kind: ContractIdentifierSchema,
    mimeType: z.string().trim().min(1).optional(),
    url: z.string().url(),
    metadata: z.record(z.string(), JsonValueSchema).default({}),
    createdAt: IsoDateTimeSchema,
  })
  .strict();

export const RadarAnalysisDetailSchema = z
  .object({
    contract: z.literal('RadarAnalysisDetail'),
    run: RadarAnalysisRunSchema,
    runVersion: z.number().int().positive(),
    selection: RadarSelectionSchema,
    outputs: z.array(OutputRecordSchema),
    assets: z.array(RadarAnalysisAssetSchema),
    lineage: z.array(LineageRecordSchema),
  })
  .strict();

export const RadarActionRecordSchema = z
  .object({
    contract: z.literal('RadarActionRecord'),
    actionId: ContractIdentifierSchema,
    teamId: ContractIdentifierSchema,
    actorRef: EntityRefSchema,
    action: z.enum(['stash', 'select', 'reject', 'archive', 'launch', 'retry', 'replay', 'rollback']),
    targetRef: EntityRefSchema,
    requestId: ContractIdentifierSchema,
    idempotencyKey: ContractIdentifierSchema,
    expectedVersion: z.number().int().nonnegative(),
    occurredAt: IsoDateTimeSchema,
  })
  .strict();

export const RadarWritebackRecordSchema = z
  .object({
    contract: z.literal('RadarWritebackRecord'),
    writebackId: ContractIdentifierSchema,
    actionRef: EntityRefSchema,
    targetRef: EntityRefSchema,
    status: z.enum(['PENDING', 'APPLIED', 'FAILED']),
    resultingVersion: z.number().int().nonnegative().optional(),
    error: z.string().trim().min(1).optional(),
    recordedAt: IsoDateTimeSchema,
  })
  .strict();

export type TrendSource = z.infer<typeof TrendSourceSchema>;
export type TrendIngestRun = z.infer<typeof TrendIngestRunSchema>;
export type TrendSourceRecord = z.infer<typeof TrendSourceRecordSchema>;
export type HotwordBody = z.infer<typeof HotwordBodySchema>;
export type BrandBody = z.infer<typeof BrandBodySchema>;
export type ProductBody = z.infer<typeof ProductBodySchema>;
export type TrendMetricSnapshot = z.infer<typeof TrendMetricSnapshotSchema>;
export type RadarDecisionMetrics = z.infer<typeof RadarDecisionMetricsSchema>;
export type RadarScoreModelBody = z.infer<typeof RadarScoreModelBodySchema>;
export type RadarScoreProjection = z.infer<typeof RadarScoreProjectionSchema>;
export type RadarPanorama = z.infer<typeof RadarPanoramaSchema>;
export type BrandGeneticsProfile = z.infer<typeof BrandGeneticsProfileSchema>;
export type RadarOpportunityMatrix = z.infer<typeof RadarOpportunityMatrixSchema>;
export type RadarQueryBody = z.infer<typeof RadarQueryBodySchema>;
export type SavedRadarQuery = z.infer<typeof SavedRadarQuerySchema>;
export type RadarSelection = z.infer<typeof RadarSelectionSchema>;
export type TrendRadarCollectionAssetRef = z.infer<typeof TrendRadarCollectionAssetRefSchema>;
export type TrendRadarCollectionSelectionRef = z.infer<typeof TrendRadarCollectionSelectionRefSchema>;
export type TrendRadarCollectionRunRef = z.infer<typeof TrendRadarCollectionRunRefSchema>;
export type TrendRadarCollectionSubjectRef = z.infer<typeof TrendRadarCollectionSubjectRefSchema>;
export type TrendRadarCollectionArtifactRef = z.infer<typeof TrendRadarCollectionArtifactRefSchema>;
export type TrendRadarCollectionRecipeEntry = z.infer<typeof TrendRadarCollectionRecipeEntrySchema>;
export type TrendRadarCollectionRecipe = z.infer<typeof TrendRadarCollectionRecipeSchema>;
export type TrendRadarCollectionDecisionAxis = z.infer<typeof TrendRadarCollectionDecisionAxisSchema>;
export type TrendRadarCollectionDecisionProjection = z.infer<typeof TrendRadarCollectionDecisionProjectionSchema>;
export type TrendRadarCollectionArtifactProjection = z.infer<typeof TrendRadarCollectionArtifactProjectionSchema>;
export type TrendRadarCollectionProjectionWriteback = z.infer<typeof TrendRadarCollectionProjectionWritebackSchema>;
export type TrendRadarCollectionItem = z.infer<typeof TrendRadarCollectionItemSchema>;
export type RadarAnalysisRun = z.infer<typeof RadarAnalysisRunSchema>;
export type RadarAnalysisAsset = z.infer<typeof RadarAnalysisAssetSchema>;
export type RadarAnalysisDetail = z.infer<typeof RadarAnalysisDetailSchema>;
export type RadarActionRecord = z.infer<typeof RadarActionRecordSchema>;
export type RadarWritebackRecord = z.infer<typeof RadarWritebackRecordSchema>;
