import { z } from 'zod';
import {
  AccessPolicySchema,
  CompiledRouteClaimSchema,
  I18nTextSchema,
  PageRuntimeBundleSchema,
  ProductSurfaceSchema,
  RevisionRefSchema,
  RouteClaimSchema,
  RouteSpaceSchema,
  StableRefSchema,
  TenantScopeSchema,
  WorkbenchRuntimeBundleSchema,
  WorkbenchIdentitySchema,
  NavigationRuntimeBundleSchema,
  NavigationSchema,
  NavigationReleaseSchema,
  ManagementAccessSchema,
  PageSchema,
  PageReleaseSchema,
  WorkbenchSchema,
  WorkbenchReleaseSchema,
} from './declarative-control';
import { ContractIdentifierSchema, JsonObjectSchema, Sha256Schema } from './common';

export const DECLARATIVE_CONTROL_API_PREFIX = '/api/declarative-control' as const;
export const DECLARATIVE_CONTROL_CONTROLLER_PATH = '/declarative-control' as const;

export const DeclarativeResourceKindSchema = z.enum(['page', 'navigation', 'workbench']);
export type DeclarativeResourceKind = z.infer<typeof DeclarativeResourceKindSchema>;

export const DeclarativeAuthoringActionSchema = z.enum(['validate', 'preview', 'publish', 'rollback']);
export type DeclarativeAuthoringAction = z.infer<typeof DeclarativeAuthoringActionSchema>;

const encodePath = (value: string): string => encodeURIComponent(value);

export const declarativeControlRoutes = {
  resources: (kind: DeclarativeResourceKind): string => `${DECLARATIVE_CONTROL_API_PREFIX}/resources/${kind}`,
  authoringCreate: (kind: DeclarativeResourceKind): string => `${DECLARATIVE_CONTROL_API_PREFIX}/authoring/resources/${kind}`,
  draft: (kind: DeclarativeResourceKind, resourceId: string): string => `${DECLARATIVE_CONTROL_API_PREFIX}/resources/${kind}/${encodePath(resourceId)}/draft`,
  revisions: (kind: DeclarativeResourceKind, resourceId: string): string => `${DECLARATIVE_CONTROL_API_PREFIX}/resources/${kind}/${encodePath(resourceId)}/revisions`,
  authoringHistory: (kind: DeclarativeResourceKind, resourceId: string): string => `${DECLARATIVE_CONTROL_API_PREFIX}/authoring/resources/${kind}/${encodePath(resourceId)}/history`,
  releaseRevisions: (kind: DeclarativeResourceKind, resourceId: string, releaseSlotId: string): string =>
    `${DECLARATIVE_CONTROL_API_PREFIX}/resources/${kind}/${encodePath(resourceId)}/releases/${encodePath(releaseSlotId)}/revisions`,
  validate: (kind: DeclarativeResourceKind, resourceId: string): string => `${DECLARATIVE_CONTROL_API_PREFIX}/resources/${kind}/${encodePath(resourceId)}/validate`,
  preview: (kind: DeclarativeResourceKind, resourceId: string): string => `${DECLARATIVE_CONTROL_API_PREFIX}/resources/${kind}/${encodePath(resourceId)}/preview`,
  publish: (kind: DeclarativeResourceKind, resourceId: string): string => `${DECLARATIVE_CONTROL_API_PREFIX}/resources/${kind}/${encodePath(resourceId)}/publish`,
  rollback: (kind: DeclarativeResourceKind, resourceId: string, releaseSlotId: string): string =>
    `${DECLARATIVE_CONTROL_API_PREFIX}/resources/${kind}/${encodePath(resourceId)}/releases/${encodePath(releaseSlotId)}/rollback`,
  references: (kind: DeclarativeResourceKind, resourceId: string): string => `${DECLARATIVE_CONTROL_API_PREFIX}/resources/${kind}/${encodePath(resourceId)}/references`,
  retire: (kind: DeclarativeResourceKind, resourceId: string): string => `${DECLARATIVE_CONTROL_API_PREFIX}/resources/${kind}/${encodePath(resourceId)}/retire`,
  slotAuthority: (kind: DeclarativeResourceKind, slotId: string): string => `${DECLARATIVE_CONTROL_API_PREFIX}/slot-authorities/${kind}/${encodePath(slotId)}`,
  authoringBootstrap: (): string => `${DECLARATIVE_CONTROL_API_PREFIX}/authoring/bootstrap`,
  authoringPrepare: (kind: DeclarativeResourceKind, resourceId: string, action: DeclarativeAuthoringAction): string =>
    `${DECLARATIVE_CONTROL_API_PREFIX}/authoring/resources/${kind}/${encodePath(resourceId)}/${action}`,
  navigationPlacements: (): string => `${DECLARATIVE_CONTROL_API_PREFIX}/authoring/navigation/placements`,
  navigationImport: (placement: string): string => `${DECLARATIVE_CONTROL_API_PREFIX}/authoring/navigation/placements/${encodePath(placement)}/import`,
  navigationSeedMigration: (placement: string): string => `${DECLARATIVE_CONTROL_API_PREFIX}/authoring/navigation/placements/${encodePath(placement)}/seed-migration`,
  publicationPlan: (): string => `${DECLARATIVE_CONTROL_API_PREFIX}/authoring/publication-plans`,
  runtimeResolve: (): string => `${DECLARATIVE_CONTROL_API_PREFIX}/runtime/resolve`,
  runtimeNavigationBootstrap: (): string => `${DECLARATIVE_CONTROL_API_PREFIX}/runtime/navigations/bootstrap`,
  runtimeWorkbenchBootstrap: (): string => `${DECLARATIVE_CONTROL_API_PREFIX}/runtime/workbenches/bootstrap`,
  runtimePage: (releaseSlotId: string): string => `${DECLARATIVE_CONTROL_API_PREFIX}/runtime/pages/${encodePath(releaseSlotId)}`,
  runtimeNavigation: (releaseSlotId: string): string => `${DECLARATIVE_CONTROL_API_PREFIX}/runtime/navigations/${encodePath(releaseSlotId)}`,
  runtimeWorkbench: (releaseSlotId: string): string => `${DECLARATIVE_CONTROL_API_PREFIX}/runtime/workbenches/${encodePath(releaseSlotId)}`,
  runtimePreview: (): string => `${DECLARATIVE_CONTROL_API_PREFIX}/runtime/previews`,
  runtimeBindingQuery: (releaseSlotId: string, bindingId: string): string =>
    `${DECLARATIVE_CONTROL_API_PREFIX}/runtime/pages/${encodePath(releaseSlotId)}/bindings/${encodePath(bindingId)}/query`,
  runtimeActionExecute: (releaseSlotId: string, actionBindingId: string): string =>
    `${DECLARATIVE_CONTROL_API_PREFIX}/runtime/pages/${encodePath(releaseSlotId)}/actions/${encodePath(actionBindingId)}/execute`,
  runtimeNavigationActionExecute: (releaseSlotId: string, nodeId: string): string =>
    `${DECLARATIVE_CONTROL_API_PREFIX}/runtime/navigations/${encodePath(releaseSlotId)}/actions/${encodePath(nodeId)}/execute`,
} as const;

export const DeclarativeSuccessEnvelopeSchema = <T extends z.ZodType>(data: T) =>
  z.object({ code: z.number().int(), message: z.string(), data }).passthrough();

export const DeclarativeErrorEnvelopeSchema = z
  .object({
    code: z.string().trim().min(1),
    message: z.string().trim().min(1),
    requestId: z.string().trim().min(1).optional(),
    details: z.unknown().optional(),
    diagnostics: z.array(z.unknown()).optional(),
  })
  .passthrough();

const DeclarativeRuntimePageTargetSchema = z
  .object({
    activeReleaseRevisionRef: RevisionRefSchema,
    pageRevisionRef: RevisionRefSchema,
  })
  .strict()
  .superRefine((value, context) => {
    if (value.activeReleaseRevisionRef.kind !== 'page-release') {
      context.addIssue({ code: 'custom', path: ['activeReleaseRevisionRef', 'kind'], message: 'Runtime requests require an exact page-release revision.' });
    }
    if (value.pageRevisionRef.kind !== 'page') {
      context.addIssue({ code: 'custom', path: ['pageRevisionRef', 'kind'], message: 'Runtime requests require an exact page revision.' });
    }
  });

export const DeclarativeRuntimeBindingQueryIntentSchema = DeclarativeRuntimePageTargetSchema.safeExtend({
  parameters: JsonObjectSchema.default({}),
  pageSize: z.number().int().min(1).max(200).default(60),
  cursor: z.string().trim().min(1).max(8192).optional(),
}).strict();
export type DeclarativeRuntimeBindingQueryIntent = z.infer<typeof DeclarativeRuntimeBindingQueryIntentSchema>;

export const DeclarativeRuntimeBindingQueryResultSchema = z
  .object({
    bindingId: ContractIdentifierSchema,
    activeReleaseRevisionRef: RevisionRefSchema,
    pageRevisionRef: RevisionRefSchema,
    renderModelSchemaRevisionRef: RevisionRefSchema,
    model: JsonObjectSchema,
    pageInfo: z
      .object({
        pageSize: z.number().int().positive(),
        returned: z.number().int().nonnegative(),
        hasMore: z.boolean(),
        nextCursor: z.string().trim().min(1).optional(),
        total: z.number().int().nonnegative().optional(),
      })
      .strict()
      .optional(),
    sourceRevisionRefs: z.array(RevisionRefSchema),
    contentHash: Sha256Schema,
  })
  .strict();
export type DeclarativeRuntimeBindingQueryResult = z.infer<typeof DeclarativeRuntimeBindingQueryResultSchema>;

export const DeclarativeRuntimeActionExecuteIntentSchema = DeclarativeRuntimePageTargetSchema.safeExtend({
  intent: JsonObjectSchema,
  idempotencyKey: z.string().trim().min(1).max(256),
}).strict();
export type DeclarativeRuntimeActionExecuteIntent = z.infer<typeof DeclarativeRuntimeActionExecuteIntentSchema>;

export const DeclarativeRuntimeActionExecuteResultSchema = z
  .object({
    actionBindingId: ContractIdentifierSchema,
    activeReleaseRevisionRef: RevisionRefSchema,
    pageRevisionRef: RevisionRefSchema,
    commandRevisionRef: RevisionRefSchema,
    resultSchemaRevisionRef: RevisionRefSchema,
    result: JsonObjectSchema,
    idempotentReplay: z.boolean(),
    lineageRef: StableRefSchema,
    refreshBindingIds: z.array(ContractIdentifierSchema),
    navigationTargetRef: StableRefSchema.optional(),
    contentHash: Sha256Schema,
  })
  .strict();
export type DeclarativeRuntimeActionExecuteResult = z.infer<typeof DeclarativeRuntimeActionExecuteResultSchema>;

const DeclarativeRuntimeNavigationTargetSchema = z
  .object({
    activeReleaseRevisionRef: RevisionRefSchema,
    navigationRevisionRef: RevisionRefSchema,
  })
  .strict()
  .superRefine((value, context) => {
    if (value.activeReleaseRevisionRef.kind !== 'navigation-release') {
      context.addIssue({ code: 'custom', path: ['activeReleaseRevisionRef', 'kind'], message: 'Navigation Action requests require an exact navigation-release revision.' });
    }
    if (value.navigationRevisionRef.kind !== 'navigation') {
      context.addIssue({ code: 'custom', path: ['navigationRevisionRef', 'kind'], message: 'Navigation Action requests require an exact navigation revision.' });
    }
  });

export const DeclarativeRuntimeNavigationActionExecuteIntentSchema = DeclarativeRuntimeNavigationTargetSchema.safeExtend({
  intent: JsonObjectSchema.default({}),
  idempotencyKey: z.string().trim().min(1).max(256),
}).strict();
export type DeclarativeRuntimeNavigationActionExecuteIntent = z.infer<typeof DeclarativeRuntimeNavigationActionExecuteIntentSchema>;

export const DeclarativeRuntimeNavigationActionExecuteResultSchema = z
  .object({
    nodeId: ContractIdentifierSchema,
    activeReleaseRevisionRef: RevisionRefSchema,
    navigationRevisionRef: RevisionRefSchema,
    commandRevisionRef: RevisionRefSchema,
    resultSchemaRevisionRef: RevisionRefSchema.optional(),
    result: JsonObjectSchema,
    idempotentReplay: z.boolean(),
    lineageRef: StableRefSchema,
    navigationTargetRef: StableRefSchema.optional(),
    contentHash: Sha256Schema,
  })
  .strict();
export type DeclarativeRuntimeNavigationActionExecuteResult = z.infer<typeof DeclarativeRuntimeNavigationActionExecuteResultSchema>;

export const DeclarativeAudienceSimulationSchema = z
  .object({
    groupRefs: z
      .array(StableRefSchema)
      .max(128)
      .default([])
      .superRefine((references, context) => {
        references.forEach((reference, index) => {
          if (reference.kind !== 'group') context.addIssue({ code: 'custom', path: [index, 'kind'], message: 'Audience simulation only accepts stable Group refs.' });
        });
      }),
    permissions: z.array(ContractIdentifierSchema).max(512).default([]),
  })
  .strict();
export type DeclarativeAudienceSimulation = z.infer<typeof DeclarativeAudienceSimulationSchema>;

export const DeclarativeReleaseTargetIntentSchema = z
  .object({
    environmentRef: StableRefSchema,
    environmentRevisionRef: RevisionRefSchema,
    surface: ProductSurfaceSchema,
    routeClaimIndex: z.number().int().nonnegative().optional(),
    placement: ContractIdentifierSchema.optional(),
    order: z.number().int().optional(),
    isDefaultCandidate: z.boolean().optional(),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.environmentRef.kind !== 'environment' || value.environmentRevisionRef.kind !== 'environment') {
      context.addIssue({ code: 'custom', path: ['environmentRevisionRef', 'kind'], message: 'Release targets require an exact environment registration.' });
    }
    if (value.environmentRef.id !== value.environmentRevisionRef.id || value.environmentRef.ownerRepo !== value.environmentRevisionRef.ownerRepo) {
      context.addIssue({ code: 'custom', path: ['environmentRevisionRef'], message: 'The exact environment revision must identify the selected environment.' });
    }
  });

export const DeclarativeCommandIntentSchema = z
  .object({
    idempotencyKey: z.string().trim().min(1).max(256),
    definitionVersion: z.number().int().positive(),
    releaseSlotId: ContractIdentifierSchema.optional(),
    releaseExpectedVersion: z.number().int().nonnegative(),
    publicationExpectedGeneration: z.number().int().nonnegative().default(0),
    target: DeclarativeReleaseTargetIntentSchema,
    targetReleaseVersion: z.number().int().positive().optional(),
    ttlSeconds: z.number().int().min(30).max(600).optional(),
    audienceSimulation: DeclarativeAudienceSimulationSchema.optional(),
    reason: z.string().trim().min(1).max(4096).optional(),
  })
  .strict();
export type DeclarativeCommandIntent = z.infer<typeof DeclarativeCommandIntentSchema>;

export const DeclarativeBatchOperationIntentSchema = z
  .object({
    resourceKind: DeclarativeResourceKindSchema,
    resourceId: ContractIdentifierSchema,
    intent: DeclarativeCommandIntentSchema,
  })
  .strict();

export const DeclarativePublicationPlanIntentSchema = z
  .object({
    idempotencyKey: z.string().trim().min(1).max(256),
    expectedGeneration: z.number().int().nonnegative(),
    operations: z.array(DeclarativeBatchOperationIntentSchema).min(1).max(128),
  })
  .strict();
export type DeclarativePublicationPlanIntent = z.infer<typeof DeclarativePublicationPlanIntentSchema>;

export const DeclarativeAuthoringChoiceSchema = z
  .object({
    stableRef: StableRefSchema,
    revisionRef: RevisionRefSchema.optional(),
    label: I18nTextSchema,
    accessPolicy: AccessPolicySchema.optional(),
    surface: ProductSurfaceSchema.optional(),
    status: z.enum(['active', 'deprecated', 'retired', 'unavailable']),
    metadata: z.record(z.string(), z.unknown()).default({}),
  })
  .strict();

const DeclarativeCapabilityPortSchema = z
  .object({
    name: ContractIdentifierSchema,
    schemaRevisionRef: RevisionRefSchema,
    required: z.boolean(),
    multiple: z.boolean(),
  })
  .strict();

export const DeclarativeCapabilitySchemaDocumentSchema = z
  .object({
    schemaRevisionRef: RevisionRefSchema,
    document: JsonObjectSchema,
  })
  .strict()
  .superRefine((value, context) => {
    if (value.schemaRevisionRef.kind !== 'schema') {
      context.addIssue({ code: 'custom', path: ['schemaRevisionRef', 'kind'], message: 'Capability schema documents must use schema RevisionRefs.' });
    }
  });
export type DeclarativeCapabilitySchemaDocument = z.infer<typeof DeclarativeCapabilitySchemaDocumentSchema>;

export const DeclarativeCapabilityAuthoringRegistrationSchema = z
  .object({
    registrationRevisionRef: RevisionRefSchema,
    capabilityRevisionRef: RevisionRefSchema,
    providerRevisionRef: RevisionRefSchema,
    propertySchemaRevisionRef: RevisionRefSchema,
    uiSchemaRevisionRef: RevisionRefSchema.optional(),
    editorEligible: z.boolean(),
    category: ContractIdentifierSchema,
    label: I18nTextSchema,
    description: I18nTextSchema,
    supportedSurfaces: z.array(ProductSurfaceSchema).min(1),
    allowedSlots: z.array(ContractIdentifierSchema),
    allowedParentCapabilityRefs: z.array(StableRefSchema),
    allowedChildCapabilityRefs: z.array(StableRefSchema),
    inputPorts: z.array(DeclarativeCapabilityPortSchema),
    outputPorts: z.array(DeclarativeCapabilityPortSchema),
    allowedSideEffects: z.array(z.enum(['network', 'storage', 'navigation', 'worker', 'websocket'])),
    ontologyRequirements: z.array(z.object({ inputPort: ContractIdentifierSchema, renderModelSchemaRevisionRef: RevisionRefSchema, modes: z.array(z.enum(['view', 'filter'])).min(1), requiredPermissionCodes: z.array(ContractIdentifierSchema) }).strict()),
    actionRequirements: z.array(z.object({ outputPort: ContractIdentifierSchema, allowedCommandKinds: z.array(ContractIdentifierSchema), requiredPermissionCodes: z.array(ContractIdentifierSchema) }).strict()),
    propertyFields: z.array(z.object({ path: z.string().trim().min(1), label: I18nTextSchema, control: ContractIdentifierSchema, required: z.boolean(), advanced: z.boolean() }).strict()),
    schemaDocuments: z.array(DeclarativeCapabilitySchemaDocumentSchema).min(1),
    sourceContentHash: Sha256Schema,
  })
  .strict()
  .superRefine((value, context) => {
    const documents = new Map<string, number>();
    value.schemaDocuments.forEach((entry, index) => {
      const key = `${entry.schemaRevisionRef.ownerRepo}:${entry.schemaRevisionRef.id}@${entry.schemaRevisionRef.revision}:${entry.schemaRevisionRef.contentHash}`;
      if (documents.has(key)) {
        context.addIssue({ code: 'custom', path: ['schemaDocuments', index], message: 'Capability schema documents must be unique by exact RevisionRef.' });
      }
      documents.set(key, index);
    });
    const required = [
      value.propertySchemaRevisionRef,
      ...(value.uiSchemaRevisionRef ? [value.uiSchemaRevisionRef] : []),
      ...value.inputPorts.map((port) => port.schemaRevisionRef),
      ...value.outputPorts.map((port) => port.schemaRevisionRef),
      ...value.ontologyRequirements.map((requirement) => requirement.renderModelSchemaRevisionRef),
    ];
    required.forEach((reference) => {
      const key = `${reference.ownerRepo}:${reference.id}@${reference.revision}:${reference.contentHash}`;
      if (!documents.has(key)) {
        context.addIssue({ code: 'custom', path: ['schemaDocuments'], message: `Missing exact schema document for ${reference.id}.` });
      }
    });
  });
export type DeclarativeCapabilityAuthoringRegistration = z.infer<typeof DeclarativeCapabilityAuthoringRegistrationSchema>;

export const DeclarativeCapabilityAuthoringChoiceSchema = DeclarativeAuthoringChoiceSchema.extend({
  registration: DeclarativeCapabilityAuthoringRegistrationSchema,
}).strict();

export const DeclarativeCreateTemplateRegistrationSchema = z
  .object({
    templateRevisionRef: RevisionRefSchema,
    resourceKind: DeclarativeResourceKindSchema,
    label: I18nTextSchema,
    description: I18nTextSchema,
    supportedSurfaces: z.array(ProductSurfaceSchema).min(1),
    document: z.union([PageSchema, NavigationSchema, WorkbenchSchema]),
    sourceContentHash: Sha256Schema,
  })
  .strict()
  .superRefine((value, context) => {
    const expected = value.document.contract === 'Page' ? 'page' : value.document.contract === 'Navigation' ? 'navigation' : 'workbench';
    if (value.resourceKind !== expected) context.addIssue({ code: 'custom', path: ['resourceKind'], message: 'Create template kind must match its document contract.' });
    if (value.templateRevisionRef.kind !== 'declarative-create-template') context.addIssue({ code: 'custom', path: ['templateRevisionRef', 'kind'], message: 'Create templates require declarative-create-template RevisionRefs.' });
  });
export type DeclarativeCreateTemplateRegistration = z.infer<typeof DeclarativeCreateTemplateRegistrationSchema>;

export const DeclarativeRouteSpaceRegistrationSchema = z
  .object({
    routeSpaceRevisionRef: RevisionRefSchema,
    routeSpace: RouteSpaceSchema,
    sourceContentHash: Sha256Schema,
  })
  .strict()
  .superRefine((value, context) => {
    if (value.routeSpaceRevisionRef.kind !== 'route-space') {
      context.addIssue({ code: 'custom', path: ['routeSpaceRevisionRef', 'kind'], message: 'Route-space registrations require route-space RevisionRefs.' });
    }
    if (value.routeSpaceRevisionRef.id !== value.routeSpace.routeSpaceId) {
      context.addIssue({ code: 'custom', path: ['routeSpaceRevisionRef', 'id'], message: 'Route-space registration identity must match its document.' });
    }
  });
export type DeclarativeRouteSpaceRegistration = z.infer<typeof DeclarativeRouteSpaceRegistrationSchema>;

export const DeclarativeShellResourceDocumentSchema = z
  .object({
    contract: z.literal('DeclarativeShell'),
    schemaVersion: z.literal(1),
    hostCapabilityRevisionRef: RevisionRefSchema,
    hostProviderRevisionRef: RevisionRefSchema,
    allowedSlots: z.array(ContractIdentifierSchema).min(1),
    tokenRevisionRefs: z.array(RevisionRefSchema).min(1),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.hostCapabilityRevisionRef.kind !== 'capability') context.addIssue({ code: 'custom', path: ['hostCapabilityRevisionRef', 'kind'], message: 'Shell host capability must reference a capability.' });
    if (value.hostProviderRevisionRef.kind !== 'view-provider') context.addIssue({ code: 'custom', path: ['hostProviderRevisionRef', 'kind'], message: 'Shell host provider must reference a view-provider.' });
    value.tokenRevisionRefs.forEach((reference, index) => {
      if (reference.kind !== 'design-token') context.addIssue({ code: 'custom', path: ['tokenRevisionRefs', index, 'kind'], message: 'Shell tokens must use design-token RevisionRefs.' });
    });
  });

export const DeclarativeLayoutPolicyResourceDocumentSchema = z
  .object({
    contract: z.literal('DeclarativeLayoutPolicy'),
    schemaVersion: z.literal(1),
    allowedModes: z.array(z.enum(['single', 'tabs', 'columns', 'grid', 'sidebar'])).min(1),
    propertySchemaRevisionRef: RevisionRefSchema,
  })
  .strict()
  .superRefine((value, context) => {
    if (value.propertySchemaRevisionRef.kind !== 'schema') context.addIssue({ code: 'custom', path: ['propertySchemaRevisionRef', 'kind'], message: 'Layout policy properties must reference a schema.' });
  });

export const DeclarativeEnvironmentResourceDocumentSchema = z
  .object({
    contract: z.literal('DeclarativeEnvironment'),
    schemaVersion: z.literal(1),
    environmentId: ContractIdentifierSchema,
    label: I18nTextSchema,
    active: z.boolean(),
  })
  .strict();

export const DeclarativeProductResourceRegistrationSchema = z
  .object({
    resourceRevisionRef: RevisionRefSchema,
    resourceKind: z.enum(['shell', 'layout-policy', 'performance-budget', 'observation-policy', 'design-token', 'access-policy', 'environment']),
    supportedSurfaces: z.array(ProductSurfaceSchema).min(1),
    accessPolicy: AccessPolicySchema.optional(),
    schemaRevisionRef: RevisionRefSchema.optional(),
    document: JsonObjectSchema,
    sourceContentHash: Sha256Schema,
  })
  .strict()
  .superRefine((value, context) => {
    if (value.resourceRevisionRef.kind !== value.resourceKind) {
      context.addIssue({ code: 'custom', path: ['resourceRevisionRef', 'kind'], message: 'Product resource kind must match its RevisionRef.' });
    }
    if (value.resourceKind === 'shell') {
      const parsed = DeclarativeShellResourceDocumentSchema.safeParse(value.document);
      if (!parsed.success) context.addIssue({ code: 'custom', path: ['document'], message: `Invalid shell declaration: ${parsed.error.message}` });
    }
    if (value.resourceKind === 'layout-policy') {
      const parsed = DeclarativeLayoutPolicyResourceDocumentSchema.safeParse(value.document);
      if (!parsed.success) context.addIssue({ code: 'custom', path: ['document'], message: `Invalid layout-policy declaration: ${parsed.error.message}` });
    }
    if (value.resourceKind === 'environment') {
      const parsed = DeclarativeEnvironmentResourceDocumentSchema.safeParse(value.document);
      if (!parsed.success) context.addIssue({ code: 'custom', path: ['document'], message: `Invalid environment declaration: ${parsed.error.message}` });
      if (parsed.success && parsed.data.environmentId !== value.resourceRevisionRef.id) {
        context.addIssue({ code: 'custom', path: ['document', 'environmentId'], message: 'Environment registration identity must match its document.' });
      }
    }
  });
export type DeclarativeProductResourceRegistration = z.infer<typeof DeclarativeProductResourceRegistrationSchema>;

export const DeclarativeDefaultPolicyRegistrationSchema = z
  .object({
    role: z.enum(['management', 'access', 'layout', 'performance', 'observability', 'tokens', 'environment']),
    resourceRevisionRef: RevisionRefSchema,
    supportedSurfaces: z.array(ProductSurfaceSchema).min(1),
  })
  .strict();

/** Release-owned product authoring inputs. Instances and releases remain Ontology records. */
export const ProductDeclarativeAuthoringCatalogSchema = z
  .object({
    contract: z.literal('ProductDeclarativeAuthoringCatalog'),
    schemaVersion: z.literal(1),
    applicationId: ContractIdentifierSchema,
    createTemplates: z.array(DeclarativeCreateTemplateRegistrationSchema),
    routeSpaces: z.array(DeclarativeRouteSpaceRegistrationSchema),
    resourceRegistrations: z.array(DeclarativeProductResourceRegistrationSchema),
    defaultPolicies: z.array(DeclarativeDefaultPolicyRegistrationSchema),
  })
  .strict()
  .superRefine((value, context) => {
    const duplicates = (items: readonly string[]) => items.find((item, index) => items.indexOf(item) !== index);
    const duplicateTemplate = duplicates(value.createTemplates.map((item) => `${item.templateRevisionRef.id}@${item.templateRevisionRef.revision}`));
    if (duplicateTemplate) context.addIssue({ code: 'custom', path: ['createTemplates'], message: `Duplicate create template ${duplicateTemplate}.` });
    const duplicateRouteSpace = duplicates(value.routeSpaces.map((item) => `${item.routeSpaceRevisionRef.id}@${item.routeSpaceRevisionRef.revision}`));
    if (duplicateRouteSpace) context.addIssue({ code: 'custom', path: ['routeSpaces'], message: `Duplicate route space ${duplicateRouteSpace}.` });
    const duplicateResource = duplicates(value.resourceRegistrations.map((item) => `${item.resourceRevisionRef.kind}:${item.resourceRevisionRef.id}@${item.resourceRevisionRef.revision}`));
    if (duplicateResource) context.addIssue({ code: 'custom', path: ['resourceRegistrations'], message: `Duplicate product resource ${duplicateResource}.` });
    value.defaultPolicies.forEach((selection, index) => {
      const expectedKind = { management: 'access-policy', access: 'access-policy', layout: 'layout-policy', performance: 'performance-budget', observability: 'observation-policy', tokens: 'design-token', environment: 'environment' }[selection.role];
      if (selection.resourceRevisionRef.kind !== expectedKind) {
        context.addIssue({ code: 'custom', path: ['defaultPolicies', index, 'resourceRevisionRef', 'kind'], message: `Default ${selection.role} selection must reference ${expectedKind}.` });
      }
      if (!value.resourceRegistrations.some((registration) => registration.resourceRevisionRef.kind === selection.resourceRevisionRef.kind && registration.resourceRevisionRef.id === selection.resourceRevisionRef.id && registration.resourceRevisionRef.revision === selection.resourceRevisionRef.revision && registration.resourceRevisionRef.contentHash === selection.resourceRevisionRef.contentHash)) {
        context.addIssue({ code: 'custom', path: ['defaultPolicies', index, 'resourceRevisionRef'], message: 'Default policy must select an exact registered product resource.' });
      }
    });
  });
export type ProductDeclarativeAuthoringCatalog = z.infer<typeof ProductDeclarativeAuthoringCatalogSchema>;

export const DeclarativeCreateTemplateChoiceSchema = DeclarativeAuthoringChoiceSchema.extend({
  template: DeclarativeCreateTemplateRegistrationSchema,
}).strict();

export const DeclarativeRouteSpaceChoiceSchema = DeclarativeAuthoringChoiceSchema.extend({
  registration: DeclarativeRouteSpaceRegistrationSchema,
}).strict();

export const DeclarativeProductResourceChoiceSchema = DeclarativeAuthoringChoiceSchema.extend({
  registration: DeclarativeProductResourceRegistrationSchema,
}).strict();

export const DeclarativeBindingAuthoringChoiceSchema = DeclarativeAuthoringChoiceSchema.extend({
  bindingTemplate: z
    .object({
      kind: z.enum(['ontology', 'view', 'action']),
      requiredRevisionRefs: z.array(RevisionRefSchema),
      requiredPermissionCodes: z.array(ContractIdentifierSchema),
      inputTemplate: z.record(z.string(), z.unknown()),
    })
    .strict(),
  accessDiagnostics: z
    .object({ allowed: z.boolean(), missingPermissionCodes: z.array(ContractIdentifierSchema), issueCodes: z.array(ContractIdentifierSchema) })
    .strict(),
}).strict();

export const DeclarativeWorkbenchTargetChoiceSchema = z
  .object({
    stableTargetRef: StableRefSchema,
    targetRevisionRef: RevisionRefSchema,
    providerRevisionRef: RevisionRefSchema,
    inputSchemaRevisionRef: RevisionRefSchema,
    kind: z.enum(['built-in-application', 'workflow-form', 'workflow', 'agent', 'design', 'capability']),
    name: I18nTextSchema,
    targetAccessPolicy: AccessPolicySchema,
    supportedSurfaces: z.array(ProductSurfaceSchema).min(1),
    status: z.enum(['active', 'deprecated', 'retired', 'unavailable']),
    provenanceContentHash: Sha256Schema,
  })
  .strict()
  .superRefine((value, context) => {
    if (value.targetRevisionRef.id !== value.stableTargetRef.id || value.targetRevisionRef.kind !== value.stableTargetRef.kind) {
      context.addIssue({ code: 'custom', path: ['targetRevisionRef'], message: 'Workbench target identity and exact revision must match.' });
    }
    if (value.providerRevisionRef.kind !== 'view-provider') {
      context.addIssue({ code: 'custom', path: ['providerRevisionRef', 'kind'], message: 'Workbench targets require an exact view-provider revision.' });
    }
    if (value.inputSchemaRevisionRef.kind !== 'schema') {
      context.addIssue({ code: 'custom', path: ['inputSchemaRevisionRef', 'kind'], message: 'Workbench targets require an exact input schema revision.' });
    }
  });
export type DeclarativeWorkbenchTargetChoice = z.infer<typeof DeclarativeWorkbenchTargetChoiceSchema>;

export const DeclarativeCreateIntentSchema = z
  .object({
    resourceId: ContractIdentifierSchema,
    templateRevisionRef: RevisionRefSchema.optional(),
    sourceRevisionRef: RevisionRefSchema.optional(),
    identity: z.object({ name: I18nTextSchema, description: I18nTextSchema.optional(), tags: z.array(ContractIdentifierSchema).default([]) }).strict(),
    surface: ProductSurfaceSchema,
    pathTemplate: z.string().trim().min(1).optional(),
    placement: ContractIdentifierSchema.optional(),
    idempotencyKey: z.string().trim().min(1).max(256),
  })
  .strict()
  .superRefine((value, context) => {
    if (Number(Boolean(value.templateRevisionRef)) + Number(Boolean(value.sourceRevisionRef)) !== 1) {
      context.addIssue({ code: 'custom', path: ['templateRevisionRef'], message: 'Create intent requires exactly one governed template or source revision.' });
    }
  });
export type DeclarativeCreateIntent = z.infer<typeof DeclarativeCreateIntentSchema>;

export const DeclarativeDocumentSchema = z.union([PageSchema, NavigationSchema, WorkbenchSchema]);

export const DeclarativeSaveDraftIntentSchema = z
  .object({
    document: DeclarativeDocumentSchema,
    expectedVersion: z.number().int().nonnegative(),
    idempotencyKey: z.string().trim().min(1).max(256),
  })
  .strict();
export type DeclarativeSaveDraftIntent = z.infer<typeof DeclarativeSaveDraftIntentSchema>;

export const DeclarativeRetireIntentSchema = z
  .object({
    expectedVersion: z.number().int().positive(),
    idempotencyKey: z.string().trim().min(1).max(256),
    reason: z.string().trim().min(1).max(4096),
  })
  .strict();
export type DeclarativeRetireIntent = z.infer<typeof DeclarativeRetireIntentSchema>;

export const DeclarativePreparedReleaseTargetSchema = z
  .object({
    environmentRef: StableRefSchema,
    environmentRevisionRef: RevisionRefSchema,
    surface: ProductSurfaceSchema,
    routeClaimIndex: z.number().int().nonnegative().optional(),
    placement: ContractIdentifierSchema.optional(),
    order: z.number().int().optional(),
    isDefaultCandidate: z.boolean().optional(),
    releaseSlotId: ContractIdentifierSchema.optional(),
    releaseExpectedVersion: z.number().int().nonnegative(),
  })
  .strict();

export const DeclarativeEnvironmentChoiceSchema = DeclarativeAuthoringChoiceSchema.extend({
  revisionRef: RevisionRefSchema,
  registration: DeclarativeProductResourceRegistrationSchema,
}).strict();

const DeclarativePageDocumentSummarySchema = z
  .object({
    resourceKind: z.literal('page'),
    title: I18nTextSchema,
    supportedSurfaces: z.array(ProductSurfaceSchema).min(1),
    routeClaims: z.array(RouteClaimSchema).min(1),
    lifecycle: z.enum(['active', 'deprecated', 'retired']),
    accessPolicy: AccessPolicySchema,
    managementAccess: ManagementAccessSchema,
  })
  .strict();

const DeclarativeNavigationDocumentSummarySchema = z
  .object({
    resourceKind: z.literal('navigation'),
    title: I18nTextSchema,
    supportedSurfaces: z.array(ProductSurfaceSchema).min(1),
    placements: z.array(ContractIdentifierSchema).min(1),
    nodeCount: z.number().int().nonnegative(),
    lifecycle: z.enum(['active', 'deprecated', 'retired']),
    managementAccess: ManagementAccessSchema,
  })
  .strict();

const DeclarativeWorkbenchDocumentSummarySchema = z
  .object({
    resourceKind: z.literal('workbench'),
    title: I18nTextSchema,
    purpose: z.enum(['instance', 'template']),
    supportedSurfaces: z.array(ProductSurfaceSchema).min(1),
    routeClaims: z.array(RouteClaimSchema).min(1),
    layout: z.object({ hostCapabilityRevisionRef: RevisionRefSchema, hostProviderRevisionRef: RevisionRefSchema, layoutPolicyRevisionRef: RevisionRefSchema }).strict(),
    instanceCount: z.number().int().nonnegative(),
    lifecycle: z.enum(['active', 'deprecated', 'retired']),
    accessPolicy: AccessPolicySchema,
    managementAccess: ManagementAccessSchema,
  })
  .strict();

export const DeclarativeDocumentSummarySchema = z.discriminatedUnion('resourceKind', [
  DeclarativePageDocumentSummarySchema,
  DeclarativeNavigationDocumentSummarySchema,
  DeclarativeWorkbenchDocumentSummarySchema,
]);

export const DeclarativeAuthoringResourceSummarySchema = z
  .object({
    resourceKind: DeclarativeResourceKindSchema,
    resourceId: ContractIdentifierSchema,
    tenantScope: TenantScopeSchema,
    documentSummary: DeclarativeDocumentSummarySchema,
    lifecycle: z.enum(['active', 'deprecated', 'retired']),
    draftRevisionRef: RevisionRefSchema,
    activeReleaseRevisionRefs: z.array(RevisionRefSchema),
    placements: z.array(ContractIdentifierSchema),
    updatedAt: z.string().datetime(),
    actorRef: StableRefSchema,
    preparedTargets: z.array(DeclarativePreparedReleaseTargetSchema),
    releasePlacements: z.array(z.object({
      releaseRevisionRef: RevisionRefSchema,
      environmentRef: StableRefSchema,
      surface: ProductSurfaceSchema,
      routePath: z.string().optional(),
      placement: ContractIdentifierSchema.optional(),
      order: z.number().int().optional(),
      isDefaultCandidate: z.boolean().optional(),
    }).strict()),
  })
  .strict();

export const DeclarativeAuthoringHistoryEntrySchema = z
  .object({
    revisionRef: RevisionRefSchema,
    version: z.number().int().positive(),
    lifecycle: z.enum(['active', 'deprecated', 'retired']),
    name: I18nTextSchema,
    actorRef: StableRefSchema,
    source: z.enum(['user', 'migration', 'rollback']),
    reason: z.string().trim().min(1).optional(),
    occurredAt: z.string().datetime(),
    activeRelease: z.boolean(),
  })
  .strict();
export const DeclarativeAuthoringHistorySchema = z
  .object({ items: z.array(DeclarativeAuthoringHistoryEntrySchema), nextBeforeVersion: z.number().int().positive().optional() })
  .strict();
export type DeclarativeAuthoringHistory = z.infer<typeof DeclarativeAuthoringHistorySchema>;

const DeclarativeRuntimeDiagnosticSchema = z
  .object({
    code: ContractIdentifierSchema,
    severity: z.enum(['info', 'warning', 'error']),
    path: z.string().trim().min(1),
    message: z.string().trim().min(1),
  })
  .strict();

export const DeclarativeDraftResultSchema = z
  .object({
    action: z.enum(['create', 'save']),
    resourceKind: DeclarativeResourceKindSchema,
    resourceId: ContractIdentifierSchema,
    document: DeclarativeDocumentSchema,
    revisionRef: RevisionRefSchema,
    actorRef: StableRefSchema,
    occurredAt: z.string().datetime(),
    provenance: z.object({ sourceRevisionRef: RevisionRefSchema }).strict().optional(),
  })
  .strict();
export type DeclarativeDraftResult = z.infer<typeof DeclarativeDraftResultSchema>;

export const DeclarativeValidationResultSchema = z
  .object({
    action: z.literal('validate'),
    valid: z.literal(true),
    releaseRevisionRef: RevisionRefSchema,
    bundleContentHash: Sha256Schema,
    diagnostics: z.array(DeclarativeRuntimeDiagnosticSchema),
  })
  .strict();
export type DeclarativeValidationResult = z.infer<typeof DeclarativeValidationResultSchema>;

export const DeclarativePreviewResultSchema = z
  .object({
    action: z.literal('preview'),
    token: z.string().trim().min(1),
    expiresAt: z.string().datetime(),
    revision: z.number().int().positive(),
    contentHash: Sha256Schema,
    bundle: z.union([PageRuntimeBundleSchema, NavigationRuntimeBundleSchema, WorkbenchRuntimeBundleSchema]),
    etag: z.string().trim().min(1),
    sourceContentHash: Sha256Schema,
  })
  .strict();
export type DeclarativePreviewResult = z.infer<typeof DeclarativePreviewResultSchema>;

export const DeclarativePublicationItemResultSchema = z
  .object({
    resourceKind: DeclarativeResourceKindSchema,
    resourceId: ContractIdentifierSchema,
    releaseRevisionRef: RevisionRefSchema,
    release: z.union([PageReleaseSchema, NavigationReleaseSchema, WorkbenchReleaseSchema]),
    bundle: z.union([PageRuntimeBundleSchema, NavigationRuntimeBundleSchema, WorkbenchRuntimeBundleSchema]),
  })
  .strict();

export const DeclarativePublicationResultSchema = z
  .object({
    action: z.enum(['publish', 'rollback', 'publication-plan']),
    generation: z.number().int().nonnegative(),
    publicationPlanRevisionRef: RevisionRefSchema.optional(),
    items: z.array(DeclarativePublicationItemResultSchema).min(1),
    etag: z.string().trim().min(1),
  })
  .strict();
export type DeclarativePublicationResult = z.infer<typeof DeclarativePublicationResultSchema>;

export const DeclarativeRetireResultSchema = z
  .object({
    action: z.literal('retire'),
    resourceKind: DeclarativeResourceKindSchema,
    resourceId: ContractIdentifierSchema,
    revisionRef: RevisionRefSchema,
    lifecycle: z.literal('retired'),
    actorRef: StableRefSchema,
    occurredAt: z.string().datetime(),
    reason: z.string().trim().min(1).max(4096),
  })
  .strict();
export type DeclarativeRetireResult = z.infer<typeof DeclarativeRetireResultSchema>;

export const DeclarativeAuthoringCommandResultSchema = z.discriminatedUnion('action', [
  DeclarativeDraftResultSchema,
  DeclarativeValidationResultSchema,
  DeclarativePreviewResultSchema,
  DeclarativePublicationResultSchema,
  DeclarativeRetireResultSchema,
]);
export type DeclarativeAuthoringCommandResult = z.infer<typeof DeclarativeAuthoringCommandResultSchema>;

export const DeclarativeNavigationSeedMigrationIntentSchema = z
  .object({
    idempotencyKey: z.string().trim().min(1).max(256),
  })
  .strict();
export type DeclarativeNavigationSeedMigrationIntent = z.infer<typeof DeclarativeNavigationSeedMigrationIntentSchema>;

const DeclarativeNavigationSeedMigrationDiffSchema = z
  .object({
    path: z.string().trim().min(1),
    legacyContentHash: Sha256Schema,
    declarativeContentHash: Sha256Schema,
  })
  .strict();

export const DeclarativeNavigationSeedMigrationResultSchema = z
  .object({
    outcome: z.enum(['already-active', 'review-required', 'published']),
    placement: ContractIdentifierSchema,
    legacyContentHash: Sha256Schema,
    templateRevisionRef: RevisionRefSchema,
    draftRevisionRef: RevisionRefSchema.optional(),
    activeReleaseRevisionRef: RevisionRefSchema.optional(),
    requiresReview: z.boolean(),
    diff: z.array(DeclarativeNavigationSeedMigrationDiffSchema),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.outcome === 'review-required' && (!value.requiresReview || !value.draftRevisionRef)) {
      context.addIssue({ code: 'custom', path: ['outcome'], message: 'Review-required migrations must expose their draft.' });
    }
    if ((value.outcome === 'already-active' || value.outcome === 'published') && !value.activeReleaseRevisionRef) {
      context.addIssue({ code: 'custom', path: ['activeReleaseRevisionRef'], message: 'Active migrations require an exact release revision.' });
    }
  });
export type DeclarativeNavigationSeedMigrationResult = z.infer<typeof DeclarativeNavigationSeedMigrationResultSchema>;

export const DeclarativeNavigationPlacementSchema = z
  .object({
    placement: ContractIdentifierSchema,
    surface: ProductSurfaceSchema,
    authority: z.enum(['legacy', 'declarative']),
    authorityRevisionRef: RevisionRefSchema.optional(),
    navigationRef: StableRefSchema.optional(),
    draftRevisionRef: RevisionRefSchema.optional(),
    activeReleaseRevisionRef: RevisionRefSchema.optional(),
    legacySourceRevisionRef: RevisionRefSchema.optional(),
    legacyContentHash: Sha256Schema.optional(),
    legacyReadOnly: z.boolean(),
    declarativeEditorReadOnly: z.boolean(),
  })
  .strict();

export const DeclarativeAuthoringBootstrapSchema = z
  .object({
    resources: z.array(DeclarativeAuthoringResourceSummarySchema),
    createTemplates: z.array(DeclarativeCreateTemplateChoiceSchema),
    routeSpaces: z.array(DeclarativeRouteSpaceChoiceSchema),
    productResources: z.array(DeclarativeProductResourceChoiceSchema),
    environmentChoices: z.array(DeclarativeEnvironmentChoiceSchema),
    defaultEnvironmentRevisionRef: RevisionRefSchema.optional(),
    navigationPlacements: z.array(DeclarativeNavigationPlacementSchema),
    capabilityCatalog: z.array(DeclarativeCapabilityAuthoringChoiceSchema),
    ontologyChoices: z.array(DeclarativeBindingAuthoringChoiceSchema),
    viewChoices: z.array(DeclarativeBindingAuthoringChoiceSchema),
    actionChoices: z.array(DeclarativeBindingAuthoringChoiceSchema),
    accessChoices: z.array(DeclarativeAuthoringChoiceSchema),
    publishedTargets: z.array(DeclarativeAuthoringChoiceSchema),
    workbenchTargets: z.array(DeclarativeWorkbenchTargetChoiceSchema),
    compilerRevisionRef: RevisionRefSchema,
    generation: z.number().int().nonnegative(),
    contentHash: Sha256Schema,
  })
  .strict();
export type DeclarativeAuthoringBootstrap = z.infer<typeof DeclarativeAuthoringBootstrapSchema>;
export type DeclarativeAuthoringChoice = z.infer<typeof DeclarativeAuthoringChoiceSchema>;

export const DeclarativeRuntimeResolvedSchema = z
  .object({
    surface: ProductSurfaceSchema,
    normalizedPath: z.string().trim().min(1),
    page: PageRuntimeBundleSchema.optional(),
    workbench: WorkbenchRuntimeBundleSchema.optional(),
    navigation: NavigationRuntimeBundleSchema.optional(),
    releaseSlotRefs: z.array(z.object({ resourceKind: DeclarativeResourceKindSchema, releaseSlotId: ContractIdentifierSchema }).strict()),
    generation: z.number().int().nonnegative(),
    contentHash: Sha256Schema,
  })
  .strict()
  .superRefine((value, context) => {
    if (!value.page && !value.workbench) context.addIssue({ code: 'custom', path: ['page'], message: 'A resolved runtime must contain a Page or Workbench bundle.' });
  });

export const DeclarativeNavigationRuntimeBootstrapSchema = z
  .object({
    placements: z.array(
      z
        .object({
          placement: ContractIdentifierSchema,
          surface: ProductSurfaceSchema,
          authority: z.enum(['legacy', 'declarative']),
          state: z.enum(['active', 'deactivated']),
          releaseSlotId: ContractIdentifierSchema.optional(),
          activeReleaseRevisionRef: RevisionRefSchema.optional(),
          bundle: NavigationRuntimeBundleSchema.optional(),
        })
        .strict()
        .superRefine((value, context) => {
          if (value.authority === 'legacy') {
            if (value.releaseSlotId || value.activeReleaseRevisionRef || value.bundle) {
              context.addIssue({ code: 'custom', path: ['authority'], message: 'Legacy navigation placements cannot expose declarative Release or Bundle state.' });
            }
            if (value.state !== 'active') context.addIssue({ code: 'custom', path: ['state'], message: 'Legacy navigation placements are active until an explicit declarative cutover.' });
            return;
          }
          if (!value.releaseSlotId || !value.activeReleaseRevisionRef) {
            context.addIssue({ code: 'custom', path: ['releaseSlotId'], message: 'Declarative navigation placements require an exact active Release reference.' });
          }
          if (value.state === 'active' && !value.bundle) {
            context.addIssue({ code: 'custom', path: ['bundle'], message: 'An active declarative navigation placement requires its identity-filtered Runtime Bundle.' });
          }
          if (value.state === 'deactivated' && value.bundle) {
            context.addIssue({ code: 'custom', path: ['bundle'], message: 'A deactivated declarative navigation placement cannot expose a Runtime Bundle.' });
          }
          if (value.bundle && (value.bundle.placement !== value.placement || value.bundle.surface !== value.surface)) {
            context.addIssue({ code: 'custom', path: ['bundle'], message: 'The Navigation Runtime Bundle must match its placement and surface.' });
          }
        }),
    ),
    bundles: z.array(NavigationRuntimeBundleSchema),
    releaseSlotIds: z.array(ContractIdentifierSchema),
    generation: z.number().int().nonnegative(),
    contentHash: Sha256Schema,
    authDigest: Sha256Schema,
    etag: z.string().trim().min(1),
  })
  .strict()
  .superRefine((value, context) => {
    const active = value.placements.filter((entry) => entry.authority === 'declarative' && entry.state === 'active');
    if (active.length !== value.bundles.length || active.length !== value.releaseSlotIds.length) {
      context.addIssue({ code: 'custom', path: ['placements'], message: 'Compatibility bundle arrays must exactly project active declarative placements.' });
      return;
    }
    active.forEach((entry, index) => {
      if (entry.bundle?.contentHash !== value.bundles[index]?.contentHash || entry.releaseSlotId !== value.releaseSlotIds[index]) {
        context.addIssue({ code: 'custom', path: ['placements', index], message: 'Navigation placement and compatibility bundle order must match.' });
      }
    });
  });

export const DeclarativeWorkbenchSummarySchema = z
  .object({
    workbenchId: ContractIdentifierSchema,
    releaseSlotId: ContractIdentifierSchema,
    activeReleaseRevisionRef: RevisionRefSchema,
    identity: WorkbenchIdentitySchema,
    routeClaims: z.array(CompiledRouteClaimSchema),
    order: z.number().int(),
    isDefaultCandidate: z.boolean(),
    generation: z.number().int().nonnegative(),
    contentHash: Sha256Schema,
  })
  .strict();

export const DeclarativeLegacyWorkbenchSummarySchema = z
  .object({
    workbenchId: ContractIdentifierSchema,
    authority: z.literal('legacy'),
    identity: WorkbenchIdentitySchema,
    order: z.number().int(),
    isDefaultCandidate: z.boolean(),
  })
  .strict();

export const DeclarativeWorkbenchRuntimeBootstrapSchema = z
  .object({
    defaultAuthority: z.literal('legacy'),
    authorities: z.array(
      z
        .object({
          workbenchId: ContractIdentifierSchema,
          releaseSlotId: ContractIdentifierSchema,
          authority: z.enum(['legacy', 'declarative']),
          state: z.enum(['active', 'deactivated']),
          activeReleaseRevisionRef: RevisionRefSchema,
          visible: z.boolean(),
        })
        .strict()
        .superRefine((value, context) => {
          if (value.authority === 'legacy' && value.visible) context.addIssue({ code: 'custom', path: ['visible'], message: 'Legacy workbenches are delivered by the compatibility API, not by declarative summaries.' });
          if (value.state === 'deactivated' && value.visible) context.addIssue({ code: 'custom', path: ['visible'], message: 'Deactivated workbenches cannot be visible.' });
        }),
    ),
    legacySummaries: z.array(DeclarativeLegacyWorkbenchSummarySchema),
    summaries: z.array(DeclarativeWorkbenchSummarySchema),
    selected: z
      .object({
        workbenchId: ContractIdentifierSchema,
        authority: z.enum(['legacy', 'declarative']),
        releaseSlotId: ContractIdentifierSchema.optional(),
        activeReleaseRevisionRef: RevisionRefSchema.optional(),
        source: z.enum(['explicit', 'default', 'first-accessible']),
      })
      .strict()
      .superRefine((value, context) => {
        if (value.authority === 'declarative' && (!value.releaseSlotId || !value.activeReleaseRevisionRef)) {
          context.addIssue({ code: 'custom', path: ['releaseSlotId'], message: 'Declarative Workbench selection requires its exact Release slot and revision.' });
        }
        if (value.authority === 'legacy' && (value.releaseSlotId || value.activeReleaseRevisionRef)) {
          context.addIssue({ code: 'custom', path: ['releaseSlotId'], message: 'Legacy Workbench selection cannot expose declarative Release state.' });
        }
      })
      .nullable(),
    authDigest: Sha256Schema,
    etag: z.string().trim().min(1),
  })
  .strict();

export const DeclarativeNavigationImportIntentSchema = z
  .object({
    environmentRef: StableRefSchema,
    surface: ProductSurfaceSchema,
    expectedLegacyContentHash: Sha256Schema,
    expectedDraftVersion: z.number().int().nonnegative(),
    idempotencyKey: z.string().trim().min(1).max(256),
  })
  .strict();

export const DeclarativeNavigationImportResultSchema = z
  .object({
    document: z.unknown(),
    revisionRef: RevisionRefSchema,
    provenance: z.object({ sourceKey: z.literal('server.ui.menus'), sourceRevisionRef: RevisionRefSchema, sourceContentHash: Sha256Schema }).strict(),
    diff: z.object({ added: z.array(ContractIdentifierSchema), removed: z.array(ContractIdentifierSchema), changed: z.array(ContractIdentifierSchema) }).strict(),
  })
  .strict();

export const DeclarativeRuntimeResolveQuerySchema = z
  .object({
    // Runtime callers may select an exact active environment. When omitted,
    // Server resolves the single release-owned default for this surface.
    environmentId: ContractIdentifierSchema.optional(),
    surface: ProductSurfaceSchema,
    path: z.string().trim().min(1),
    navigationPlacement: ContractIdentifierSchema.optional(),
  })
  .strict();

export type DeclarativeRuntimeResolved = z.infer<typeof DeclarativeRuntimeResolvedSchema>;
export type DeclarativeNavigationRuntimeBootstrap = z.infer<typeof DeclarativeNavigationRuntimeBootstrapSchema>;
export type DeclarativeWorkbenchRuntimeBootstrap = z.infer<typeof DeclarativeWorkbenchRuntimeBootstrapSchema>;
export type DeclarativeNavigationPlacement = z.infer<typeof DeclarativeNavigationPlacementSchema>;
export type DeclarativeNavigationImportIntent = z.infer<typeof DeclarativeNavigationImportIntentSchema>;

// Route claims are re-exported here because authoring clients select an existing
// declaration claim; they never submit a URL or mutable endpoint as authority.
export const DeclarativeRouteClaimIntentSchema = RouteClaimSchema;
