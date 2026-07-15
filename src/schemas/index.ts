export {
  ArtifactManifestSchema,
  OutputRecordSchema,
  StorageLocatorSchema,
} from '../contracts/artifact';
export {
  CapabilityManifestSchema,
  ContractPortSchema,
} from '../contracts/capability';
export {
  ContractMetadataSchema,
  EntityRefSchema,
  JsonObjectSchema,
  JsonValueSchema,
} from '../contracts/common';
export {
  AgentRuntimeEventSchema,
  CompletionEventSchema,
  CompletionHeaderSchema,
  ExecutionLinkSchema,
  RequestScopeSchema,
} from '../contracts/context';
export {
  DomainEventSchema,
  LineageRecordSchema,
  OntologyDefinitionSchema,
  ProjectionSpecSchema,
  SourceRecordRefSchema,
} from '../contracts/data';
export {
  PageDefinitionSchema,
  PageRuntimeDescriptorSchema,
} from '../contracts/page';
export {
  ApplicationHandoffEndpointSchema,
  ApplicationHandoffSchema,
  OverlayNodeSchema,
  ProductContextSchema,
  RenderNodeSchema,
  RenderNodeStateSchema,
  ViewProviderDescriptorSchema,
} from '../contracts/render';
export { TenantProductConfigSchema } from '../contracts/tenant';
export {
  ThemeTokenSchema,
  ThemeTokensSchema,
} from '../contracts/theme';
export {
  BrandGeneticsProfileSchema,
  BrandBodySchema,
  HotwordBodySchema,
  ProductBodySchema,
  RadarActionRecordSchema,
  RadarAnalysisRunSchema,
  RadarDecisionMetricsSchema,
  RadarOpportunityMatrixSchema,
  RadarOpportunityMatrixPointSchema,
  RadarPanoramaEdgeSchema,
  RadarPanoramaNodeSchema,
  RadarPanoramaSchema,
  RadarQueryBodySchema,
  RadarScoreModelBodySchema,
  RadarScoreProjectionSchema,
  RadarSelectionSchema,
  RadarWritebackRecordSchema,
  SavedRadarQuerySchema,
  TrendIngestRunSchema,
  TrendMetricSnapshotSchema,
  TrendSourceSchema,
  TrendSourceRecordSchema,
} from '../contracts/trend';
export {
  WorkflowDefinitionSchema,
  WorkflowEdgeSchema,
  WorkflowNodeSchema,
} from '../contracts/workflow-definition';

import { ArtifactManifestSchema, OutputRecordSchema } from '../contracts/artifact';
import { CapabilityManifestSchema } from '../contracts/capability';
import {
  AgentRuntimeEventSchema,
  CompletionEventSchema,
  CompletionHeaderSchema,
  ExecutionLinkSchema,
  RequestScopeSchema,
} from '../contracts/context';
import {
  DomainEventSchema,
  LineageRecordSchema,
  OntologyDefinitionSchema,
  ProjectionSpecSchema,
} from '../contracts/data';
import { PageDefinitionSchema, PageRuntimeDescriptorSchema } from '../contracts/page';
import {
  ApplicationHandoffSchema,
  OverlayNodeSchema,
  RenderNodeSchema,
  ViewProviderDescriptorSchema,
} from '../contracts/render';
import { TenantProductConfigSchema } from '../contracts/tenant';
import { ThemeTokensSchema } from '../contracts/theme';
import {
  BrandGeneticsProfileSchema,
  BrandBodySchema,
  HotwordBodySchema,
  ProductBodySchema,
  RadarActionRecordSchema,
  RadarAnalysisRunSchema,
  RadarOpportunityMatrixSchema,
  RadarPanoramaSchema,
  RadarQueryBodySchema,
  RadarScoreModelBodySchema,
  RadarScoreProjectionSchema,
  RadarSelectionSchema,
  RadarWritebackRecordSchema,
  SavedRadarQuerySchema,
  TrendIngestRunSchema,
  TrendMetricSnapshotSchema,
  TrendSourceRecordSchema,
} from '../contracts/trend';
import { WorkflowDefinitionSchema } from '../contracts/workflow-definition';

export const canonicalContractSchemas = {
  'agent-runtime-event': AgentRuntimeEventSchema,
  'application-handoff': ApplicationHandoffSchema,
  'artifact-manifest': ArtifactManifestSchema,
  'brand-body': BrandBodySchema,
  'brand-genetics-profile': BrandGeneticsProfileSchema,
  'capability-manifest': CapabilityManifestSchema,
  'completion-event': CompletionEventSchema,
  'completion-header': CompletionHeaderSchema,
  'domain-event': DomainEventSchema,
  'execution-link': ExecutionLinkSchema,
  'hotword-body': HotwordBodySchema,
  'lineage-record': LineageRecordSchema,
  'ontology-definition': OntologyDefinitionSchema,
  'overlay-node': OverlayNodeSchema,
  'output-record': OutputRecordSchema,
  'page-definition': PageDefinitionSchema,
  'page-runtime-descriptor': PageRuntimeDescriptorSchema,
  'projection-spec': ProjectionSpecSchema,
  'product-body': ProductBodySchema,
  'radar-action-record': RadarActionRecordSchema,
  'radar-analysis-run': RadarAnalysisRunSchema,
  'radar-opportunity-matrix': RadarOpportunityMatrixSchema,
  'radar-panorama': RadarPanoramaSchema,
  'radar-query-body': RadarQueryBodySchema,
  'radar-score-model-body': RadarScoreModelBodySchema,
  'radar-score-projection': RadarScoreProjectionSchema,
  'radar-selection': RadarSelectionSchema,
  'radar-writeback-record': RadarWritebackRecordSchema,
  'request-scope': RequestScopeSchema,
  'render-node': RenderNodeSchema,
  'saved-radar-query': SavedRadarQuerySchema,
  'tenant-product-config': TenantProductConfigSchema,
  'theme-tokens': ThemeTokensSchema,
  'trend-ingest-run': TrendIngestRunSchema,
  'trend-metric-snapshot': TrendMetricSnapshotSchema,
  'trend-source-record': TrendSourceRecordSchema,
  'view-provider-descriptor': ViewProviderDescriptorSchema,
  'workflow-definition': WorkflowDefinitionSchema,
} as const;

export type CanonicalContractSchemaName = keyof typeof canonicalContractSchemas;
