export {
  ArtifactManifestSchema,
  OutputRecordSchema,
  StorageLocatorSchema,
} from '../contracts/artifact';
export {
  CapabilityRegistryDocumentSchema,
  CapabilityRegistryEntrySchema,
  CapabilityRegistrySourceSchema,
  CapabilitySourceTypeSchema,
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
  ApplicationRunSchema,
  BodyRelationRecordSchema,
  DataContinuityEnvelopeSchema,
  ExpiringAccessGrantSchema,
} from '../contracts/continuity';
export {
  DomainEventSchema,
  LineageRecordSchema,
  OntologyDefinitionSchema,
  ProjectionSpecSchema,
  SourceRecordRefSchema,
} from '../contracts/data';
export {
  PageDefinitionSchema,
  PageGuardProjectionSchema,
  PageNavigationProjectionSchema,
  PageRendererProjectionSchema,
  PageRouteProjectionSchema,
  PageRuntimeDescriptorSchema,
  PageRuntimeProjectionSchema,
  PageTypeSchema,
  PageVisibilitySchema,
} from '../contracts/page';
export {
  ApplicationHandoffEndpointSchema,
  ApplicationHandoffSchema,
  OverlayNodeSchema,
  OverlayZIndexLaneSchema,
  ProductContextSchema,
  RenderActivationSchema,
  RenderLifecycleSchema,
  RenderLayoutSchema,
  RenderNodeKindSchema,
  RenderNodeSchema,
  RenderNodeStateSchema,
  RenderResponsiveRuleSchema,
  RenderScrollSchema,
  RenderSurfaceSchema,
  RenderTreeSchema,
  ViewProviderDescriptorSchema,
} from '../contracts/render';
export {
  ChangeImpactGraphSchema,
  ConceptDefinitionSchema,
  DomainCommandDefinitionSchema,
  DomainCommandSchema,
  ProductDeclarationSchema,
} from '../contracts/semantic';
export {
  TenantApplicationConfigSchema,
  TenantLandingPageConfigSchema,
  TenantProductConfigSchema,
  TenantRuntimeConfigSchema,
  TenantWorkbenchConfigSchema,
  TenantWorkbenchPageContextSchema,
  TenantWorkbenchPageEnvelopeSchema,
  TenantWorkbenchPageGroupSchema,
} from '../contracts/tenant';
export {
  ResolvedThemeTokensSchema,
  ThemeTokenGroupSchema,
  ThemeTokenTypeSchema,
  ThemeTokenSchema,
  ThemeTokensSchema,
} from '../contracts/theme';
export {
  BrandGeneticsProfileSchema,
  BrandBodySchema,
  HotwordBodySchema,
  ProductBodySchema,
  RadarActionRecordSchema,
  RadarAnalysisAssetSchema,
  RadarAnalysisDetailSchema,
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
  ConductorTaskDefinitionSchema,
  ConductorTaskTypeSchema,
  ConductorWorkflowDefinitionSchema,
  WorkflowDefinitionSchema,
  WorkflowEdgeSchema,
  WorkflowNodeSchema,
  WorkflowOutputBindingSchema,
  WorkflowParameterSchema,
  WorkflowParameterTypeSchema,
  WorkflowTriggerSchema,
  WorkflowValidationIssueSchema,
} from '../contracts/workflow-definition';

import { ArtifactManifestSchema, OutputRecordSchema } from '../contracts/artifact';
import { CapabilityManifestSchema, CapabilityRegistryDocumentSchema } from '../contracts/capability';
import {
  AgentRuntimeEventSchema,
  CompletionEventSchema,
  CompletionHeaderSchema,
  ExecutionLinkSchema,
  RequestScopeSchema,
} from '../contracts/context';
import {
  ApplicationRunSchema,
  BodyRelationRecordSchema,
  DataContinuityEnvelopeSchema,
  ExpiringAccessGrantSchema,
} from '../contracts/continuity';
import {
  DomainEventSchema,
  LineageRecordSchema,
  OntologyDefinitionSchema,
  ProjectionSpecSchema,
} from '../contracts/data';
import { PageDefinitionSchema, PageRuntimeDescriptorSchema, PageRuntimeProjectionSchema } from '../contracts/page';
import {
  ApplicationHandoffSchema,
  OverlayNodeSchema,
  RenderNodeSchema,
  RenderTreeSchema,
  ViewProviderDescriptorSchema,
} from '../contracts/render';
import { TenantProductConfigSchema, TenantRuntimeConfigSchema } from '../contracts/tenant';
import {
  ChangeImpactGraphSchema,
  ConceptDefinitionSchema,
  DomainCommandDefinitionSchema,
  DomainCommandSchema,
  ProductDeclarationSchema,
} from '../contracts/semantic';
import { ThemeTokensSchema } from '../contracts/theme';
import {
  BrandGeneticsProfileSchema,
  BrandBodySchema,
  HotwordBodySchema,
  ProductBodySchema,
  RadarActionRecordSchema,
  RadarAnalysisDetailSchema,
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
import { ConductorWorkflowDefinitionSchema, WorkflowDefinitionSchema } from '../contracts/workflow-definition';

export const canonicalContractSchemas = {
  'agent-runtime-event': AgentRuntimeEventSchema,
  'application-run': ApplicationRunSchema,
  'application-handoff': ApplicationHandoffSchema,
  'artifact-manifest': ArtifactManifestSchema,
  'brand-body': BrandBodySchema,
  'body-relation-record': BodyRelationRecordSchema,
  'brand-genetics-profile': BrandGeneticsProfileSchema,
  'capability-manifest': CapabilityManifestSchema,
  'capability-registry': CapabilityRegistryDocumentSchema,
  'change-impact-graph': ChangeImpactGraphSchema,
  'concept-definition': ConceptDefinitionSchema,
  'completion-event': CompletionEventSchema,
  'completion-header': CompletionHeaderSchema,
  'conductor-workflow-definition': ConductorWorkflowDefinitionSchema,
  'domain-event': DomainEventSchema,
  'domain-command': DomainCommandSchema,
  'domain-command-definition': DomainCommandDefinitionSchema,
  'data-continuity-envelope': DataContinuityEnvelopeSchema,
  'execution-link': ExecutionLinkSchema,
  'expiring-access-grant': ExpiringAccessGrantSchema,
  'hotword-body': HotwordBodySchema,
  'lineage-record': LineageRecordSchema,
  'ontology-definition': OntologyDefinitionSchema,
  'overlay-node': OverlayNodeSchema,
  'output-record': OutputRecordSchema,
  'page-definition': PageDefinitionSchema,
  'page-runtime-descriptor': PageRuntimeDescriptorSchema,
  'page-runtime-projection': PageRuntimeProjectionSchema,
  'projection-spec': ProjectionSpecSchema,
  'product-declaration': ProductDeclarationSchema,
  'product-body': ProductBodySchema,
  'radar-action-record': RadarActionRecordSchema,
  'radar-analysis-detail': RadarAnalysisDetailSchema,
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
  'render-tree': RenderTreeSchema,
  'saved-radar-query': SavedRadarQuerySchema,
  'tenant-product-config': TenantProductConfigSchema,
  'tenant-runtime-config': TenantRuntimeConfigSchema,
  'theme-tokens': ThemeTokensSchema,
  'trend-ingest-run': TrendIngestRunSchema,
  'trend-metric-snapshot': TrendMetricSnapshotSchema,
  'trend-source-record': TrendSourceRecordSchema,
  'view-provider-descriptor': ViewProviderDescriptorSchema,
  'workflow-definition': WorkflowDefinitionSchema,
} as const;

export type CanonicalContractSchemaName = keyof typeof canonicalContractSchemas;
