import { z } from 'zod';
import {
  ContractIdentifierSchema,
  ContractVersionSchema,
  IsoDateTimeSchema,
  JsonObjectSchema,
  LocaleIdentifierSchema,
  Sha256Schema,
} from './common';
import { OntologyDefinitionSchema } from './data';
import { RenderTreeSchema } from './render';

export const DECLARATIVE_CONTROL_SCHEMA_VERSION = 1;

const uniqueArray = <T>(values: readonly T[], identity: (value: T) => string): string | undefined => {
  const seen = new Set<string>();
  for (const value of values) {
    const key = identity(value);
    if (seen.has(key)) return key;
    seen.add(key);
  }
  return undefined;
};

export const I18nTextSchema = z
  .object({
    defaultLocale: LocaleIdentifierSchema,
    values: z.record(LocaleIdentifierSchema, z.string().trim().min(1)),
  })
  .strict()
  .superRefine((value, context) => {
    if (!Object.prototype.hasOwnProperty.call(value.values, value.defaultLocale)) {
      context.addIssue({
        code: 'custom',
        path: ['values', value.defaultLocale],
        message: 'I18nText values must contain the default locale.',
      });
    }
  });

export const ScopedIdentityRefSchema = z
  .object({
    kind: ContractIdentifierSchema,
    id: ContractIdentifierSchema,
    ownerRepo: ContractIdentifierSchema,
  })
  .strict();

export const TenantScopeSchema = z
  .object({
    tenantRef: ScopedIdentityRefSchema,
    dataSpaceRef: ScopedIdentityRefSchema,
    teamRef: ScopedIdentityRefSchema.optional(),
  })
  .strict()
  .superRefine((value, context) => {
    const expectedKinds = [
      ['tenantRef', value.tenantRef, 'tenant'],
      ['dataSpaceRef', value.dataSpaceRef, 'data-space'],
      ['teamRef', value.teamRef, 'team'],
    ] as const;
    expectedKinds.forEach(([field, reference, expectedKind]) => {
      if (reference && reference.kind !== expectedKind) {
        context.addIssue({ code: 'custom', path: [field, 'kind'], message: `${field} must reference ${expectedKind}.` });
      }
    });
  });

export const ReferenceVisibilitySchema = z.enum(['tenant', 'global', 'public']);

const StableRefShape = {
  kind: ContractIdentifierSchema,
  id: ContractIdentifierSchema,
  ownerRepo: ContractIdentifierSchema,
  visibility: ReferenceVisibilitySchema,
  tenantScope: TenantScopeSchema.optional(),
};

const validateReferenceScope = (
  value: { visibility: z.infer<typeof ReferenceVisibilitySchema>; tenantScope?: z.infer<typeof TenantScopeSchema> },
  context: z.RefinementCtx,
) => {
  if (value.visibility === 'tenant' && !value.tenantScope) {
    context.addIssue({ code: 'custom', path: ['tenantScope'], message: 'Tenant references require an explicit tenant scope.' });
  }
  if (value.visibility !== 'tenant' && value.tenantScope) {
    context.addIssue({ code: 'custom', path: ['tenantScope'], message: 'Global and public references cannot carry a tenant scope.' });
  }
};

export const StableRefSchema = z
  .object(StableRefShape)
  .strict()
  .superRefine(validateReferenceScope);

export const RevisionRefSchema = z
  .object({
    ...StableRefShape,
    revision: z.number().int().positive(),
    schemaVersion: ContractVersionSchema,
    contentHash: Sha256Schema,
  })
  .strict()
  .superRefine(validateReferenceScope);

const scopedIdentityKey = (reference: z.infer<typeof ScopedIdentityRefSchema>): string =>
  `${reference.kind}:${reference.id}:${reference.ownerRepo}`;

const tenantScopeKey = (scope: z.infer<typeof TenantScopeSchema>): string =>
  `${scopedIdentityKey(scope.tenantRef)}:${scopedIdentityKey(scope.dataSpaceRef)}:${scope.teamRef ? scopedIdentityKey(scope.teamRef) : ''}`;

const stableRefIdentity = (reference: z.infer<typeof StableRefSchema>): string =>
  `${reference.visibility}:${reference.tenantScope ? tenantScopeKey(reference.tenantScope) : ''}:${reference.kind}:${reference.id}:${reference.ownerRepo}`;

const exactRevisionRef = (
  left: z.infer<typeof RevisionRefSchema>,
  right: z.infer<typeof RevisionRefSchema>,
): boolean => stableRefIdentity(left) === stableRefIdentity(right)
  && left.revision === right.revision
  && left.schemaVersion === right.schemaVersion
  && left.contentHash === right.contentHash;

export const StableRefAliasSchema = z
  .object({
    aliasRef: StableRefSchema,
    canonicalRef: StableRefSchema,
    validFrom: IsoDateTimeSchema,
    validUntil: IsoDateTimeSchema.nullable(),
    evidenceRef: RevisionRefSchema,
  })
  .strict()
  .superRefine((value, context) => {
    if (value.aliasRef.kind !== value.canonicalRef.kind) {
      context.addIssue({ code: 'custom', path: ['canonicalRef', 'kind'], message: 'Alias and canonical references must have the same kind.' });
    }
    if (value.validUntil && value.validUntil <= value.validFrom) {
      context.addIssue({ code: 'custom', path: ['validUntil'], message: 'Alias validUntil must be later than validFrom.' });
    }
  });

export const StableRefAliasMapSchema = z
  .object({
    contract: z.literal('StableRefAliasMap'),
    schemaVersion: z.literal(DECLARATIVE_CONTROL_SCHEMA_VERSION),
    tenantScope: TenantScopeSchema,
    aliases: z.array(StableRefAliasSchema),
    contentHash: Sha256Schema,
  })
  .strict()
  .superRefine((value, context) => {
    const duplicate = uniqueArray(value.aliases, (entry) => stableRefIdentity(entry.aliasRef));
    if (duplicate) context.addIssue({ code: 'custom', path: ['aliases'], message: `Duplicate alias reference: ${duplicate}` });
  });

export const DeclarativeLifecycleSchema = z.enum(['active', 'deprecated', 'retired']);
export const ProductSurfaceSchema = z.enum(['studio', 'kernel']);

const GroupRefSchema = StableRefSchema.superRefine((value, context) => {
  if (value.kind !== 'group') context.addIssue({ code: 'custom', path: ['kind'], message: 'Access group references must use kind group.' });
});

const AccessConditionRefSchema = RevisionRefSchema.superRefine((value, context) => {
  if (value.kind !== 'access-condition') {
    context.addIssue({ code: 'custom', path: ['kind'], message: 'Access condition references must use kind access-condition.' });
  }
});

export const AccessPolicySchema = z
  .object({
    authenticated: z.boolean(),
    groupAllOf: z.array(GroupRefSchema),
    groupAnyOf: z.array(GroupRefSchema),
    permissionAllOf: z.array(ContractIdentifierSchema),
    permissionAnyOf: z.array(ContractIdentifierSchema),
    conditionAllOf: z.array(AccessConditionRefSchema),
  })
  .strict()
  .superRefine((value, context) => {
    const checks: Array<[string, readonly unknown[], (candidate: unknown) => string]> = [
      ['groupAllOf', value.groupAllOf, (candidate) => stableRefIdentity(candidate as z.infer<typeof StableRefSchema>)],
      ['groupAnyOf', value.groupAnyOf, (candidate) => stableRefIdentity(candidate as z.infer<typeof StableRefSchema>)],
      ['permissionAllOf', value.permissionAllOf, String],
      ['permissionAnyOf', value.permissionAnyOf, String],
      ['conditionAllOf', value.conditionAllOf, (candidate) => `${stableRefIdentity(candidate as z.infer<typeof StableRefSchema>)}@${(candidate as z.infer<typeof RevisionRefSchema>).revision}`],
    ];
    checks.forEach(([field, values, identity]) => {
      if (uniqueArray(values, identity)) context.addIssue({ code: 'custom', path: [field], message: `${field} entries must be unique.` });
    });
  });

export const ManagementAccessSchema = z
  .object({
    edit: AccessPolicySchema,
    preview: AccessPolicySchema,
    publish: AccessPolicySchema,
    deactivate: AccessPolicySchema,
    rollback: AccessPolicySchema,
    retire: AccessPolicySchema,
  })
  .strict();

export const RoutePathTemplateSchema = z
  .string()
  .trim()
  .regex(/^\/(?!\/)/, 'Expected an application-relative path.')
  .superRefine((value, context) => {
    if (value.includes('?') || value.includes('#') || value.includes('\\')) {
      context.addIssue({ code: 'custom', message: 'Route paths cannot contain query strings, fragments, or backslashes.' });
    }
    if (value.split('/').some((segment) => segment === '.' || segment === '..')) {
      context.addIssue({ code: 'custom', message: 'Route paths cannot contain traversal segments.' });
    }
    if (/^[a-z][a-z0-9+.-]*:/i.test(value) || value.includes('://')) {
      context.addIssue({ code: 'custom', message: 'Route paths cannot contain a scheme or host.' });
    }
  });

export const RouteSpaceParameterSchema = z
  .object({
    name: ContractIdentifierSchema,
    type: z.enum(['identifier', 'integer', 'slug', 'uuid']),
    required: z.boolean(),
  })
  .strict();

export const RouteSpaceSchema = z
  .object({
    contract: z.literal('RouteSpace'),
    schemaVersion: z.literal(DECLARATIVE_CONTROL_SCHEMA_VERSION),
    routeSpaceId: ContractIdentifierSchema,
    supportedSurface: ProductSurfaceSchema,
    basePath: RoutePathTemplateSchema,
    caseSensitive: z.boolean(),
    trailingSlash: z.enum(['preserve', 'remove', 'require']),
    reservedPaths: z.array(RoutePathTemplateSchema),
    parameters: z.array(RouteSpaceParameterSchema),
  })
  .strict()
  .superRefine((value, context) => {
    if (uniqueArray(value.parameters, (parameter) => parameter.name)) {
      context.addIssue({ code: 'custom', path: ['parameters'], message: 'RouteSpace parameter names must be unique.' });
    }
    if (uniqueArray(value.reservedPaths, (path) => path)) {
      context.addIssue({ code: 'custom', path: ['reservedPaths'], message: 'RouteSpace reserved paths must be unique.' });
    }
  });

const RouteClaimBaseSchema = z
  .object({
    kind: z.enum(['canonical', 'alias', 'redirect']),
    routeSpaceRevisionRef: RevisionRefSchema,
    pathTemplate: RoutePathTemplateSchema,
    redirectTargetRef: StableRefSchema.optional(),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.routeSpaceRevisionRef.kind !== 'route-space') {
      context.addIssue({ code: 'custom', path: ['routeSpaceRevisionRef', 'kind'], message: 'Route claims must reference a route-space revision.' });
    }
    if (value.kind === 'redirect' && !value.redirectTargetRef) {
      context.addIssue({ code: 'custom', path: ['redirectTargetRef'], message: 'Redirect claims require a governed target reference.' });
    }
    if (value.kind !== 'redirect' && value.redirectTargetRef) {
      context.addIssue({ code: 'custom', path: ['redirectTargetRef'], message: 'Only redirect claims may declare redirectTargetRef.' });
    }
  });

/**
 * Read compatibility for schemaVersion 1 Page and Workbench records written
 * before route claims carried their owning product surface. New declarations
 * must use RouteClaimSchema; compilers infer this legacy form only from the
 * exact pinned RouteSpace.
 */
export const LegacyRouteClaimSchema = RouteClaimBaseSchema;

export const RouteClaimSchema = RouteClaimBaseSchema.safeExtend({
  surface: ProductSurfaceSchema,
}).strict();

export const DeclarativeRouteClaimSchema = RouteClaimSchema;
const LegacyDeclarativeRouteClaimSchema = LegacyRouteClaimSchema;

export const CompiledRouteMatcherSchema = z
  .object({
    caseSensitive: z.boolean(),
    trailingSlash: z.enum(['preserve', 'remove', 'require']),
    parameters: z.array(RouteSpaceParameterSchema),
  })
  .strict();

export const CompiledRouteClaimSchema = RouteClaimSchema.safeExtend({
  normalizedPath: RoutePathTemplateSchema,
  matcher: CompiledRouteMatcherSchema,
}).strict();

const LegacyCompiledRouteClaimSchema = LegacyRouteClaimSchema.safeExtend({
  normalizedPath: RoutePathTemplateSchema,
  matcher: CompiledRouteMatcherSchema,
}).strict();

const validateDeclaredRouteSurfaces = (
  supportedSurfaces: readonly z.infer<typeof ProductSurfaceSchema>[],
  routeClaims: readonly z.infer<typeof LegacyDeclarativeRouteClaimSchema | typeof DeclarativeRouteClaimSchema>[],
  context: z.RefinementCtx,
) => {
  if (uniqueArray(supportedSurfaces, (surface) => surface)) {
    context.addIssue({ code: 'custom', path: ['supportedSurfaces'], message: 'Supported surfaces must be unique.' });
  }
  const explicitClaims = routeClaims.filter((claim): claim is z.infer<typeof DeclarativeRouteClaimSchema> => 'surface' in claim);
  if (explicitClaims.length > 0 && explicitClaims.length < routeClaims.length) {
    context.addIssue({ code: 'custom', path: ['routeClaims'], message: 'Route claims must either all declare surface or all omit it for legacy compatibility.' });
    return;
  }
  routeClaims.forEach((claim, index) => {
    if ('surface' in claim && !supportedSurfaces.includes(claim.surface)) {
      context.addIssue({ code: 'custom', path: ['routeClaims', index, 'surface'], message: 'Route claim surface must be declared by supportedSurfaces.' });
    }
  });
  if (explicitClaims.length !== routeClaims.length) return;
  supportedSurfaces.forEach((surface) => {
    const canonicalCount = explicitClaims.filter((claim) => claim.surface === surface && claim.kind === 'canonical').length;
    if (canonicalCount !== 1) {
      context.addIssue({ code: 'custom', path: ['routeClaims'], message: `Surface ${surface} requires exactly one canonical route claim.` });
    }
  });
};

export const ReleaseOperationSchema = z.enum(['activate', 'deactivate', 'rollback']);
export const ReleaseDependencyRoleSchema = z.enum([
  'route-space',
  'shell',
  'page',
  'page-release',
  'workbench',
  'workbench-release',
  'navigation',
  'navigation-release',
  'menu-action',
  'application-menu-catalog',
  'capability',
  'provider',
  'ontology-definition',
  'view',
  'projection',
  'action',
  'token',
  'schema',
  'compiler',
  'workflow',
  'agent',
  'built-in-application',
  'design',
  'layout-policy',
  'performance-budget',
  'observation-policy',
]);

const DependencyKindByRole: Readonly<Record<z.infer<typeof ReleaseDependencyRoleSchema>, string>> = {
  'route-space': 'route-space',
  shell: 'shell',
  page: 'page',
  'page-release': 'page-release',
  workbench: 'workbench',
  'workbench-release': 'workbench-release',
  navigation: 'navigation',
  'navigation-release': 'navigation-release',
  'menu-action': 'menu-action',
  'application-menu-catalog': 'application-menu-catalog',
  capability: 'capability',
  provider: 'view-provider',
  'ontology-definition': 'ontology-definition',
  view: 'view',
  projection: 'projection',
  action: 'domain-command',
  token: 'design-token',
  schema: 'schema',
  compiler: 'compiler',
  workflow: 'workflow',
  agent: 'agent',
  'built-in-application': 'built-in-application',
  design: 'design',
  'layout-policy': 'layout-policy',
  'performance-budget': 'performance-budget',
  'observation-policy': 'observation-policy',
};

export const ReleaseDependencySchema = z
  .object({
    role: ReleaseDependencyRoleSchema,
    revisionRef: RevisionRefSchema,
  })
  .strict()
  .superRefine((value, context) => {
    const expectedKind = DependencyKindByRole[value.role];
    if (value.revisionRef.kind !== expectedKind) {
      context.addIssue({
        code: 'custom',
        path: ['revisionRef', 'kind'],
        message: `Dependency role ${value.role} requires reference kind ${expectedKind}.`,
      });
    }
  });

export const ReleaseValidationSchema = z
  .object({
    result: z.enum(['pass', 'fail']),
    inputHash: Sha256Schema,
    diagnosticRefs: z.array(RevisionRefSchema),
  })
  .strict();

export const ReleaseEvidenceSchema = z
  .object({
    publicationPlanRef: StableRefSchema,
    expectedHeadRevisionRef: RevisionRefSchema.nullable(),
    validation: ReleaseValidationSchema,
    approvalPolicyRevisionRef: RevisionRefSchema,
    approvalDecisionRevisionRef: RevisionRefSchema,
    actorRef: StableRefSchema,
    reason: z.string().trim().min(1).max(4_096),
    idempotencyKey: ContractIdentifierSchema,
    occurredAt: IsoDateTimeSchema,
    evidenceRefs: z.array(RevisionRefSchema).min(1),
  })
  .strict()
  .superRefine((value, context) => {
    const expectedKinds: Array<[string, z.infer<typeof StableRefSchema>, string]> = [
      ['publicationPlanRef', value.publicationPlanRef, 'publication-plan'],
      ['approvalPolicyRevisionRef', value.approvalPolicyRevisionRef, 'approval-policy'],
      ['approvalDecisionRevisionRef', value.approvalDecisionRevisionRef, 'approval-decision'],
      ['actorRef', value.actorRef, 'actor'],
    ];
    expectedKinds.forEach(([field, reference, expectedKind]) => {
      if (reference.kind !== expectedKind) {
        context.addIssue({ code: 'custom', path: [field, 'kind'], message: `${field} must reference ${expectedKind}.` });
      }
    });
    value.evidenceRefs.forEach((reference, index) => {
      if (reference.kind !== 'evidence') context.addIssue({ code: 'custom', path: ['evidenceRefs', index, 'kind'], message: 'Release evidenceRefs must reference evidence revisions.' });
    });
  });

export const PublicationPlanOperationSchema = z
  .object({
    releaseKind: z.enum(['page-release', 'workbench-release', 'navigation-release']),
    releaseSlotId: ContractIdentifierSchema,
    releaseRevisionRef: RevisionRefSchema,
    expectedHeadRevisionRef: RevisionRefSchema.nullable(),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.releaseRevisionRef.kind !== value.releaseKind || value.releaseRevisionRef.id !== value.releaseSlotId) {
      context.addIssue({ code: 'custom', path: ['releaseRevisionRef'], message: 'Publication Plan operation must pin the exact release slot revision.' });
    }
    if (value.expectedHeadRevisionRef
      && (value.expectedHeadRevisionRef.kind !== value.releaseKind || value.expectedHeadRevisionRef.id !== value.releaseSlotId)) {
      context.addIssue({ code: 'custom', path: ['expectedHeadRevisionRef'], message: 'Expected head must identify the same release slot.' });
    }
  });

export const PublicationPlanSchema = z
  .object({
    contract: z.literal('PublicationPlan'),
    schemaVersion: z.literal(DECLARATIVE_CONTROL_SCHEMA_VERSION),
    planId: ContractIdentifierSchema,
    tenantScope: TenantScopeSchema,
    environmentRef: StableRefSchema,
    operations: z.array(PublicationPlanOperationSchema).min(1),
    validation: ReleaseValidationSchema,
    approvalPolicyRevisionRef: RevisionRefSchema,
    approvalDecisionRevisionRef: RevisionRefSchema,
    actorRef: StableRefSchema,
    idempotencyKey: ContractIdentifierSchema,
    evidenceRefs: z.array(RevisionRefSchema).min(1),
    createdAt: IsoDateTimeSchema,
  })
  .strict()
  .superRefine((value, context) => {
    if (value.environmentRef.kind !== 'environment') context.addIssue({ code: 'custom', path: ['environmentRef', 'kind'], message: 'Publication Plan requires an environment reference.' });
    const governedRefs: Array<[string, z.infer<typeof StableRefSchema>, string]> = [
      ['approvalPolicyRevisionRef', value.approvalPolicyRevisionRef, 'approval-policy'],
      ['approvalDecisionRevisionRef', value.approvalDecisionRevisionRef, 'approval-decision'],
      ['actorRef', value.actorRef, 'actor'],
    ];
    governedRefs.forEach(([field, reference, expectedKind]) => {
      if (reference.kind !== expectedKind) context.addIssue({ code: 'custom', path: [field, 'kind'], message: `${field} must reference ${expectedKind}.` });
    });
    value.operations.forEach((operation, index) => {
      [operation.releaseRevisionRef, operation.expectedHeadRevisionRef].forEach((reference, referenceIndex) => {
        if (reference?.tenantScope && tenantScopeKey(reference.tenantScope) !== tenantScopeKey(value.tenantScope)) {
          const field = referenceIndex === 0 ? 'releaseRevisionRef' : 'expectedHeadRevisionRef';
          context.addIssue({ code: 'custom', path: ['operations', index, field, 'tenantScope'], message: 'Publication Plan operation belongs to another tenant scope.' });
        }
      });
    });
    value.evidenceRefs.forEach((reference, index) => {
      if (reference.kind !== 'evidence') context.addIssue({ code: 'custom', path: ['evidenceRefs', index, 'kind'], message: 'Publication Plan evidenceRefs must reference evidence revisions.' });
    });
    if (uniqueArray(value.operations, (operation) => `${operation.releaseKind}:${operation.releaseSlotId}`)) {
      context.addIssue({ code: 'custom', path: ['operations'], message: 'Publication Plan release slots must be unique.' });
    }
  });

const IdentitySchema = z
  .object({
    name: I18nTextSchema,
    description: I18nTextSchema.optional(),
    tags: z.array(ContractIdentifierSchema).default([]),
  })
  .strict();

export const WorkbenchIdentitySchema = IdentitySchema.extend({ iconRef: StableRefSchema.optional() }).strict();

const ReleaseBaseShape = {
  schemaVersion: z.literal(DECLARATIVE_CONTROL_SCHEMA_VERSION),
  releaseSlotId: ContractIdentifierSchema,
  tenantScope: TenantScopeSchema,
  operation: ReleaseOperationSchema,
  dependencySnapshot: z.array(ReleaseDependencySchema),
  evidence: ReleaseEvidenceSchema,
};

const validateDependencySnapshot = (
  snapshot: readonly z.infer<typeof ReleaseDependencySchema>[],
  context: z.RefinementCtx,
) => {
  const duplicate = uniqueArray(snapshot, (dependency) =>
    `${dependency.role}:${stableRefIdentity(dependency.revisionRef)}@${dependency.revisionRef.revision}`);
  if (duplicate) context.addIssue({ code: 'custom', path: ['dependencySnapshot'], message: `Duplicate dependency: ${duplicate}` });
};

const validateReleaseExpectedHead = (
  value: {
    releaseSlotId: string;
    tenantScope: z.infer<typeof TenantScopeSchema>;
    evidence: z.infer<typeof ReleaseEvidenceSchema>;
  },
  expectedKind: 'page-release' | 'workbench-release' | 'navigation-release',
  context: z.RefinementCtx,
) => {
  const expectedHead = value.evidence.expectedHeadRevisionRef;
  if (expectedHead && (expectedHead.kind !== expectedKind || expectedHead.id !== value.releaseSlotId)) {
    context.addIssue({ code: 'custom', path: ['evidence', 'expectedHeadRevisionRef'], message: 'Expected head must identify the same release slot.' });
  }
  if (expectedHead?.tenantScope && tenantScopeKey(expectedHead.tenantScope) !== tenantScopeKey(value.tenantScope)) {
    context.addIssue({ code: 'custom', path: ['evidence', 'expectedHeadRevisionRef', 'tenantScope'], message: 'Expected head belongs to another tenant scope.' });
  }
};

export const BindingSourceSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('constant'), value: z.union([z.string(), z.number().finite(), z.boolean(), z.null()]) }).strict(),
  z.object({ kind: z.literal('route-parameter'), name: ContractIdentifierSchema }).strict(),
  z.object({ kind: z.literal('query-parameter'), name: ContractIdentifierSchema }).strict(),
  z.object({ kind: z.literal('identity'), name: z.enum(['tenantId', 'teamId', 'userId']) }).strict(),
  z.object({ kind: z.literal('intent-field'), path: z.string().trim().regex(/^[A-Za-z0-9_.-]+$/) }).strict(),
  z.object({ kind: z.literal('binding-field'), bindingId: ContractIdentifierSchema, path: z.string().trim().regex(/^[A-Za-z0-9_.-]+$/) }).strict(),
]);

export const CapabilityInstanceSchema = z
  .object({
    instanceId: ContractIdentifierSchema,
    nodeId: ContractIdentifierSchema,
    capabilityRevisionRef: RevisionRefSchema,
    providerRevisionRef: RevisionRefSchema,
    propertySchemaRevisionRef: RevisionRefSchema,
    properties: JsonObjectSchema,
    allowedSideEffects: z.array(z.enum(['network', 'storage', 'navigation', 'worker', 'websocket'])),
  })
  .strict();

export const OntologyBindingSchema = z
  .object({
    bindingId: ContractIdentifierSchema,
    ontologyDefinitionRevisionRef: RevisionRefSchema,
    viewRevisionRef: RevisionRefSchema.optional(),
    projectionRevisionRef: RevisionRefSchema.optional(),
    parameters: z.record(ContractIdentifierSchema, BindingSourceSchema),
    target: z.object({ capabilityInstanceId: ContractIdentifierSchema, port: ContractIdentifierSchema }).strict(),
    renderModelSchemaRevisionRef: RevisionRefSchema,
    pagination: z.enum(['none', 'cursor', 'offset']),
    cache: z.enum(['none', 'identity-scoped', 'tenant-scoped']),
    cancelOnChange: z.boolean(),
  })
  .strict()
  .superRefine((value, context) => {
    if ((value.viewRevisionRef ? 1 : 0) + (value.projectionRevisionRef ? 1 : 0) !== 1) {
      context.addIssue({ code: 'custom', path: ['viewRevisionRef'], message: 'Ontology bindings require exactly one View or Projection revision.' });
    }
    if (value.ontologyDefinitionRevisionRef.kind !== 'ontology-definition') {
      context.addIssue({ code: 'custom', path: ['ontologyDefinitionRevisionRef', 'kind'], message: 'Expected an ontology-definition revision.' });
    }
  });

export const ActionBindingSchema = z
  .object({
    bindingId: ContractIdentifierSchema,
    commandRevisionRef: RevisionRefSchema,
    source: z.object({ capabilityInstanceId: ContractIdentifierSchema, port: ContractIdentifierSchema }).strict(),
    sourceIntentSchemaRevisionRef: RevisionRefSchema,
    inputSchemaRevisionRef: RevisionRefSchema,
    inputMapping: z.record(ContractIdentifierSchema, BindingSourceSchema),
    accessPolicy: AccessPolicySchema,
    confirmation: I18nTextSchema.optional(),
    idempotencyKeySource: z.enum(['interaction', 'record-and-interaction', 'caller-provided']),
    compensationCommandRevisionRef: RevisionRefSchema.optional(),
    resultSchemaRevisionRef: RevisionRefSchema,
    success: z.object({
      refreshBindingIds: z.array(ContractIdentifierSchema),
      navigationTargetRef: StableRefSchema.optional(),
    }).strict(),
    recovery: z.enum(['retry-safe', 'compensating-command', 'manual-review']),
    lineageRequired: z.literal(true),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.commandRevisionRef.kind !== 'domain-command') {
      context.addIssue({ code: 'custom', path: ['commandRevisionRef', 'kind'], message: 'Action bindings must reference a domain-command revision.' });
    }
    if (value.sourceIntentSchemaRevisionRef.kind !== 'schema') {
      context.addIssue({ code: 'custom', path: ['sourceIntentSchemaRevisionRef', 'kind'], message: 'Action source intents must pin a schema revision.' });
    }
    if (value.inputSchemaRevisionRef.kind !== 'schema') {
      context.addIssue({ code: 'custom', path: ['inputSchemaRevisionRef', 'kind'], message: 'Action command inputs must pin a schema revision.' });
    }
    if (value.recovery === 'compensating-command' && !value.compensationCommandRevisionRef) {
      context.addIssue({ code: 'custom', path: ['compensationCommandRevisionRef'], message: 'Compensating recovery requires a compensation command.' });
    }
  });

export const PageSchema = z
  .object({
    contract: z.literal('Page'),
    schemaVersion: z.literal(DECLARATIVE_CONTROL_SCHEMA_VERSION),
    pageId: ContractIdentifierSchema,
    tenantScope: TenantScopeSchema,
    identity: IdentitySchema,
    supportedSurfaces: z.array(ProductSurfaceSchema).min(1),
    lifecycle: DeclarativeLifecycleSchema,
    routeClaims: z.array(z.union([DeclarativeRouteClaimSchema, LegacyDeclarativeRouteClaimSchema])).min(1),
    shellRevisionRef: RevisionRefSchema,
    renderTree: RenderTreeSchema,
    capabilityInstances: z.array(CapabilityInstanceSchema).min(1),
    ontologyBindings: z.array(OntologyBindingSchema),
    actionBindings: z.array(ActionBindingSchema),
    pageAccessPolicy: AccessPolicySchema,
    managementAccess: ManagementAccessSchema,
    tokenRevisionRefs: z.array(RevisionRefSchema).min(1),
    performanceBudgetRef: RevisionRefSchema,
    observationPolicyRevisionRef: RevisionRefSchema,
    privacyClassification: z.enum(['public', 'internal', 'confidential', 'restricted']),
  })
  .strict()
  .superRefine((value, context) => {
    validateDeclaredRouteSurfaces(value.supportedSurfaces, value.routeClaims, context);
    const uniqueness: Array<[string, readonly { [key: string]: unknown }[], (candidate: { [key: string]: unknown }) => string]> = [
      ['capabilityInstances', value.capabilityInstances, (candidate) => String(candidate.instanceId)],
      ['ontologyBindings', value.ontologyBindings, (candidate) => String(candidate.bindingId)],
      ['actionBindings', value.actionBindings, (candidate) => String(candidate.bindingId)],
    ];
    uniqueness.forEach(([field, values, identity]) => {
      if (uniqueArray(values, identity)) context.addIssue({ code: 'custom', path: [field], message: `${field} identities must be unique.` });
    });
    const instanceIds = new Set(value.capabilityInstances.map((instance) => instance.instanceId));
    value.ontologyBindings.forEach((binding, index) => {
      if (!instanceIds.has(binding.target.capabilityInstanceId)) {
        context.addIssue({ code: 'custom', path: ['ontologyBindings', index, 'target', 'capabilityInstanceId'], message: 'Ontology binding targets an unknown capability instance.' });
      }
    });
    value.actionBindings.forEach((binding, index) => {
      if (!instanceIds.has(binding.source.capabilityInstanceId)) {
        context.addIssue({ code: 'custom', path: ['actionBindings', index, 'source', 'capabilityInstanceId'], message: 'Action binding sources an unknown capability instance.' });
      }
      binding.success.refreshBindingIds.forEach((bindingId) => {
        if (!value.ontologyBindings.some((candidate) => candidate.bindingId === bindingId)) {
          context.addIssue({ code: 'custom', path: ['actionBindings', index, 'success', 'refreshBindingIds'], message: `Unknown refresh binding: ${bindingId}` });
        }
      });
    });
    if (value.shellRevisionRef.kind !== 'shell') context.addIssue({ code: 'custom', path: ['shellRevisionRef', 'kind'], message: 'Page shellRevisionRef must reference a shell.' });
    value.capabilityInstances.forEach((instance, index) => {
      const refs: Array<[string, z.infer<typeof RevisionRefSchema>, string]> = [
        ['capabilityRevisionRef', instance.capabilityRevisionRef, 'capability'],
        ['providerRevisionRef', instance.providerRevisionRef, 'view-provider'],
        ['propertySchemaRevisionRef', instance.propertySchemaRevisionRef, 'schema'],
      ];
      refs.forEach(([field, reference, expectedKind]) => {
        if (reference.kind !== expectedKind) context.addIssue({ code: 'custom', path: ['capabilityInstances', index, field, 'kind'], message: `${field} must reference ${expectedKind}.` });
      });
    });
    value.tokenRevisionRefs.forEach((reference, index) => {
      if (reference.kind !== 'design-token') context.addIssue({ code: 'custom', path: ['tokenRevisionRefs', index, 'kind'], message: 'Page token references must use kind design-token.' });
    });
    if (value.performanceBudgetRef.kind !== 'performance-budget') context.addIssue({ code: 'custom', path: ['performanceBudgetRef', 'kind'], message: 'Page requires a performance-budget revision.' });
    if (value.observationPolicyRevisionRef.kind !== 'observation-policy') context.addIssue({ code: 'custom', path: ['observationPolicyRevisionRef', 'kind'], message: 'Page requires an observation-policy revision.' });
  });

export const PageReleaseSchema = z
  .object({
    contract: z.literal('PageRelease'),
    ...ReleaseBaseShape,
    pageRevisionRef: RevisionRefSchema,
    target: z.object({
      environmentRef: StableRefSchema,
      surface: ProductSurfaceSchema,
      routeSpaceRevisionRef: RevisionRefSchema,
      normalizedPath: RoutePathTemplateSchema,
      routeClaim: z.union([CompiledRouteClaimSchema, LegacyCompiledRouteClaimSchema]),
    }).strict(),
  })
  .strict()
  .superRefine((value, context) => {
    validateDependencySnapshot(value.dependencySnapshot, context);
    validateReleaseExpectedHead(value, 'page-release', context);
    if (value.pageRevisionRef.kind !== 'page') context.addIssue({ code: 'custom', path: ['pageRevisionRef', 'kind'], message: 'Expected a page revision.' });
    if (value.target.environmentRef.kind !== 'environment') context.addIssue({ code: 'custom', path: ['target', 'environmentRef', 'kind'], message: 'Page release target requires an environment reference.' });
    if (value.target.routeSpaceRevisionRef.kind !== 'route-space') context.addIssue({ code: 'custom', path: ['target', 'routeSpaceRevisionRef', 'kind'], message: 'Page release target requires a route-space revision.' });
    if (value.target.normalizedPath !== value.target.routeClaim.normalizedPath || !exactRevisionRef(value.target.routeSpaceRevisionRef, value.target.routeClaim.routeSpaceRevisionRef)) {
      context.addIssue({ code: 'custom', path: ['target', 'routeClaim'], message: 'Page Release route authority must pin the exact compiled claim and normalized path.' });
    }
    if ('surface' in value.target.routeClaim && value.target.routeClaim.surface !== value.target.surface) {
      context.addIssue({ code: 'custom', path: ['target', 'routeClaim', 'surface'], message: 'Page Release route claim must match the target surface.' });
    }
  });

export const WorkbenchGroupSchema = z
  .object({
    groupId: ContractIdentifierSchema,
    label: I18nTextSchema,
    iconRef: StableRefSchema.optional(),
    order: z.number().int(),
    collapsedByDefault: z.boolean(),
    accessPolicy: AccessPolicySchema.optional(),
  })
  .strict();

export const WorkbenchAppInstanceSchema = z
  .object({
    instanceId: ContractIdentifierSchema,
    kind: z.enum(['built-in-application', 'workflow-form', 'workflow', 'agent', 'design', 'capability']),
    targetRevisionRef: RevisionRefSchema,
    providerRevisionRef: RevisionRefSchema,
    inputSchemaRevisionRef: RevisionRefSchema,
    input: JsonObjectSchema,
    groupId: ContractIdentifierSchema,
    order: z.number().int(),
    display: z.object({ name: I18nTextSchema.optional(), iconRef: StableRefSchema.optional() }).strict(),
    accessPolicy: AccessPolicySchema,
  })
  .strict();

export const WorkbenchSchema = z
  .object({
    contract: z.literal('Workbench'),
    schemaVersion: z.literal(DECLARATIVE_CONTROL_SCHEMA_VERSION),
    workbenchId: ContractIdentifierSchema,
    tenantScope: TenantScopeSchema,
    purpose: z.enum(['instance', 'template']),
    sourceTemplateRevisionRef: RevisionRefSchema.optional(),
    identity: WorkbenchIdentitySchema,
    supportedSurfaces: z.array(ProductSurfaceSchema).min(1),
    lifecycle: DeclarativeLifecycleSchema,
    routeClaims: z.array(z.union([DeclarativeRouteClaimSchema, LegacyDeclarativeRouteClaimSchema])).min(1),
    groups: z.array(WorkbenchGroupSchema).min(1),
    appInstances: z.array(WorkbenchAppInstanceSchema).min(1),
    defaultEntry: z.object({ groupId: ContractIdentifierSchema, instanceId: ContractIdentifierSchema, showDefaultGroup: z.boolean() }).strict(),
    layout: z.object({
      hostCapabilityRevisionRef: RevisionRefSchema,
      hostProviderRevisionRef: RevisionRefSchema,
      layoutPolicyRevisionRef: RevisionRefSchema,
      tokenRevisionRefs: z.array(RevisionRefSchema).min(1),
    }).strict(),
    workbenchAccessPolicy: AccessPolicySchema,
    managementAccess: ManagementAccessSchema,
    personalPreferencesPolicy: z.object({
      allowed: z.array(z.enum(['collapsed-groups', 'recent-entry', 'layout-density'])),
      authority: z.literal('identity-overlay'),
    }).strict(),
    performanceBudgetRef: RevisionRefSchema,
    observationPolicyRevisionRef: RevisionRefSchema,
    privacyClassification: z.enum(['public', 'internal', 'confidential', 'restricted']),
  })
  .strict()
  .superRefine((value, context) => {
    validateDeclaredRouteSurfaces(value.supportedSurfaces, value.routeClaims, context);
    if (value.purpose === 'template' && value.sourceTemplateRevisionRef) {
      context.addIssue({ code: 'custom', path: ['sourceTemplateRevisionRef'], message: 'Templates cannot derive from another template at runtime.' });
    }
    const duplicateGroup = uniqueArray(value.groups, (group) => group.groupId);
    if (duplicateGroup) context.addIssue({ code: 'custom', path: ['groups'], message: `Duplicate Workbench group: ${duplicateGroup}` });
    const duplicateInstance = uniqueArray(value.appInstances, (instance) => instance.instanceId);
    if (duplicateInstance) context.addIssue({ code: 'custom', path: ['appInstances'], message: `Duplicate Workbench instance: ${duplicateInstance}` });
    const groupIds = new Set(value.groups.map((group) => group.groupId));
    value.appInstances.forEach((instance, index) => {
      if (!groupIds.has(instance.groupId)) context.addIssue({ code: 'custom', path: ['appInstances', index, 'groupId'], message: 'Workbench app references an unknown group.' });
    });
    const defaultInstance = value.appInstances.find((instance) => instance.instanceId === value.defaultEntry.instanceId);
    if (!defaultInstance || defaultInstance.groupId !== value.defaultEntry.groupId) {
      context.addIssue({ code: 'custom', path: ['defaultEntry'], message: 'Workbench default entry must reference an app in the declared group.' });
    }
    const targetKindByInstanceKind: Readonly<Record<z.infer<typeof WorkbenchAppInstanceSchema>['kind'], string>> = {
      'built-in-application': 'built-in-application',
      'workflow-form': 'workflow',
      workflow: 'workflow',
      agent: 'agent',
      design: 'design',
      capability: 'capability',
    };
    value.appInstances.forEach((instance, index) => {
      if (instance.targetRevisionRef.kind !== targetKindByInstanceKind[instance.kind]) context.addIssue({ code: 'custom', path: ['appInstances', index, 'targetRevisionRef', 'kind'], message: `Workbench ${instance.kind} target has an incompatible reference kind.` });
      if (instance.providerRevisionRef.kind !== 'view-provider') context.addIssue({ code: 'custom', path: ['appInstances', index, 'providerRevisionRef', 'kind'], message: 'Workbench app provider must use kind view-provider.' });
      if (instance.inputSchemaRevisionRef.kind !== 'schema') context.addIssue({ code: 'custom', path: ['appInstances', index, 'inputSchemaRevisionRef', 'kind'], message: 'Workbench app input must pin a schema revision.' });
    });
    const layoutRefs: Array<[string, z.infer<typeof RevisionRefSchema>, string]> = [
      ['hostCapabilityRevisionRef', value.layout.hostCapabilityRevisionRef, 'capability'],
      ['hostProviderRevisionRef', value.layout.hostProviderRevisionRef, 'view-provider'],
      ['layoutPolicyRevisionRef', value.layout.layoutPolicyRevisionRef, 'layout-policy'],
    ];
    layoutRefs.forEach(([field, reference, expectedKind]) => {
      if (reference.kind !== expectedKind) context.addIssue({ code: 'custom', path: ['layout', field, 'kind'], message: `${field} must reference ${expectedKind}.` });
    });
    value.layout.tokenRevisionRefs.forEach((reference, index) => {
      if (reference.kind !== 'design-token') context.addIssue({ code: 'custom', path: ['layout', 'tokenRevisionRefs', index, 'kind'], message: 'Workbench token references must use kind design-token.' });
    });
  });

export const WorkbenchReleaseSchema = z
  .object({
    contract: z.literal('WorkbenchRelease'),
    ...ReleaseBaseShape,
    workbenchRevisionRef: RevisionRefSchema,
    target: z.object({
      environmentRef: StableRefSchema,
      surface: ProductSurfaceSchema,
      workbenchId: ContractIdentifierSchema,
      routeSpaceRevisionRef: RevisionRefSchema,
      normalizedPath: RoutePathTemplateSchema,
      routeClaim: z.union([CompiledRouteClaimSchema, LegacyCompiledRouteClaimSchema]),
      order: z.number().int(),
      isDefaultCandidate: z.boolean(),
    }).strict(),
  })
  .strict()
  .superRefine((value, context) => {
    validateDependencySnapshot(value.dependencySnapshot, context);
    validateReleaseExpectedHead(value, 'workbench-release', context);
    if (value.workbenchRevisionRef.kind !== 'workbench') context.addIssue({ code: 'custom', path: ['workbenchRevisionRef', 'kind'], message: 'Expected a workbench revision.' });
    if (value.target.environmentRef.kind !== 'environment') context.addIssue({ code: 'custom', path: ['target', 'environmentRef', 'kind'], message: 'Workbench release target requires an environment reference.' });
    if (value.target.routeSpaceRevisionRef.kind !== 'route-space') context.addIssue({ code: 'custom', path: ['target', 'routeSpaceRevisionRef', 'kind'], message: 'Workbench release target requires a route-space revision.' });
    if (value.target.normalizedPath !== value.target.routeClaim.normalizedPath || !exactRevisionRef(value.target.routeSpaceRevisionRef, value.target.routeClaim.routeSpaceRevisionRef)) {
      context.addIssue({ code: 'custom', path: ['target', 'routeClaim'], message: 'Workbench Release route authority must pin the exact compiled claim and normalized path.' });
    }
    if ('surface' in value.target.routeClaim && value.target.routeClaim.surface !== value.target.surface) {
      context.addIssue({ code: 'custom', path: ['target', 'routeClaim', 'surface'], message: 'Workbench Release route claim must match the target surface.' });
    }
  });

const NavigationNodeBaseShape = {
  nodeId: ContractIdentifierSchema,
  parentNodeId: ContractIdentifierSchema.nullable(),
  order: z.number().int(),
  disabled: z.boolean().optional(),
};

export const NavigationGroupNodeSchema = z.object({
  ...NavigationNodeBaseShape,
  kind: z.literal('group'),
  label: I18nTextSchema,
  iconRef: StableRefSchema.optional(),
  collapsedByDefault: z.boolean(),
  audience: AccessPolicySchema,
}).strict();

export const NavigationTargetNodeSchema = z.object({
  ...NavigationNodeBaseShape,
  kind: z.literal('target'),
  label: I18nTextSchema,
  iconRef: StableRefSchema.optional(),
  tone: z.enum(['default', 'danger']).optional(),
  targetRef: StableRefSchema,
  parameterMapping: z.record(ContractIdentifierSchema, BindingSourceSchema),
  audience: AccessPolicySchema,
}).strict();

export const NavigationSeparatorNodeSchema = z.object({
  ...NavigationNodeBaseShape,
  kind: z.literal('separator'),
}).strict();

export const NavigationNodeSchema = z.discriminatedUnion('kind', [
  NavigationGroupNodeSchema,
  NavigationTargetNodeSchema,
  NavigationSeparatorNodeSchema,
]);

const validateNavigationTree = (
  nodes: readonly z.infer<typeof NavigationNodeSchema>[],
  context: z.RefinementCtx,
) => {
  const byId = new Map<string, { node: z.infer<typeof NavigationNodeSchema>; index: number }>();
  nodes.forEach((node, index) => {
    if (byId.has(node.nodeId)) context.addIssue({ code: 'custom', path: ['nodes', index, 'nodeId'], message: `Duplicate Navigation node: ${node.nodeId}` });
    else byId.set(node.nodeId, { node, index });
  });
  const siblingOrders = new Set<string>();
  nodes.forEach((node, index) => {
    const orderKey = `${node.parentNodeId ?? ''}:${node.order}`;
    if (siblingOrders.has(orderKey)) context.addIssue({ code: 'custom', path: ['nodes', index, 'order'], message: 'Sibling Navigation order values must be unique.' });
    siblingOrders.add(orderKey);
    if (node.parentNodeId) {
      const parent = byId.get(node.parentNodeId)?.node;
      if (!parent) context.addIssue({ code: 'custom', path: ['nodes', index, 'parentNodeId'], message: 'Navigation node has an unknown parent.' });
      else if (parent.kind !== 'group') context.addIssue({ code: 'custom', path: ['nodes', index, 'parentNodeId'], message: 'Navigation parents must be groups.' });
    }
    const ancestors = new Set([node.nodeId]);
    let parentId = node.parentNodeId;
    while (parentId) {
      if (ancestors.has(parentId)) {
        context.addIssue({ code: 'custom', path: ['nodes', index, 'parentNodeId'], message: `Navigation cycle contains ${node.nodeId}.` });
        break;
      }
      ancestors.add(parentId);
      parentId = byId.get(parentId)?.node.parentNodeId ?? null;
    }
  });
};

export const NavigationSchema = z
  .object({
    contract: z.literal('Navigation'),
    schemaVersion: z.literal(DECLARATIVE_CONTROL_SCHEMA_VERSION),
    navigationId: ContractIdentifierSchema,
    tenantScope: TenantScopeSchema,
    identity: IdentitySchema,
    supportedSurfaces: z.array(ProductSurfaceSchema).min(1),
    placements: z.array(ContractIdentifierSchema).min(1),
    lifecycle: DeclarativeLifecycleSchema,
    nodes: z.array(NavigationNodeSchema),
    managementAccess: ManagementAccessSchema,
    performanceBudgetRef: RevisionRefSchema,
    observationPolicyRevisionRef: RevisionRefSchema,
  })
  .strict()
  .superRefine((value, context) => {
    validateNavigationTree(value.nodes, context);
    value.nodes.forEach((node, index) => {
      if (node.kind === 'target' && !['page', 'workbench', 'menu-action', 'domain-command'].includes(node.targetRef.kind)) {
        context.addIssue({ code: 'custom', path: ['nodes', index, 'targetRef', 'kind'], message: 'Navigation targets must reference Page, Workbench, registered Menu Action, or DomainCommand identities.' });
      }
    });
  });

export const ResolvedNavigationTargetSchema = z
  .object({
    nodeId: ContractIdentifierSchema,
    stableTargetRef: StableRefSchema,
    targetRevisionRef: RevisionRefSchema,
    releaseRevisionRef: RevisionRefSchema.optional(),
  })
  .strict();

export const NavigationReleaseSchema = z
  .object({
    contract: z.literal('NavigationRelease'),
    ...ReleaseBaseShape,
    navigationRevisionRef: RevisionRefSchema,
    target: z.object({
      environmentRef: StableRefSchema,
      surface: ProductSurfaceSchema,
      placement: ContractIdentifierSchema,
    }).strict(),
    resolvedTargets: z.array(ResolvedNavigationTargetSchema),
  })
  .strict()
  .superRefine((value, context) => {
    validateDependencySnapshot(value.dependencySnapshot, context);
    validateReleaseExpectedHead(value, 'navigation-release', context);
    if (value.navigationRevisionRef.kind !== 'navigation') context.addIssue({ code: 'custom', path: ['navigationRevisionRef', 'kind'], message: 'Expected a navigation revision.' });
    if (value.target.environmentRef.kind !== 'environment') context.addIssue({ code: 'custom', path: ['target', 'environmentRef', 'kind'], message: 'Navigation release target requires an environment reference.' });
    if (uniqueArray(value.resolvedTargets, (target) => target.nodeId)) context.addIssue({ code: 'custom', path: ['resolvedTargets'], message: 'Resolved Navigation node IDs must be unique.' });
  });

const RuntimeDiagnosticSchema = z.object({
  code: ContractIdentifierSchema,
  severity: z.enum(['info', 'warning', 'error']),
  path: z.string().trim().min(1),
  message: z.string().trim().min(1),
}).strict();

const RuntimeBundleBaseShape = {
  schemaVersion: z.literal(DECLARATIVE_CONTROL_SCHEMA_VERSION),
  tenantScope: TenantScopeSchema,
  releaseRevisionRef: RevisionRefSchema,
  compilerRevisionRef: RevisionRefSchema,
  generation: z.number().int().nonnegative(),
  dependencySnapshot: z.array(ReleaseDependencySchema),
  contentHash: Sha256Schema,
  rebuildable: z.literal(true),
  diagnostics: z.array(RuntimeDiagnosticSchema),
};

export const PageRuntimeBundleSchema = z.object({
  contract: z.literal('PageRuntimeBundle'),
  ...RuntimeBundleBaseShape,
  pageId: ContractIdentifierSchema,
  pageRevisionRef: RevisionRefSchema,
  surface: ProductSurfaceSchema,
  routeClaims: z.array(CompiledRouteClaimSchema),
  shellRevisionRef: RevisionRefSchema,
  renderTree: RenderTreeSchema,
  capabilityInstances: z.array(CapabilityInstanceSchema),
  ontologyBindings: z.array(OntologyBindingSchema),
  actionBindings: z.array(ActionBindingSchema),
  pageAccessPolicy: AccessPolicySchema,
  tokenRevisionRefs: z.array(RevisionRefSchema),
  performanceBudgetRef: RevisionRefSchema,
  observationPolicyRevisionRef: RevisionRefSchema,
  privacyClassification: z.enum(['public', 'internal', 'confidential', 'restricted']),
}).strict();

export const ResolvedWorkbenchAppInstanceSchema = WorkbenchAppInstanceSchema.extend({
  targetAccessPolicy: AccessPolicySchema,
}).strict();

const WorkbenchRuntimeTargetSchema = WorkbenchReleaseSchema.shape.target.safeExtend({
  routeClaim: CompiledRouteClaimSchema,
}).strict();

export const WorkbenchRuntimeBundleSchema = z.object({
  contract: z.literal('WorkbenchRuntimeBundle'),
  ...RuntimeBundleBaseShape,
  workbenchId: ContractIdentifierSchema,
  workbenchRevisionRef: RevisionRefSchema,
  surface: ProductSurfaceSchema,
  routeClaims: z.array(CompiledRouteClaimSchema),
  groups: z.array(WorkbenchGroupSchema),
  appInstances: z.array(ResolvedWorkbenchAppInstanceSchema),
  defaultEntry: WorkbenchSchema.shape.defaultEntry,
  layout: WorkbenchSchema.shape.layout,
  workbenchAccessPolicy: AccessPolicySchema,
  personalPreferencesPolicy: WorkbenchSchema.shape.personalPreferencesPolicy,
  target: WorkbenchRuntimeTargetSchema,
  performanceBudgetRef: RevisionRefSchema,
  observationPolicyRevisionRef: RevisionRefSchema,
  privacyClassification: z.enum(['public', 'internal', 'confidential', 'restricted']),
}).strict();

const CompiledNavigationTargetSchema = ResolvedNavigationTargetSchema.extend({
  kind: z.literal('route'),
  accessPolicy: AccessPolicySchema,
  routeClaim: CompiledRouteClaimSchema,
}).strict();

export const CompiledNavigationRegisteredMenuActionTargetSchema = ResolvedNavigationTargetSchema.extend({
  kind: z.literal('registered-menu-action'),
  accessPolicy: AccessPolicySchema,
  execution: z.literal('client'),
  applicationId: ContractIdentifierSchema,
  actionRef: ContractIdentifierSchema,
  inputSchemaRef: ContractIdentifierSchema.optional(),
  input: JsonObjectSchema,
  sourceCatalogRevisionRef: RevisionRefSchema,
}).strict();

export const CompiledNavigationDomainCommandTargetSchema = ResolvedNavigationTargetSchema.extend({
  kind: z.literal('governed-domain-command'),
  accessPolicy: AccessPolicySchema,
  execution: z.literal('server'),
  commandRevisionRef: RevisionRefSchema,
  inputSchemaRevisionRef: RevisionRefSchema,
  resultSchemaRevisionRef: RevisionRefSchema.optional(),
  input: JsonObjectSchema,
}).strict();

export const CompiledNavigationResolvedTargetSchema = z.discriminatedUnion('kind', [
  CompiledNavigationTargetSchema,
  CompiledNavigationRegisteredMenuActionTargetSchema,
  CompiledNavigationDomainCommandTargetSchema,
]);

export const CompiledNavigationGroupNodeSchema = NavigationGroupNodeSchema.extend({
  ancestorAccessPolicies: z.array(AccessPolicySchema),
}).strict();

export const CompiledNavigationTargetNodeSchema = NavigationTargetNodeSchema.extend({
  ancestorAccessPolicies: z.array(AccessPolicySchema),
  resolvedTarget: CompiledNavigationResolvedTargetSchema,
}).strict();

export const CompiledNavigationSeparatorNodeSchema = NavigationSeparatorNodeSchema.extend({
  ancestorAccessPolicies: z.array(AccessPolicySchema),
}).strict();

export const CompiledNavigationNodeSchema = z.discriminatedUnion('kind', [
  CompiledNavigationGroupNodeSchema,
  CompiledNavigationTargetNodeSchema,
  CompiledNavigationSeparatorNodeSchema,
]);

export const NavigationRuntimeBundleSchema = z.object({
  contract: z.literal('NavigationRuntimeBundle'),
  ...RuntimeBundleBaseShape,
  navigationId: ContractIdentifierSchema,
  navigationRevisionRef: RevisionRefSchema,
  surface: ProductSurfaceSchema,
  placement: ContractIdentifierSchema,
  nodes: z.array(CompiledNavigationNodeSchema),
  performanceBudgetRef: RevisionRefSchema,
  observationPolicyRevisionRef: RevisionRefSchema,
}).strict();

export const DeclarativeControlOntologyDefinitionSchema = OntologyDefinitionSchema.extend({
  classification: z.literal('control'),
  discovery: z.object({
    ordinaryDataBrowser: z.literal(false),
    businessSearch: z.literal(false),
    businessStatistics: z.literal(false),
    ordinaryExport: z.literal(false),
    genericWrite: z.literal(false),
  }).strict(),
}).strict();

const controlDefinition = (ontologyId: string, bodySchemaRef: string) =>
  DeclarativeControlOntologyDefinitionSchema.parse({
    contract: 'OntologyDefinition',
    ontologyId,
    dataSpaceId: 'monkeys.control',
    ownerRepo: 'monkeys-js-sdk',
    bodySchemaRef,
    authority: { service: 'monkeys-data-server', storage: 'domain-record', scope: 'tenant' },
    relationKinds: [],
    metricKinds: [],
    classification: 'control',
    discovery: {
      ordinaryDataBrowser: false,
      businessSearch: false,
      businessStatistics: false,
      ordinaryExport: false,
      genericWrite: false,
    },
  });

export const DECLARATIVE_CONTROL_ONTOLOGY_DEFINITIONS = Object.freeze([
  controlDefinition('monkeys.system.page', 'monkeys.system.page/v1'),
  controlDefinition('monkeys.system.page-release', 'monkeys.system.page-release/v1'),
  controlDefinition('monkeys.system.workbench', 'monkeys.system.workbench/v1'),
  controlDefinition('monkeys.system.workbench-release', 'monkeys.system.workbench-release/v1'),
  controlDefinition('monkeys.system.navigation', 'monkeys.system.navigation/v1'),
  controlDefinition('monkeys.system.navigation-release', 'monkeys.system.navigation-release/v1'),
]);

export type I18nText = z.infer<typeof I18nTextSchema>;
export type ProductSurface = z.infer<typeof ProductSurfaceSchema>;
export type ScopedIdentityRef = z.infer<typeof ScopedIdentityRefSchema>;
export type TenantScope = z.infer<typeof TenantScopeSchema>;
export type StableRef = z.infer<typeof StableRefSchema>;
export type RevisionRef = z.infer<typeof RevisionRefSchema>;
export type StableRefAliasMap = z.infer<typeof StableRefAliasMapSchema>;
export type AccessPolicy = z.infer<typeof AccessPolicySchema>;
export type ManagementAccess = z.infer<typeof ManagementAccessSchema>;
export type RouteSpace = z.infer<typeof RouteSpaceSchema>;
export type LegacyRouteClaim = z.infer<typeof LegacyRouteClaimSchema>;
export type RouteClaim = z.infer<typeof RouteClaimSchema>;
export type DeclarativeRouteClaim = z.infer<typeof DeclarativeRouteClaimSchema> | LegacyRouteClaim;
export type CompiledRouteClaim = z.infer<typeof CompiledRouteClaimSchema>;
export type ReleaseDependency = z.infer<typeof ReleaseDependencySchema>;
export type ReleaseEvidence = z.infer<typeof ReleaseEvidenceSchema>;
export type PublicationPlanOperation = z.infer<typeof PublicationPlanOperationSchema>;
export type PublicationPlan = z.infer<typeof PublicationPlanSchema>;
export type CapabilityInstance = z.infer<typeof CapabilityInstanceSchema>;
export type OntologyBinding = z.infer<typeof OntologyBindingSchema>;
export type ActionBinding = z.infer<typeof ActionBindingSchema>;
export type Page = z.infer<typeof PageSchema>;
export type PageRelease = z.infer<typeof PageReleaseSchema>;
export type Workbench = z.infer<typeof WorkbenchSchema>;
export type WorkbenchRelease = z.infer<typeof WorkbenchReleaseSchema>;
export type NavigationNode = z.infer<typeof NavigationNodeSchema>;
export type Navigation = z.infer<typeof NavigationSchema>;
export type ResolvedNavigationTarget = z.infer<typeof ResolvedNavigationTargetSchema>;
export type CompiledNavigationResolvedTarget = z.infer<typeof CompiledNavigationResolvedTargetSchema>;
export type NavigationRelease = z.infer<typeof NavigationReleaseSchema>;
export type PageRuntimeBundle = z.infer<typeof PageRuntimeBundleSchema>;
export type WorkbenchRuntimeBundle = z.infer<typeof WorkbenchRuntimeBundleSchema>;
export type NavigationRuntimeBundle = z.infer<typeof NavigationRuntimeBundleSchema>;
export type DeclarativeControlOntologyDefinition = z.infer<typeof DeclarativeControlOntologyDefinitionSchema>;
