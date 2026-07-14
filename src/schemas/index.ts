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
export { TenantProductConfigSchema } from '../contracts/tenant';
export {
  ThemeTokenSchema,
  ThemeTokensSchema,
} from '../contracts/theme';
export {
  HotwordBodySchema,
  RadarScoreProjectionSchema,
  RadarSelectionSchema,
  TrendMetricSnapshotSchema,
  TrendSourceSchema,
} from '../contracts/trend';
export {
  WorkflowDefinitionSchema,
  WorkflowEdgeSchema,
  WorkflowNodeSchema,
} from '../contracts/workflow-definition';

import { ArtifactManifestSchema, OutputRecordSchema } from '../contracts/artifact';
import { CapabilityManifestSchema } from '../contracts/capability';
import {
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
import { TenantProductConfigSchema } from '../contracts/tenant';
import { ThemeTokensSchema } from '../contracts/theme';
import {
  HotwordBodySchema,
  RadarScoreProjectionSchema,
  RadarSelectionSchema,
  TrendMetricSnapshotSchema,
} from '../contracts/trend';
import { WorkflowDefinitionSchema } from '../contracts/workflow-definition';

export const canonicalContractSchemas = {
  'artifact-manifest': ArtifactManifestSchema,
  'capability-manifest': CapabilityManifestSchema,
  'completion-event': CompletionEventSchema,
  'completion-header': CompletionHeaderSchema,
  'domain-event': DomainEventSchema,
  'execution-link': ExecutionLinkSchema,
  'hotword-body': HotwordBodySchema,
  'lineage-record': LineageRecordSchema,
  'ontology-definition': OntologyDefinitionSchema,
  'output-record': OutputRecordSchema,
  'page-definition': PageDefinitionSchema,
  'page-runtime-descriptor': PageRuntimeDescriptorSchema,
  'projection-spec': ProjectionSpecSchema,
  'radar-score-projection': RadarScoreProjectionSchema,
  'radar-selection': RadarSelectionSchema,
  'request-scope': RequestScopeSchema,
  'tenant-product-config': TenantProductConfigSchema,
  'theme-tokens': ThemeTokensSchema,
  'trend-metric-snapshot': TrendMetricSnapshotSchema,
  'workflow-definition': WorkflowDefinitionSchema,
} as const;

export type CanonicalContractSchemaName = keyof typeof canonicalContractSchemas;
