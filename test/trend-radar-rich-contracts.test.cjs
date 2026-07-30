'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const contracts = require('../lib/contracts');
const schemas = require('../lib/schemas');

const occurredAt = '2026-07-30T08:00:00.000Z';
const laterAt = '2026-07-31T08:00:00.000Z';
const ref = (kind, id) => ({ kind, id });

const body = {
  contract: 'HotwordBody',
  hotwordId: 'hotword-1',
  label: 'Outdoor',
  normalizedLabel: 'outdoor',
  categories: ['outdoor'],
  sourceRefs: [{
    sourceId: 'source-1',
    provider: 'internal',
    channel: 'internal',
    collectedAt: occurredAt,
  }],
  createdAt: occurredAt,
  updatedAt: occurredAt,
};

const score = {
  contract: 'RadarScoreProjection',
  projectionId: 'projection-1',
  subjectRef: ref('hotword', 'hotword-1'),
  modelRef: ref('model', 'radar-v1'),
  totalScore: 88,
  dimensions: {
    currentSales: 82,
    forecastSales: 91,
    searchHeat: 88,
    socialHeat: 79,
    confidence: 0.93,
  },
  evidenceRefs: [ref('evidence', 'evidence-1')],
  freshnessAt: occurredAt,
};

const media = {
  mediaId: 'media-1',
  subjectRef: ref('hotword', 'hotword-1'),
  kind: 'image',
  url: 'https://example.com/outdoor.png',
  thumbnailUrl: 'https://example.com/outdoor-thumb.png',
  dimensions: { width: 1200, height: 800 },
  capturedAt: occurredAt,
  evidenceRefs: [ref('evidence', 'evidence-1')],
};

const metricPoint = {
  observedAt: occurredAt,
  metrics: { currentSales: 82, searchHeat: 88 },
  confidence: 0.93,
};

const forecast = {
  forecastId: 'forecast-1',
  subjectRef: ref('hotword', 'hotword-1'),
  metric: 'forecastSales',
  modelRef: ref('model', 'forecast-v1'),
  origin: 'internal-demand-model',
  trainingWindow: { startAt: '2026-07-01T08:00:00.000Z', endAt: occurredAt },
  horizon: { startAt: occurredAt, endAt: laterAt },
  points: [{ forecastAt: laterAt, estimate: 91, lower: 84, upper: 97 }],
  confidence: 0.9,
  freshnessAt: occurredAt,
};

const recommendation = {
  recommendationId: 'recommendation-1',
  subjectRef: ref('hotword', 'hotword-1'),
  targetRef: ref('hotword', 'hotword-2'),
  relation: 'related-opportunity',
  score: 0.82,
  rationale: 'Shared demand signal',
  evidenceRefs: [ref('evidence', 'evidence-1')],
};

const richDetail = {
  contract: 'RadarOpportunityDetail',
  body,
  version: 1,
  score,
  media: [media],
  metricSeries: [metricPoint],
  forecasts: [forecast],
  recommendations: [recommendation],
  facets: { season: ['summer'], risk: ['low'] },
  moduleAvailability: {
    media: { status: 'available', updatedAt: occurredAt },
    forecast: { status: 'available', evidenceRefs: [ref('evidence', 'evidence-1')] },
    comments: { status: 'unavailable', reasonCode: 'not-projected' },
  },
};

const issuePaths = (result) => result.error.issues.map((issue) => issue.path.join('.'));

test('exports rich Radar schemas through package contracts, schemas, and canonical JSON Schema registry', () => {
  assert.equal(contracts.RadarOpportunitySummarySchema, schemas.RadarOpportunitySummarySchema);
  assert.equal(contracts.RadarOpportunityDetailSchema, schemas.RadarOpportunityDetailSchema);
  assert.equal(contracts.RadarDecisionReportSchema, schemas.RadarDecisionReportSchema);
  assert.equal(schemas.canonicalContractSchemas['radar-opportunity-summary'], schemas.RadarOpportunitySummarySchema);
  assert.equal(schemas.canonicalContractSchemas['radar-opportunity-detail'], schemas.RadarOpportunityDetailSchema);
  assert.equal(schemas.canonicalContractSchemas['radar-decision-report'], schemas.RadarDecisionReportSchema);
});

test('keeps legacy opportunity payloads parseable and supplies explicit empty rich modules', () => {
  const summary = schemas.RadarOpportunitySummarySchema.parse({ body, version: 1, score });
  assert.equal(summary.contract, 'RadarOpportunitySummary');
  assert.deepEqual(summary.metricSeries, []);
  assert.deepEqual(summary.facets, {});
  assert.deepEqual(summary.moduleAvailability, {});

  const detail = schemas.RadarOpportunityDetailSchema.parse({ body, version: 1, score, metrics: [], lineage: [] });
  assert.equal(detail.contract, 'RadarOpportunityDetail');
  assert.deepEqual(detail.media, []);
  assert.deepEqual(detail.forecasts, []);
  assert.deepEqual(detail.recommendations, []);
});

test('parses and JSON round-trips rich opportunity, brand, and decision-report contracts', () => {
  const parsedDetail = schemas.RadarOpportunityDetailSchema.parse(richDetail);
  assert.deepEqual(
    schemas.RadarOpportunityDetailSchema.parse(JSON.parse(JSON.stringify(parsedDetail))),
    parsedDetail,
  );

  const brandProfile = schemas.BrandGeneticsProfileSchema.parse({
    contract: 'BrandGeneticsProfile',
    brandRef: ref('brand', 'brand-1'),
    categories: ['outdoor'],
    signature: { currentSales: 82 },
    media: [{ ...media, mediaId: 'brand-media-1', subjectRef: ref('brand', 'brand-1') }],
    productRefs: [ref('product', 'product-1')],
    recommendedBrandRefs: [ref('brand', 'brand-2')],
    moduleAvailability: { recommendations: { status: 'available' } },
    computedAt: occurredAt,
  });
  assert.equal(brandProfile.recommendedBrandRefs[0].id, 'brand-2');

  const report = schemas.RadarDecisionReportSchema.parse({
    axes: [
      { key: 'market-potential', label: 'Market potential', score: 88, weight: 0.5 },
      { key: 'brand-fit', label: 'Brand fit', score: 84, weight: 0.5 },
    ],
    overallScore: 86,
    formulaFields: [
      { key: 'formula-category', label: 'Formula category', value: 'Lightweight outerwear' },
      { key: 'growth-rate', label: 'Growth rate', value: 0.42, unit: 'ratio' },
    ],
    sections: [{ sectionId: 'summary', title: 'Decision summary', findings: ['Strong opportunity'] }],
    combinationGraph: {
      nodes: [
        { nodeId: 'hotword-1', ref: ref('hotword', 'hotword-1'), kind: 'hotword', label: 'Outdoor' },
        { nodeId: 'brand-1', ref: ref('brand', 'brand-1'), kind: 'brand', label: 'Northwind' },
      ],
      edges: [{
        edgeId: 'edge-1',
        sourceNodeId: 'hotword-1',
        targetNodeId: 'brand-1',
        relation: 'brand-fit',
        weight: 0.84,
      }],
    },
    moduleAvailability: { combinationGraph: { status: 'available' } },
  });
  assert.equal(report.contract, 'RadarDecisionReport');
  assert.equal(report.combinationGraph.edges.length, 1);
});

test('reports useful paths for invalid rich opportunity boundary values', () => {
  const invalidUrl = schemas.RadarOpportunityDetailSchema.safeParse({
    ...richDetail,
    media: [{ ...media, url: 'not-a-url' }],
  });
  assert.equal(invalidUrl.success, false);
  assert.ok(issuePaths(invalidUrl).includes('media.0.url'));

  const invalidDate = schemas.RadarOpportunityDetailSchema.safeParse({
    ...richDetail,
    metricSeries: [{ ...metricPoint, observedAt: '2026-07-30' }],
  });
  assert.equal(invalidDate.success, false);
  assert.ok(issuePaths(invalidDate).includes('metricSeries.0.observedAt'));

  const nonFinite = schemas.RadarOpportunityDetailSchema.safeParse({
    ...richDetail,
    metricSeries: [{ ...metricPoint, metrics: { currentSales: Number.POSITIVE_INFINITY } }],
  });
  assert.equal(nonFinite.success, false);
  assert.ok(issuePaths(nonFinite).includes('metricSeries.0.metrics.currentSales'));

  const invalidBounds = schemas.RadarOpportunityDetailSchema.safeParse({
    ...richDetail,
    forecasts: [{ ...forecast, points: [{ forecastAt: laterAt, estimate: 91, lower: 92, upper: 97 }] }],
  });
  assert.equal(invalidBounds.success, false);
  assert.ok(issuePaths(invalidBounds).includes('forecasts.0.points.0.lower'));

  const unknownAvailability = schemas.RadarOpportunityDetailSchema.safeParse({
    ...richDetail,
    moduleAvailability: { forecast: { status: 'maybe' } },
  });
  assert.equal(unknownAvailability.success, false);
  assert.ok(issuePaths(unknownAvailability).includes('moduleAvailability.forecast.status'));
});

test('rejects duplicate identities and dangling combination graph edges at their paths', () => {
  const duplicateMedia = schemas.RadarOpportunityDetailSchema.safeParse({
    ...richDetail,
    media: [media, { ...media }],
  });
  assert.equal(duplicateMedia.success, false);
  assert.ok(issuePaths(duplicateMedia).includes('media.1'));

  const duplicateRecommendation = schemas.RadarOpportunityDetailSchema.safeParse({
    ...richDetail,
    recommendations: [recommendation, { ...recommendation }],
  });
  assert.equal(duplicateRecommendation.success, false);
  assert.ok(issuePaths(duplicateRecommendation).includes('recommendations.1'));

  const danglingGraph = schemas.RadarDecisionReportSchema.safeParse({
    combinationGraph: {
      nodes: [{ nodeId: 'hotword-1', kind: 'hotword', label: 'Outdoor' }],
      edges: [{
        edgeId: 'edge-1',
        sourceNodeId: 'hotword-1',
        targetNodeId: 'missing-brand',
        relation: 'brand-fit',
      }],
    },
  });
  assert.equal(danglingGraph.success, false);
  assert.ok(issuePaths(danglingGraph).includes('combinationGraph.edges.0.targetNodeId'));
});
