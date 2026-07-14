export {
  ArtifactManifestV1Schema,
  OutputRecordV1Schema,
  StorageLocatorV1Schema,
} from '../contracts/artifact';
export {
  CapabilityManifestV1Schema,
  ContractPortV1Schema,
} from '../contracts/capability';
export {
  ContractMetadataSchema,
  EntityRefV1Schema,
  JsonObjectSchema,
  JsonValueSchema,
} from '../contracts/common';
export {
  CompletionEventV1Schema,
  CompletionHeaderV1Schema,
  ExecutionLinkV1Schema,
  RequestScopeV1Schema,
} from '../contracts/context';
export {
  DomainEventV1Schema,
  LineageRecordV1Schema,
  OntologyDefinitionV1Schema,
  ProjectionSpecV1Schema,
  SourceRecordRefV1Schema,
} from '../contracts/data';
export {
  PageDefinitionV1Schema,
  PageRuntimeDescriptorV1Schema,
} from '../contracts/page';
export { TenantProductConfigV1Schema } from '../contracts/tenant';
export {
  ThemeTokenV1Schema,
  ThemeTokensV1Schema,
} from '../contracts/theme';
export {
  HotwordBodyV1Schema,
  RadarScoreProjectionV1Schema,
  RadarSelectionV1Schema,
  TrendMetricSnapshotV1Schema,
  TrendSourceV1Schema,
} from '../contracts/trend';
export {
  WorkflowDefinitionV2Schema,
  WorkflowEdgeV2Schema,
  WorkflowNodeV2Schema,
} from '../contracts/workflow-definition';

import { ArtifactManifestV1Schema, OutputRecordV1Schema } from '../contracts/artifact';
import { CapabilityManifestV1Schema } from '../contracts/capability';
import {
  CompletionEventV1Schema,
  CompletionHeaderV1Schema,
  ExecutionLinkV1Schema,
  RequestScopeV1Schema,
} from '../contracts/context';
import {
  DomainEventV1Schema,
  LineageRecordV1Schema,
  OntologyDefinitionV1Schema,
  ProjectionSpecV1Schema,
} from '../contracts/data';
import { PageDefinitionV1Schema, PageRuntimeDescriptorV1Schema } from '../contracts/page';
import { TenantProductConfigV1Schema } from '../contracts/tenant';
import { ThemeTokensV1Schema } from '../contracts/theme';
import {
  HotwordBodyV1Schema,
  RadarScoreProjectionV1Schema,
  RadarSelectionV1Schema,
  TrendMetricSnapshotV1Schema,
} from '../contracts/trend';
import { WorkflowDefinitionV2Schema } from '../contracts/workflow-definition';

export const canonicalContractSchemas = {
  'artifact-manifest-v1': ArtifactManifestV1Schema,
  'capability-manifest-v1': CapabilityManifestV1Schema,
  'completion-event-v1': CompletionEventV1Schema,
  'completion-header-v1': CompletionHeaderV1Schema,
  'domain-event-v1': DomainEventV1Schema,
  'execution-link-v1': ExecutionLinkV1Schema,
  'hotword-body-v1': HotwordBodyV1Schema,
  'lineage-record-v1': LineageRecordV1Schema,
  'ontology-definition-v1': OntologyDefinitionV1Schema,
  'output-record-v1': OutputRecordV1Schema,
  'page-definition-v1': PageDefinitionV1Schema,
  'page-runtime-descriptor-v1': PageRuntimeDescriptorV1Schema,
  'projection-spec-v1': ProjectionSpecV1Schema,
  'radar-score-projection-v1': RadarScoreProjectionV1Schema,
  'radar-selection-v1': RadarSelectionV1Schema,
  'request-scope-v1': RequestScopeV1Schema,
  'tenant-product-config-v1': TenantProductConfigV1Schema,
  'theme-tokens-v1': ThemeTokensV1Schema,
  'trend-metric-snapshot-v1': TrendMetricSnapshotV1Schema,
  'workflow-definition-v2': WorkflowDefinitionV2Schema,
} as const;

export type CanonicalContractSchemaName = keyof typeof canonicalContractSchemas;

