import { z } from 'zod';
import {
  ContractIdentifierSchema,
  EntityRefSchema,
  IsoDateTimeSchema,
  JsonValueSchema,
  Sha256Schema,
} from './common';
import { LineageRecordSchema } from './data';
import { OutputRecordSchema } from './artifact';

const entityRefIdentity = (value: z.infer<typeof EntityRefSchema>) =>
  `${value.kind}:${value.id}:${value.version === undefined ? '' : String(value.version)}`;

const duplicateIdentityIndex = <T>(values: readonly T[], identity: (value: T) => string): number | undefined => {
  const seen = new Set<string>();
  for (let index = 0; index < values.length; index += 1) {
    const key = identity(values[index]);
    if (seen.has(key)) return index;
    seen.add(key);
  }
  return undefined;
};

const DateRangeSchema = z
  .object({
    startAt: IsoDateTimeSchema,
    endAt: IsoDateTimeSchema,
  })
  .strict()
  .superRefine((value, context) => {
    if (Date.parse(value.startAt) > Date.parse(value.endAt)) {
      context.addIssue({
        code: 'custom',
        path: ['endAt'],
        message: 'Date range endAt must be on or after startAt.',
      });
    }
  });

export const RadarModuleAvailabilitySchema = z
  .object({
    status: z.enum(['available', 'empty', 'unavailable']),
    reasonCode: ContractIdentifierSchema.optional(),
    message: z.string().trim().min(1).optional(),
    evidenceRefs: z.array(EntityRefSchema).default([]),
    updatedAt: IsoDateTimeSchema.optional(),
  })
  .strict();

export const RadarModuleAvailabilityMapSchema = z
  .record(ContractIdentifierSchema, RadarModuleAvailabilitySchema)
  .default({});

export const TrendMediaAssetSchema = z
  .object({
    mediaId: ContractIdentifierSchema,
    subjectRef: EntityRefSchema.optional(),
    kind: z.enum(['image', 'video', 'audio', 'document']),
    url: z.string().url(),
    thumbnailUrl: z.string().url().optional(),
    mimeType: z.string().trim().min(1).optional(),
    title: z.string().trim().min(1).optional(),
    alt: z.string().trim().min(1).optional(),
    dimensions: z
      .object({
        width: z.number().int().positive(),
        height: z.number().int().positive(),
      })
      .strict()
      .optional(),
    capturedAt: IsoDateTimeSchema.optional(),
    evidenceRefs: z.array(EntityRefSchema).default([]),
  })
  .strict();

export const TrendMetricSeriesPointSchema = z
  .object({
    observedAt: IsoDateTimeSchema,
    metrics: z
      .record(ContractIdentifierSchema, z.number().finite())
      .refine((value) => Object.keys(value).length > 0, 'Metric series points must contain at least one metric.'),
    confidence: z.number().min(0).max(1).optional(),
    evidenceRefs: z.array(EntityRefSchema).default([]),
  })
  .strict();

export const RadarForecastPointSchema = z
  .object({
    forecastAt: IsoDateTimeSchema,
    estimate: z.number().finite(),
    lower: z.number().finite().optional(),
    upper: z.number().finite().optional(),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.lower !== undefined && value.lower > value.estimate) {
      context.addIssue({
        code: 'custom',
        path: ['lower'],
        message: 'Forecast lower bound must not exceed estimate.',
      });
    }
    if (value.upper !== undefined && value.upper < value.estimate) {
      context.addIssue({
        code: 'custom',
        path: ['upper'],
        message: 'Forecast upper bound must not be below estimate.',
      });
    }
  });

export const RadarForecastSeriesSchema = z
  .object({
    forecastId: ContractIdentifierSchema,
    subjectRef: EntityRefSchema,
    metric: ContractIdentifierSchema,
    modelRef: EntityRefSchema,
    origin: ContractIdentifierSchema,
    trainingWindow: DateRangeSchema.optional(),
    horizon: DateRangeSchema,
    points: z.array(RadarForecastPointSchema).min(1),
    confidence: z.number().min(0).max(1).optional(),
    freshnessAt: IsoDateTimeSchema,
    evidenceRefs: z.array(EntityRefSchema).default([]),
  })
  .strict()
  .superRefine((value, context) => {
    const duplicatePoint = duplicateIdentityIndex(value.points, (point) => point.forecastAt);
    if (duplicatePoint !== undefined) {
      context.addIssue({
        code: 'custom',
        path: ['points', duplicatePoint, 'forecastAt'],
        message: 'Forecast point timestamps must be unique within a series.',
      });
    }
    const horizonStart = Date.parse(value.horizon.startAt);
    const horizonEnd = Date.parse(value.horizon.endAt);
    value.points.forEach((point, index) => {
      const pointTime = Date.parse(point.forecastAt);
      if (pointTime < horizonStart || pointTime > horizonEnd) {
        context.addIssue({
          code: 'custom',
          path: ['points', index, 'forecastAt'],
          message: 'Forecast point must fall within the declared horizon.',
        });
      }
    });
  });

export const RadarFacetMapSchema = z
  .record(ContractIdentifierSchema, z.array(ContractIdentifierSchema))
  .superRefine((facets, context) => {
    for (const [facet, values] of Object.entries(facets)) {
      const duplicateValue = duplicateIdentityIndex(values, (value) => value);
      if (duplicateValue !== undefined) {
        context.addIssue({
          code: 'custom',
          path: [facet, duplicateValue],
          message: `Facet ${facet} must not contain duplicate values.`,
        });
      }
    }
  })
  .default({});

export const RadarRecommendationSchema = z
  .object({
    recommendationId: ContractIdentifierSchema,
    subjectRef: EntityRefSchema,
    targetRef: EntityRefSchema,
    relation: ContractIdentifierSchema,
    score: z.number().min(0).max(1).optional(),
    rationale: z.string().trim().min(1).optional(),
    evidenceRefs: z.array(EntityRefSchema).default([]),
  })
  .strict();

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
    media: z.array(TrendMediaAssetSchema).default([]),
    productRefs: z.array(EntityRefSchema).default([]),
    recommendedBrandRefs: z.array(EntityRefSchema).default([]),
    moduleAvailability: RadarModuleAvailabilityMapSchema,
    evidenceRefs: z.array(EntityRefSchema).default([]),
    computedAt: IsoDateTimeSchema,
  })
  .strict()
  .superRefine((value, context) => {
    const duplicates = [
      ['media', duplicateIdentityIndex(value.media, (item) => item.mediaId)],
      ['productRefs', duplicateIdentityIndex(value.productRefs, entityRefIdentity)],
      ['recommendedBrandRefs', duplicateIdentityIndex(value.recommendedBrandRefs, entityRefIdentity)],
    ] as const;
    for (const [field, duplicate] of duplicates) {
      if (duplicate !== undefined) {
        context.addIssue({
          code: 'custom',
          path: [field, duplicate],
          message: `${field} identities must be unique within a brand genetics profile.`,
        });
      }
    }
  });

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

const RadarOpportunityBodySchema = z.union([HotwordBodySchema, BrandBodySchema, ProductBodySchema]);

const RadarOpportunityCoreFields = {
  body: RadarOpportunityBodySchema,
  version: z.number().int().positive(),
  score: RadarScoreProjectionSchema,
};

export const RadarOpportunitySummarySchema = z
  .object({
    contract: z.literal('RadarOpportunitySummary').default('RadarOpportunitySummary'),
    ...RadarOpportunityCoreFields,
    mediaPreview: TrendMediaAssetSchema.optional(),
    metricSeries: z.array(TrendMetricSeriesPointSchema).default([]),
    facets: RadarFacetMapSchema,
    moduleAvailability: RadarModuleAvailabilityMapSchema,
  })
  .strict()
  .superRefine((value, context) => {
    const duplicatePoint = duplicateIdentityIndex(value.metricSeries, (point) => point.observedAt);
    if (duplicatePoint !== undefined) {
      context.addIssue({
        code: 'custom',
        path: ['metricSeries', duplicatePoint, 'observedAt'],
        message: 'Metric series timestamps must be unique within an opportunity summary.',
      });
    }
  });

export const RadarOpportunityDetailSchema = z
  .object({
    contract: z.literal('RadarOpportunityDetail').default('RadarOpportunityDetail'),
    ...RadarOpportunityCoreFields,
    metrics: z.array(TrendMetricSnapshotSchema).default([]),
    lineage: z.array(LineageRecordSchema).default([]),
    media: z.array(TrendMediaAssetSchema).default([]),
    metricSeries: z.array(TrendMetricSeriesPointSchema).default([]),
    forecasts: z.array(RadarForecastSeriesSchema).default([]),
    recommendations: z.array(RadarRecommendationSchema).default([]),
    facets: RadarFacetMapSchema,
    moduleAvailability: RadarModuleAvailabilityMapSchema,
  })
  .strict()
  .superRefine((value, context) => {
    const duplicates = [
      ['media', duplicateIdentityIndex(value.media, (item) => item.mediaId)],
      ['metricSeries', duplicateIdentityIndex(value.metricSeries, (item) => item.observedAt)],
      ['forecasts', duplicateIdentityIndex(value.forecasts, (item) => item.forecastId)],
      ['recommendations', duplicateIdentityIndex(value.recommendations, (item) => item.recommendationId)],
    ] as const;
    for (const [field, duplicate] of duplicates) {
      if (duplicate !== undefined) {
        context.addIssue({
          code: 'custom',
          path: [field, duplicate],
          message: `${field} identities must be unique within an opportunity detail.`,
        });
      }
    }
  });

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

export const RadarDecisionAxisSchema = z
  .object({
    key: ContractIdentifierSchema,
    label: z.string().trim().min(1),
    score: z.number().finite().min(0).max(100),
    weight: z.number().finite().min(0).max(1).optional(),
    evidenceRefs: z.array(EntityRefSchema).default([]),
  })
  .strict();

export const RadarFormulaFieldSchema = z
  .object({
    key: ContractIdentifierSchema,
    label: z.string().trim().min(1),
    value: JsonValueSchema,
    unit: z.string().trim().min(1).optional(),
    formula: z.string().trim().min(1).optional(),
    evidenceRefs: z.array(EntityRefSchema).default([]),
  })
  .strict();

export const RadarReportSectionSchema = z
  .object({
    sectionId: ContractIdentifierSchema,
    title: z.string().trim().min(1),
    summary: z.string().trim().min(1).optional(),
    findings: z.array(z.string().trim().min(1)).default([]),
    evidenceRefs: z.array(EntityRefSchema).default([]),
  })
  .strict();

export const RadarCombinationGraphNodeSchema = z
  .object({
    nodeId: ContractIdentifierSchema,
    ref: EntityRefSchema.optional(),
    kind: ContractIdentifierSchema,
    label: z.string().trim().min(1),
    score: z.number().finite().optional(),
    metadata: z.record(z.string(), JsonValueSchema).default({}),
  })
  .strict();

export const RadarCombinationGraphEdgeSchema = z
  .object({
    edgeId: ContractIdentifierSchema,
    sourceNodeId: ContractIdentifierSchema,
    targetNodeId: ContractIdentifierSchema,
    relation: ContractIdentifierSchema,
    weight: z.number().finite().optional(),
    evidenceRefs: z.array(EntityRefSchema).default([]),
  })
  .strict();

export const RadarCombinationGraphSchema = z
  .object({
    nodes: z.array(RadarCombinationGraphNodeSchema).default([]),
    edges: z.array(RadarCombinationGraphEdgeSchema).default([]),
  })
  .strict()
  .superRefine((value, context) => {
    const duplicateNode = duplicateIdentityIndex(value.nodes, (node) => node.nodeId);
    if (duplicateNode !== undefined) {
      context.addIssue({
        code: 'custom',
        path: ['nodes', duplicateNode, 'nodeId'],
        message: 'Combination graph node IDs must be unique.',
      });
    }
    const duplicateEdge = duplicateIdentityIndex(value.edges, (edge) => edge.edgeId);
    if (duplicateEdge !== undefined) {
      context.addIssue({
        code: 'custom',
        path: ['edges', duplicateEdge, 'edgeId'],
        message: 'Combination graph edge IDs must be unique.',
      });
    }
    const nodeIds = new Set(value.nodes.map((node) => node.nodeId));
    value.edges.forEach((edge, index) => {
      if (!nodeIds.has(edge.sourceNodeId)) {
        context.addIssue({
          code: 'custom',
          path: ['edges', index, 'sourceNodeId'],
          message: `Combination graph edge references unknown source node ${edge.sourceNodeId}.`,
        });
      }
      if (!nodeIds.has(edge.targetNodeId)) {
        context.addIssue({
          code: 'custom',
          path: ['edges', index, 'targetNodeId'],
          message: `Combination graph edge references unknown target node ${edge.targetNodeId}.`,
        });
      }
    });
  });

export const RadarDecisionReportSchema = z
  .object({
    contract: z.literal('RadarDecisionReport').default('RadarDecisionReport'),
    axes: z.array(RadarDecisionAxisSchema).default([]),
    overallScore: z.number().finite().min(0).max(100).optional(),
    formulaFields: z.array(RadarFormulaFieldSchema).default([]),
    sections: z.array(RadarReportSectionSchema).default([]),
    combinationGraph: RadarCombinationGraphSchema.optional(),
    moduleAvailability: RadarModuleAvailabilityMapSchema,
  })
  .strict()
  .superRefine((value, context) => {
    const duplicates = [
      ['axes', duplicateIdentityIndex(value.axes, (item) => item.key)],
      ['formulaFields', duplicateIdentityIndex(value.formulaFields, (item) => item.key)],
      ['sections', duplicateIdentityIndex(value.sections, (item) => item.sectionId)],
    ] as const;
    for (const [field, duplicate] of duplicates) {
      if (duplicate !== undefined) {
        context.addIssue({
          code: 'custom',
          path: [field, duplicate],
          message: `${field} identities must be unique within a decision report.`,
        });
      }
    }
  });

export const RadarAnalysisDetailSchema = z
  .object({
    contract: z.literal('RadarAnalysisDetail'),
    run: RadarAnalysisRunSchema,
    runVersion: z.number().int().positive(),
    selection: RadarSelectionSchema,
    outputs: z.array(OutputRecordSchema),
    assets: z.array(RadarAnalysisAssetSchema),
    lineage: z.array(LineageRecordSchema),
    decisionReport: RadarDecisionReportSchema.optional(),
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
export type RadarModuleAvailability = z.infer<typeof RadarModuleAvailabilitySchema>;
export type RadarModuleAvailabilityMap = z.infer<typeof RadarModuleAvailabilityMapSchema>;
export type TrendMediaAsset = z.infer<typeof TrendMediaAssetSchema>;
export type TrendMetricSeriesPoint = z.infer<typeof TrendMetricSeriesPointSchema>;
export type RadarForecastPoint = z.infer<typeof RadarForecastPointSchema>;
export type RadarForecastSeries = z.infer<typeof RadarForecastSeriesSchema>;
export type RadarFacetMap = z.infer<typeof RadarFacetMapSchema>;
export type RadarRecommendation = z.infer<typeof RadarRecommendationSchema>;
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
export type RadarOpportunitySummary = z.infer<typeof RadarOpportunitySummarySchema>;
export type RadarOpportunityDetail = z.infer<typeof RadarOpportunityDetailSchema>;
export type RadarQueryBody = z.infer<typeof RadarQueryBodySchema>;
export type SavedRadarQuery = z.infer<typeof SavedRadarQuerySchema>;
export type RadarSelection = z.infer<typeof RadarSelectionSchema>;
export type RadarAnalysisRun = z.infer<typeof RadarAnalysisRunSchema>;
export type RadarAnalysisAsset = z.infer<typeof RadarAnalysisAssetSchema>;
export type RadarDecisionAxis = z.infer<typeof RadarDecisionAxisSchema>;
export type RadarFormulaField = z.infer<typeof RadarFormulaFieldSchema>;
export type RadarReportSection = z.infer<typeof RadarReportSectionSchema>;
export type RadarCombinationGraphNode = z.infer<typeof RadarCombinationGraphNodeSchema>;
export type RadarCombinationGraphEdge = z.infer<typeof RadarCombinationGraphEdgeSchema>;
export type RadarCombinationGraph = z.infer<typeof RadarCombinationGraphSchema>;
export type RadarDecisionReport = z.infer<typeof RadarDecisionReportSchema>;
export type RadarAnalysisDetail = z.infer<typeof RadarAnalysisDetailSchema>;
export type RadarActionRecord = z.infer<typeof RadarActionRecordSchema>;
export type RadarWritebackRecord = z.infer<typeof RadarWritebackRecordSchema>;
