import { z } from "zod";
import {
  ContractIdentifierSchema,
  ContractVersionSchema,
  EntityRefSchema,
  IsoDateTimeSchema,
  JsonObjectSchema,
  JsonValueSchema,
  LocaleIdentifierSchema,
  SensitiveResultPathSchema,
  SensitiveResultPathsSchema,
  Sha256Schema,
} from "./common";
import { OntologyDefinitionSchema } from "./data";
import { LegacyRoutePolicySchema } from "./legacy-route";
import { FilePurposeSchema } from "./file";
import {
  RenderActivationSchema,
  RenderLayoutSchema,
  RenderLifecycleSchema,
  RenderNodeKindSchema,
  RenderNodeStateSchema,
  RenderResponsiveRuleSchema,
  RenderScrollSchema,
  RenderStyleSchema,
  RenderSurfaceSchema,
  RenderTreeSchema,
} from "./render";
import {
  PageExpressionSchema,
  PageValuePathSchema,
  PagePropertyBindingSchema,
  visitPageExpression,
  collectPageExpressionReads,
  collectExternalPageExpressionReads,
} from "./page-expression";
import { analyzePageBindingDependencies } from "./page-binding-dependencies";
export { analyzePageBindingDependencies } from "./page-binding-dependencies";
export const DECLARATIVE_CONTROL_SCHEMA_VERSION = 1;
const uniqueArray = <T>(
  values: readonly T[],
  identity: (value: T) => string,
): string | undefined => {
  const seen = new Set<string>();
  for (const value of values) {
    const key = identity(value);
    if (seen.has(key)) return key;
    seen.add(key);
  }
  return undefined;
};
const exactRevisionRef = (
  left: z.infer<typeof RevisionRefSchema>,
  right: z.infer<typeof RevisionRefSchema>,
): boolean =>
  stableRefIdentity(left) === stableRefIdentity(right) &&
  left.revision === right.revision &&
  left.schemaVersion === right.schemaVersion &&
  left.contentHash === right.contentHash;
export const I18nTextSchema = z
  .object({
    defaultLocale: LocaleIdentifierSchema,
    values: z.record(LocaleIdentifierSchema, z.string().trim().min(1)),
  })
  .strict()
  .superRefine((value, context) => {
    if (
      !Object.prototype.hasOwnProperty.call(value.values, value.defaultLocale)
    ) {
      context.addIssue({
        code: "custom",
        path: ["values", value.defaultLocale],
        message: "I18nText values must contain the default locale.",
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
      ["tenantRef", value.tenantRef, "tenant"],
      ["dataSpaceRef", value.dataSpaceRef, "data-space"],
      ["teamRef", value.teamRef, "team"],
    ] as const;
    expectedKinds.forEach(([field, reference, expectedKind]) => {
      if (reference && reference.kind !== expectedKind) {
        context.addIssue({
          code: "custom",
          path: [field, "kind"],
          message: `${field} must reference ${expectedKind}.`,
        });
      }
    });
  });
export const ReferenceVisibilitySchema = z.enum(["tenant", "global", "public"]);
const StableRefShape = {
  kind: ContractIdentifierSchema,
  id: ContractIdentifierSchema,
  ownerRepo: ContractIdentifierSchema,
  visibility: ReferenceVisibilitySchema,
  tenantScope: TenantScopeSchema.optional(),
};
const validateReferenceScope = (
  value: {
    visibility: z.infer<typeof ReferenceVisibilitySchema>;
    tenantScope?: z.infer<typeof TenantScopeSchema>;
  },
  context: z.RefinementCtx,
) => {
  if (value.visibility === "tenant" && !value.tenantScope) {
    context.addIssue({
      code: "custom",
      path: ["tenantScope"],
      message: "Tenant references require an explicit tenant scope.",
    });
  }
  if (value.visibility !== "tenant" && value.tenantScope) {
    context.addIssue({
      code: "custom",
      path: ["tenantScope"],
      message: "Global and public references cannot carry a tenant scope.",
    });
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
const scopedIdentityKey = (
  reference: z.infer<typeof ScopedIdentityRefSchema>,
): string => `${reference.kind}:${reference.id}:${reference.ownerRepo}`;
const tenantScopeKey = (scope: z.infer<typeof TenantScopeSchema>): string =>
  `${scopedIdentityKey(scope.tenantRef)}:${scopedIdentityKey(scope.dataSpaceRef)}:${scope.teamRef ? scopedIdentityKey(scope.teamRef) : ""}`;
const stableRefIdentity = (
  reference: z.infer<typeof StableRefSchema>,
): string =>
  `${reference.visibility}:${reference.tenantScope ? tenantScopeKey(reference.tenantScope) : ""}:${reference.kind}:${reference.id}:${reference.ownerRepo}`;
const validateTenantCompatibleReference = (
  reference: z.infer<typeof StableRefSchema>,
  tenantScope: z.infer<typeof TenantScopeSchema>,
  path: (string | number)[],
  context: z.RefinementCtx,
) => {
  if (
    reference.visibility === "tenant" &&
    reference.tenantScope &&
    tenantScopeKey(reference.tenantScope) !== tenantScopeKey(tenantScope)
  ) {
    context.addIssue({
      code: "custom",
      path: [...path, "tenantScope"],
      message: "Reference belongs to another tenant scope.",
    });
  }
};
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
      context.addIssue({
        code: "custom",
        path: ["canonicalRef", "kind"],
        message: "Alias and canonical references must have the same kind.",
      });
    }
    if (value.validUntil && value.validUntil <= value.validFrom) {
      context.addIssue({
        code: "custom",
        path: ["validUntil"],
        message: "Alias validUntil must be later than validFrom.",
      });
    }
  });
export const StableRefAliasMapSchema = z
  .object({
    contract: z.literal("StableRefAliasMap"),
    schemaVersion: z.literal(DECLARATIVE_CONTROL_SCHEMA_VERSION),
    tenantScope: TenantScopeSchema,
    aliases: z.array(StableRefAliasSchema),
    contentHash: Sha256Schema,
  })
  .strict()
  .superRefine((value, context) => {
    const duplicate = uniqueArray(value.aliases, (entry) =>
      stableRefIdentity(entry.aliasRef),
    );
    if (duplicate)
      context.addIssue({
        code: "custom",
        path: ["aliases"],
        message: `Duplicate alias reference: ${duplicate}`,
      });
  });
export const DeclarativeLifecycleSchema = z.enum([
  "active",
  "deprecated",
  "retired",
]);
export const ProductSurfaceSchema = z.enum(["studio", "kernel"]);
export const DeclarativeShellHeaderChromeSchema = z.discriminatedUnion(
  "enabled",
  [
    z.object({ enabled: z.literal(false) }).strict(),
    z
      .object({
        enabled: z.literal(true),
        navigationPlacement: z.enum([
          "studio.headbar.primary",
          "kernel.primary",
        ]),
      })
      .strict(),
  ],
);
export const DeclarativeShellSurfaceChromeSchema = z
  .object({
    surface: ProductSurfaceSchema,
    header: DeclarativeShellHeaderChromeSchema,
  })
  .strict()
  .superRefine((value, context) => {
    if (!value.header.enabled) return;
    const expectedPlacement =
      value.surface === "studio" ? "studio.headbar.primary" : "kernel.primary";
    if (value.header.navigationPlacement !== expectedPlacement) {
      context.addIssue({
        code: "custom",
        path: ["header", "navigationPlacement"],
        message: `The ${value.surface} shell header must use its governed primary Navigation placement.`,
      });
    }
  });
export const DeclarativeRuntimeShellDescriptorSchema = z
  .object({
    shellRevisionRef: RevisionRefSchema,
    header: DeclarativeShellHeaderChromeSchema,
  })
  .strict()
  .superRefine((value, context) => {
    if (value.shellRevisionRef.kind !== "shell") {
      context.addIssue({
        code: "custom",
        path: ["shellRevisionRef", "kind"],
        message: "Runtime shell descriptors require an exact Shell revision.",
      });
    }
  });
const GroupRefSchema = StableRefSchema.superRefine((value, context) => {
  if (value.kind !== "group")
    context.addIssue({
      code: "custom",
      path: ["kind"],
      message: "Access group references must use kind group.",
    });
});
const AccessConditionRefSchema = RevisionRefSchema.superRefine(
  (value, context) => {
    if (value.kind !== "access-condition") {
      context.addIssue({
        code: "custom",
        path: ["kind"],
        message: "Access condition references must use kind access-condition.",
      });
    }
  },
);
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
    const checks: Array<
      [string, readonly unknown[], (candidate: unknown) => string]
    > = [
      [
        "groupAllOf",
        value.groupAllOf,
        (candidate) =>
          stableRefIdentity(candidate as z.infer<typeof StableRefSchema>),
      ],
      [
        "groupAnyOf",
        value.groupAnyOf,
        (candidate) =>
          stableRefIdentity(candidate as z.infer<typeof StableRefSchema>),
      ],
      ["permissionAllOf", value.permissionAllOf, String],
      ["permissionAnyOf", value.permissionAnyOf, String],
      [
        "conditionAllOf",
        value.conditionAllOf,
        (candidate) =>
          `${stableRefIdentity(candidate as z.infer<typeof StableRefSchema>)}@${(candidate as z.infer<typeof RevisionRefSchema>).revision}`,
      ],
    ];
    checks.forEach(([field, values, identity]) => {
      if (uniqueArray(values, identity))
        context.addIssue({
          code: "custom",
          path: [field],
          message: `${field} entries must be unique.`,
        });
    });
  });
/**
 * A finite set of permission conjunctions. An identity is authorized when it
 * satisfies every permission in at least one alternative. This is deliberately
 * separate from AccessPolicy: it models a versioned rollout compatibility
 * bridge such as `new-permission OR (legacy-a AND legacy-b)` without turning
 * individual legacy permissions into broad aliases.
 */
export const PermissionAlternativePolicySchema = z
  .object({
    contract: z.literal("PermissionAlternativePolicy"),
    schemaVersion: z.literal(DECLARATIVE_CONTROL_SCHEMA_VERSION),
    policyId: ContractIdentifierSchema,
    alternatives: z.array(z.array(ContractIdentifierSchema).min(1)).min(1),
    retirementGate: z
      .object({
        capability: ContractIdentifierSchema,
        notBefore: IsoDateTimeSchema.optional(),
      })
      .strict()
      .optional(),
  })
  .strict()
  .superRefine((value, context) => {
    const canonical = value.alternatives.map((set) => [...new Set(set)].sort());
    canonical.forEach((set, index) => {
      if (set.length !== value.alternatives[index].length) {
        context.addIssue({
          code: "custom",
          path: ["alternatives", index],
          message:
            "A permission alternative cannot contain duplicate permissions.",
        });
      }
    });
    const identities = canonical.map((set) => set.join("\0"));
    if (new Set(identities).size !== identities.length) {
      context.addIssue({
        code: "custom",
        path: ["alternatives"],
        message: "Permission alternatives must be unique.",
      });
    }
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
  .regex(/^\/(?!\/)/, "Expected an application-relative path.")
  .superRefine((value, context) => {
    if (value.includes("?") || value.includes("#") || value.includes("\\")) {
      context.addIssue({
        code: "custom",
        message:
          "Route paths cannot contain query strings, fragments, or backslashes.",
      });
    }
    if (
      value.split("/").some((segment) => segment === "." || segment === "..")
    ) {
      context.addIssue({
        code: "custom",
        message: "Route paths cannot contain traversal segments.",
      });
    }
    if (/^[a-z][a-z0-9+.-]*:/i.test(value) || value.includes("://")) {
      context.addIssue({
        code: "custom",
        message: "Route paths cannot contain a scheme or host.",
      });
    }
  });
export const RouteSpaceParameterSchema = z
  .object({
    name: ContractIdentifierSchema,
    type: z.enum(["identifier", "integer", "slug", "uuid"]),
    required: z.boolean(),
  })
  .strict();
export const RouteSpaceSchema = z
  .object({
    contract: z.literal("RouteSpace"),
    schemaVersion: z.literal(DECLARATIVE_CONTROL_SCHEMA_VERSION),
    routeSpaceId: ContractIdentifierSchema,
    supportedSurface: ProductSurfaceSchema,
    basePath: RoutePathTemplateSchema,
    caseSensitive: z.boolean(),
    trailingSlash: z.enum(["preserve", "remove", "require"]),
    reservedPaths: z.array(RoutePathTemplateSchema),
    parameters: z.array(RouteSpaceParameterSchema),
  })
  .strict()
  .superRefine((value, context) => {
    if (uniqueArray(value.parameters, (parameter) => parameter.name)) {
      context.addIssue({
        code: "custom",
        path: ["parameters"],
        message: "RouteSpace parameter names must be unique.",
      });
    }
    if (uniqueArray(value.reservedPaths, (path) => path)) {
      context.addIssue({
        code: "custom",
        path: ["reservedPaths"],
        message: "RouteSpace reserved paths must be unique.",
      });
    }
  });
const RouteClaimBaseSchema = z
  .object({
    kind: z.enum(["canonical", "alias", "redirect"]),
    routeSpaceRevisionRef: RevisionRefSchema,
    pathTemplate: RoutePathTemplateSchema,
    redirectTargetRef: StableRefSchema.optional(),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.routeSpaceRevisionRef.kind !== "route-space") {
      context.addIssue({
        code: "custom",
        path: ["routeSpaceRevisionRef", "kind"],
        message: "Route claims must reference a route-space revision.",
      });
    }
    if (value.kind === "redirect" && !value.redirectTargetRef) {
      context.addIssue({
        code: "custom",
        path: ["redirectTargetRef"],
        message: "Redirect claims require a governed target reference.",
      });
    }
    if (value.kind !== "redirect" && value.redirectTargetRef) {
      context.addIssue({
        code: "custom",
        path: ["redirectTargetRef"],
        message: "Only redirect claims may declare redirectTargetRef.",
      });
    }
  });
/**
 * Read compatibility for schemaVersion 1 Page and Workbench records written
 * before route claims carried their owning product surface. New declarations
 * must use RouteClaimSchema; compilers materialize this legacy form only from
 * the exact pinned RouteSpace surface.
 */
export const LegacyRouteClaimSchema = RouteClaimBaseSchema;
export const RouteClaimSchema = RouteClaimBaseSchema.safeExtend({
  surface: ProductSurfaceSchema,
}).strict();
const LegacyCompiledRouteMatcherSchema = z
  .object({
    caseSensitive: z.boolean(),
    trailingSlash: z.enum(["preserve", "remove", "require"]),
    parameters: z.array(RouteSpaceParameterSchema),
  })
  .strict();
export const CompiledRouteMatcherSchema =
  LegacyCompiledRouteMatcherSchema.safeExtend({
    surface: ProductSurfaceSchema,
  }).strict();
export const CompiledRouteClaimSchema = RouteClaimSchema.safeExtend({
  normalizedPath: RoutePathTemplateSchema,
  matcher: CompiledRouteMatcherSchema,
})
  .strict()
  .superRefine((value, context) => {
    if (value.matcher.surface !== value.surface) {
      context.addIssue({
        code: "custom",
        path: ["matcher", "surface"],
        message: "A compiled route matcher must match its claim surface.",
      });
    }
  });
const LegacyCompiledRouteClaimSchema = LegacyRouteClaimSchema.safeExtend({
  normalizedPath: RoutePathTemplateSchema,
  matcher: LegacyCompiledRouteMatcherSchema,
}).strict();
const validateReleaseRouteSurface = (
  target: {
    surface: z.infer<typeof ProductSurfaceSchema>;
    routeClaim:
      | z.infer<typeof CompiledRouteClaimSchema>
      | z.infer<typeof LegacyCompiledRouteClaimSchema>;
  },
  context: z.RefinementCtx,
) => {
  const claimSurface =
    "surface" in target.routeClaim ? target.routeClaim.surface : undefined;
  const matcherSurface =
    "surface" in target.routeClaim.matcher
      ? target.routeClaim.matcher.surface
      : undefined;
  if (claimSurface === undefined && matcherSurface === undefined) return;
  if (claimSurface === target.surface && matcherSurface === target.surface)
    return;
  context.addIssue({
    code: "custom",
    path: ["target", "routeClaim"],
    message:
      "A compiled Release route claim must either be fully legacy or bind both claim and matcher to the target surface.",
  });
};
export const ReleaseOperationSchema = z.enum([
  "activate",
  "deactivate",
  "rollback",
]);
export const ReleaseDependencyRoleSchema = z.enum([
  "route-space",
  "shell",
  "page",
  "page-release",
  "workbench",
  "workbench-release",
  "navigation",
  "navigation-release",
  "menu-action",
  "application-menu-catalog",
  "capability",
  "provider",
  "ontology-definition",
  "projection-spec",
  "query-definition",
  "view",
  "projection",
  "action",
  "token",
  "schema",
  "compiler",
  "workflow",
  "agent",
  "built-in-application",
  "design",
  "layout-policy",
  "performance-budget",
  "observation-policy",
]);
const DependencyKindByRole: Readonly<
  Record<z.infer<typeof ReleaseDependencyRoleSchema>, string>
> = {
  "route-space": "route-space",
  shell: "shell",
  page: "page",
  "page-release": "page-release",
  workbench: "workbench",
  "workbench-release": "workbench-release",
  navigation: "navigation",
  "navigation-release": "navigation-release",
  "menu-action": "menu-action",
  "application-menu-catalog": "application-menu-catalog",
  capability: "capability",
  provider: "view-provider",
  "ontology-definition": "ontology-definition",
  "projection-spec": "projection-spec",
  "query-definition": "domain-query-definition",
  view: "view",
  projection: "projection",
  action: "domain-command",
  token: "design-token",
  schema: "schema",
  compiler: "compiler",
  workflow: "workflow",
  agent: "agent",
  "built-in-application": "built-in-application",
  design: "design",
  "layout-policy": "layout-policy",
  "performance-budget": "performance-budget",
  "observation-policy": "observation-policy",
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
        code: "custom",
        path: ["revisionRef", "kind"],
        message: `Dependency role ${value.role} requires reference kind ${expectedKind}.`,
      });
    }
  });
export const ReleaseValidationSchema = z
  .object({
    result: z.enum(["pass", "fail"]),
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
    reason: z.string().trim().min(1).max(4096),
    idempotencyKey: ContractIdentifierSchema,
    occurredAt: IsoDateTimeSchema,
    evidenceRefs: z.array(RevisionRefSchema).min(1),
  })
  .strict()
  .superRefine((value, context) => {
    const expectedKinds: Array<
      [string, z.infer<typeof StableRefSchema>, string]
    > = [
      ["publicationPlanRef", value.publicationPlanRef, "publication-plan"],
      [
        "approvalPolicyRevisionRef",
        value.approvalPolicyRevisionRef,
        "approval-policy",
      ],
      [
        "approvalDecisionRevisionRef",
        value.approvalDecisionRevisionRef,
        "approval-decision",
      ],
      ["actorRef", value.actorRef, "actor"],
    ];
    expectedKinds.forEach(([field, reference, expectedKind]) => {
      if (reference.kind !== expectedKind) {
        context.addIssue({
          code: "custom",
          path: [field, "kind"],
          message: `${field} must reference ${expectedKind}.`,
        });
      }
    });
    value.evidenceRefs.forEach((reference, index) => {
      if (reference.kind !== "evidence")
        context.addIssue({
          code: "custom",
          path: ["evidenceRefs", index, "kind"],
          message: "Release evidenceRefs must reference evidence revisions.",
        });
    });
  });
export const PublicationPlanOperationSchema = z
  .object({
    releaseKind: z.enum([
      "page-release",
      "workbench-release",
      "navigation-release",
    ]),
    releaseSlotId: ContractIdentifierSchema,
    releaseRevisionRef: RevisionRefSchema,
    expectedHeadRevisionRef: RevisionRefSchema.nullable(),
  })
  .strict()
  .superRefine((value, context) => {
    if (
      value.releaseRevisionRef.kind !== value.releaseKind ||
      value.releaseRevisionRef.id !== value.releaseSlotId
    ) {
      context.addIssue({
        code: "custom",
        path: ["releaseRevisionRef"],
        message:
          "Publication Plan operation must pin the exact release slot revision.",
      });
    }
    if (
      value.expectedHeadRevisionRef &&
      (value.expectedHeadRevisionRef.kind !== value.releaseKind ||
        value.expectedHeadRevisionRef.id !== value.releaseSlotId)
    ) {
      context.addIssue({
        code: "custom",
        path: ["expectedHeadRevisionRef"],
        message: "Expected head must identify the same release slot.",
      });
    }
  });
export const PublicationPlanSchema = z
  .object({
    contract: z.literal("PublicationPlan"),
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
    if (value.environmentRef.kind !== "environment")
      context.addIssue({
        code: "custom",
        path: ["environmentRef", "kind"],
        message: "Publication Plan requires an environment reference.",
      });
    validateTenantCompatibleReference(
      value.environmentRef,
      value.tenantScope,
      ["environmentRef"],
      context,
    );
    const governedRefs: Array<
      [string, z.infer<typeof StableRefSchema>, string]
    > = [
      [
        "approvalPolicyRevisionRef",
        value.approvalPolicyRevisionRef,
        "approval-policy",
      ],
      [
        "approvalDecisionRevisionRef",
        value.approvalDecisionRevisionRef,
        "approval-decision",
      ],
      ["actorRef", value.actorRef, "actor"],
    ];
    governedRefs.forEach(([field, reference, expectedKind]) => {
      if (reference.kind !== expectedKind)
        context.addIssue({
          code: "custom",
          path: [field, "kind"],
          message: `${field} must reference ${expectedKind}.`,
        });
      validateTenantCompatibleReference(
        reference,
        value.tenantScope,
        [field],
        context,
      );
    });
    value.operations.forEach((operation, index) => {
      [operation.releaseRevisionRef, operation.expectedHeadRevisionRef].forEach(
        (reference, referenceIndex) => {
          if (
            reference?.tenantScope &&
            tenantScopeKey(reference.tenantScope) !==
              tenantScopeKey(value.tenantScope)
          ) {
            const field =
              referenceIndex === 0
                ? "releaseRevisionRef"
                : "expectedHeadRevisionRef";
            context.addIssue({
              code: "custom",
              path: ["operations", index, field, "tenantScope"],
              message:
                "Publication Plan operation belongs to another tenant scope.",
            });
          }
        },
      );
    });
    value.evidenceRefs.forEach((reference, index) => {
      if (reference.kind !== "evidence")
        context.addIssue({
          code: "custom",
          path: ["evidenceRefs", index, "kind"],
          message:
            "Publication Plan evidenceRefs must reference evidence revisions.",
        });
      validateTenantCompatibleReference(
        reference,
        value.tenantScope,
        ["evidenceRefs", index],
        context,
      );
    });
    if (
      uniqueArray(
        value.operations,
        (operation) => `${operation.releaseKind}:${operation.releaseSlotId}`,
      )
    ) {
      context.addIssue({
        code: "custom",
        path: ["operations"],
        message: "Publication Plan release slots must be unique.",
      });
    }
  });
const IdentitySchema = z
  .object({
    name: I18nTextSchema,
    description: I18nTextSchema.optional(),
    tags: z.array(ContractIdentifierSchema).default([]),
  })
  .strict();
export const WorkbenchIdentitySchema = IdentitySchema.extend({
  iconRef: StableRefSchema.optional(),
}).strict();
export const LegacySlotRestorationSchema = z
  .object({
    legacyAdapterRevisionRef: RevisionRefSchema,
    sourceRevisionRef: RevisionRefSchema,
    inspectedSourceContentHash: Sha256Schema,
  })
  .strict()
  .superRefine((value, context) => {
    if (
      value.sourceRevisionRef.contentHash !== value.inspectedSourceContentHash
    ) {
      context.addIssue({
        code: "custom",
        path: ["inspectedSourceContentHash"],
        message:
          "Legacy restoration must pin the exact inspected source revision hash.",
      });
    }
  });
/**
 * Exact, inspect-produced authority for taking over one predeclared legacy
 * route. It is not a general reserved-route bypass: compiler validation binds
 * it to one canonical claim, one target resource and the exact inspected
 * source/adaptor revisions.
 */
export const LegacyRouteTakeoverAuthorizationSchema = z
  .object({
    contract: z.literal("LegacyRouteTakeoverAuthorization"),
    schemaVersion: z.literal(DECLARATIVE_CONTROL_SCHEMA_VERSION),
    routeSpaceRevisionRef: RevisionRefSchema,
    normalizedPath: RoutePathTemplateSchema,
    legacyAdapterRevisionRef: RevisionRefSchema,
    sourceRevisionRef: RevisionRefSchema,
    inspectedSourceContentHash: Sha256Schema,
    targetResourceRef: StableRefSchema,
    workbenchCatalogDefaults: z
      .object({ order: z.number().int(), isDefaultCandidate: z.boolean() })
      .strict()
      .optional(),
    contentHash: Sha256Schema,
  })
  .strict()
  .superRefine((value, context) => {
    if (value.routeSpaceRevisionRef.kind !== "route-space") {
      context.addIssue({
        code: "custom",
        path: ["routeSpaceRevisionRef", "kind"],
        message: "A route takeover must pin a RouteSpace revision.",
      });
    }
    if (value.legacyAdapterRevisionRef.kind !== "legacy-route-adapter") {
      context.addIssue({
        code: "custom",
        path: ["legacyAdapterRevisionRef", "kind"],
        message: "A route takeover must pin a legacy-route-adapter revision.",
      });
    }
    if (!["page", "workbench"].includes(value.targetResourceRef.kind)) {
      context.addIssue({
        code: "custom",
        path: ["targetResourceRef", "kind"],
        message: "A route takeover target must be a Page or Workbench.",
      });
    }
    if (
      value.sourceRevisionRef.contentHash !== value.inspectedSourceContentHash
    ) {
      context.addIssue({
        code: "custom",
        path: ["inspectedSourceContentHash"],
        message:
          "A route takeover must pin the exact inspected legacy source hash.",
      });
    }
    if (
      value.targetResourceRef.kind === "workbench" &&
      !value.workbenchCatalogDefaults
    ) {
      context.addIssue({
        code: "custom",
        path: ["workbenchCatalogDefaults"],
        message:
          "A Workbench takeover must preserve exact legacy catalog order and default semantics.",
      });
    }
    if (
      value.targetResourceRef.kind === "page" &&
      value.workbenchCatalogDefaults
    ) {
      context.addIssue({
        code: "custom",
        path: ["workbenchCatalogDefaults"],
        message:
          "Page takeover provenance cannot carry Workbench catalog defaults.",
      });
    }
  });
/** Authoring-only route evidence. Runtime compilation deliberately strips the takeover proof. */
export const DeclarativeRouteClaimSchema = RouteClaimSchema.safeExtend({
  legacyRouteTakeoverAuthorization:
    LegacyRouteTakeoverAuthorizationSchema.optional(),
}).strict();
const LegacyDeclarativeRouteClaimSchema = LegacyRouteClaimSchema.safeExtend({
  legacyRouteTakeoverAuthorization:
    LegacyRouteTakeoverAuthorizationSchema.optional(),
}).strict();
const validateDeclaredRouteSurfaces = (
  supportedSurfaces: readonly z.infer<typeof ProductSurfaceSchema>[],
  routeClaims: readonly z.infer<
    | typeof LegacyDeclarativeRouteClaimSchema
    | typeof DeclarativeRouteClaimSchema
  >[],
  context: z.RefinementCtx,
) => {
  if (uniqueArray(supportedSurfaces, (surface) => surface)) {
    context.addIssue({
      code: "custom",
      path: ["supportedSurfaces"],
      message: "Supported surfaces must be unique.",
    });
  }
  const explicitClaims = routeClaims.filter(
    (claim): claim is z.infer<typeof DeclarativeRouteClaimSchema> =>
      "surface" in claim,
  );
  if (explicitClaims.length > 0 && explicitClaims.length < routeClaims.length) {
    context.addIssue({
      code: "custom",
      path: ["routeClaims"],
      message:
        "Route claims must either all declare surface or all omit it for legacy compatibility.",
    });
    return;
  }
  routeClaims.forEach((claim, index) => {
    if ("surface" in claim && !supportedSurfaces.includes(claim.surface)) {
      context.addIssue({
        code: "custom",
        path: ["routeClaims", index, "surface"],
        message: "Route claim surface must be declared by supportedSurfaces.",
      });
    }
  });
  if (explicitClaims.length !== routeClaims.length) return;
  supportedSurfaces.forEach((surface) => {
    const canonicalCount = explicitClaims.filter(
      (claim) => claim.surface === surface && claim.kind === "canonical",
    ).length;
    if (canonicalCount !== 1) {
      context.addIssue({
        code: "custom",
        path: ["routeClaims"],
        message: `Surface ${surface} requires exactly one canonical route claim.`,
      });
    }
  });
};
const ReleaseBaseShape = {
  schemaVersion: z.literal(DECLARATIVE_CONTROL_SCHEMA_VERSION),
  releaseSlotId: ContractIdentifierSchema,
  tenantScope: TenantScopeSchema,
  operation: ReleaseOperationSchema,
  legacyRestoration: LegacySlotRestorationSchema.optional(),
  dependencySnapshot: z.array(ReleaseDependencySchema),
  evidence: ReleaseEvidenceSchema,
};
const validateLegacyRestoration = (
  value: {
    operation: z.infer<typeof ReleaseOperationSchema>;
    legacyRestoration?: z.infer<typeof LegacySlotRestorationSchema>;
  },
  expectedAdapterKind: string,
  context: z.RefinementCtx,
) => {
  if (value.operation === "activate" && value.legacyRestoration) {
    context.addIssue({
      code: "custom",
      path: ["legacyRestoration"],
      message:
        "An active declarative Release cannot also restore a legacy adapter.",
    });
  }
  if (
    value.legacyRestoration?.legacyAdapterRevisionRef.kind !== undefined &&
    value.legacyRestoration.legacyAdapterRevisionRef.kind !==
      expectedAdapterKind
  ) {
    context.addIssue({
      code: "custom",
      path: ["legacyRestoration", "legacyAdapterRevisionRef", "kind"],
      message: `Legacy restoration requires adapter kind ${expectedAdapterKind}.`,
    });
  }
};
const validateDependencySnapshot = (
  snapshot: readonly z.infer<typeof ReleaseDependencySchema>[],
  context: z.RefinementCtx,
) => {
  const duplicate = uniqueArray(
    snapshot,
    (dependency) =>
      `${dependency.role}:${stableRefIdentity(dependency.revisionRef)}@${dependency.revisionRef.revision}`,
  );
  if (duplicate)
    context.addIssue({
      code: "custom",
      path: ["dependencySnapshot"],
      message: `Duplicate dependency: ${duplicate}`,
    });
};
const validateReleaseGovernanceScope = (
  value: {
    releaseSlotId: string;
    tenantScope: z.infer<typeof TenantScopeSchema>;
    evidence: z.infer<typeof ReleaseEvidenceSchema>;
    legacyRestoration?: z.infer<typeof LegacySlotRestorationSchema>;
  },
  expectedKind: "page-release" | "workbench-release" | "navigation-release",
  context: z.RefinementCtx,
) => {
  const expectedHead = value.evidence.expectedHeadRevisionRef;
  if (
    expectedHead &&
    (expectedHead.kind !== expectedKind ||
      expectedHead.id !== value.releaseSlotId)
  ) {
    context.addIssue({
      code: "custom",
      path: ["evidence", "expectedHeadRevisionRef"],
      message: "Expected head must identify the same release slot.",
    });
  }
  if (
    expectedHead?.tenantScope &&
    tenantScopeKey(expectedHead.tenantScope) !==
      tenantScopeKey(value.tenantScope)
  ) {
    context.addIssue({
      code: "custom",
      path: ["evidence", "expectedHeadRevisionRef", "tenantScope"],
      message: "Expected head belongs to another tenant scope.",
    });
  }
  const governedEvidenceRefs: ReadonlyArray<
    readonly [readonly (string | number)[], z.infer<typeof StableRefSchema>]
  > = [
    [["evidence", "publicationPlanRef"], value.evidence.publicationPlanRef],
    [
      ["evidence", "approvalPolicyRevisionRef"],
      value.evidence.approvalPolicyRevisionRef,
    ],
    [
      ["evidence", "approvalDecisionRevisionRef"],
      value.evidence.approvalDecisionRevisionRef,
    ],
    [["evidence", "actorRef"], value.evidence.actorRef],
    ...value.evidence.validation.diagnosticRefs.map(
      (reference, index) =>
        [
          ["evidence", "validation", "diagnosticRefs", index],
          reference,
        ] as const,
    ),
    ...value.evidence.evidenceRefs.map(
      (reference, index) =>
        [["evidence", "evidenceRefs", index], reference] as const,
    ),
    ...(expectedHead
      ? [[["evidence", "expectedHeadRevisionRef"], expectedHead] as const]
      : []),
    ...(value.legacyRestoration
      ? [
          [
            ["legacyRestoration", "legacyAdapterRevisionRef"],
            value.legacyRestoration.legacyAdapterRevisionRef,
          ] as const,
          [
            ["legacyRestoration", "sourceRevisionRef"],
            value.legacyRestoration.sourceRevisionRef,
          ] as const,
        ]
      : []),
  ];
  governedEvidenceRefs.forEach(([path, reference]) =>
    validateTenantCompatibleReference(
      reference,
      value.tenantScope,
      [...path],
      context,
    ),
  );
};
export const BindingSourceSchema = z.discriminatedUnion("kind", [
  z
    .object({
      kind: z.literal("scope-field"),
      path: z
        .string()
        .trim()
        .min(1)
        .max(4096)
        .regex(/^[A-Za-z0-9_.-]+$/)
        .refine(
          (path) =>
            path.split(".").length <= 16 &&
            path
              .split(".")
              .every(
                (part) =>
                  part.length > 0 &&
                  !["__proto__", "prototype", "constructor"].includes(part),
              ),
          "Scope paths require safe own members.",
        ),
    })
    .strict(),
  z
    .object({
      kind: z.literal("binding-field"),
      bindingId: ContractIdentifierSchema,
      path: z
        .string()
        .trim()
        .regex(/^[A-Za-z0-9_.-]+$/),
    })
    .strict(),
  z
    .object({
      kind: z.literal("constant"),
      value: z.union([z.string(), z.number().finite(), z.boolean(), z.null()]),
    })
    .strict(),
  z
    .object({
      kind: z.literal("route-parameter"),
      name: ContractIdentifierSchema,
    })
    .strict(),
  z
    .object({
      kind: z.literal("query-parameter"),
      name: ContractIdentifierSchema,
    })
    .strict(),
  z
    .object({
      kind: z.literal("identity"),
      name: z.enum(["tenantId", "teamId", "userId"]),
    })

    .strict(),
  z
    .object({
      kind: z.literal("intent-field"),
      path: z
        .string()
        .trim()
        .regex(/^[A-Za-z0-9_.-]+$/),
    })
    .strict(),
  z
    .object({
      kind: z.literal("page-state"),
      stateId: ContractIdentifierSchema,
    })
    .strict(),
]);
const ExpressionBindingSourceSchema = z
  .object({ kind: z.literal("expression"), expression: PageExpressionSchema })
  .strict()
  .superRefine((value, context) => {
    if (
      collectPageExpressionReads(value.expression).some(
        (read) => read.root === "actions",
      )
    )
      context.addIssue({
        code: "custom",
        path: ["expression"],
        message:
          "Action runtime state is presentation-only and cannot influence an input or state transition.",
      });
  });
const FileFieldBindingSourceSchema = z
  .object({
    kind: z.literal("file-field"),
    fileInputId: ContractIdentifierSchema,
    path: z.enum(["fileName", "content", "canonicalUri"]),
  })
  .strict();
const ActionFileInputSchema = z
  .object({
    inputId: ContractIdentifierSchema,
    source: z.discriminatedUnion("kind", [
      z
        .object({
          kind: z.literal("page-state"),
          stateId: ContractIdentifierSchema,
        })
        .strict(),
      z
        .object({
          kind: z.literal("intent-field"),
          path: z
            .string()
            .trim()
            .regex(/^[A-Za-z0-9_.-]+$/),
        })
        .strict(),
    ]),
    maxBytes: z.number().int().min(1).max(5368709120),
    upload: z.object({ purpose: FilePurposeSchema }).strict().optional(),
    accept: z.string().min(1).max(256).optional(),
  })
  .strict()
  .superRefine((value, context) => {
    if (!value.upload && value.maxBytes > 1048576)
      context.addIssue({
        code: "custom",
        path: ["maxBytes"],
        message: "Inline text files are limited to one MiB.",
      });
  });
const ActionInputBindingSourceSchema = z.discriminatedUnion("kind", [
  ...BindingSourceSchema.options,
  ExpressionBindingSourceSchema,
  FileFieldBindingSourceSchema,
]);
const InteractionBindingSourceSchema = z.discriminatedUnion("kind", [
  ExpressionBindingSourceSchema,
  z
    .object({
      kind: z.literal("constant"),
      value: z.union([z.string(), z.number().finite(), z.boolean(), z.null()]),
    })
    .strict(),
  z
    .object({
      kind: z.literal("intent-field"),
      path: z
        .string()
        .trim()
        .regex(/^[A-Za-z0-9_.-]+$/),
    })
    .strict(),
  z
    .object({
      kind: z.literal("result-field"),
      path: z
        .string()
        .trim()
        .regex(/^[A-Za-z0-9_.-]+$/),
    })
    .strict(),
  z
    .object({
      kind: z.literal("page-state"),
      stateId: ContractIdentifierSchema,
    })
    .strict(),
]);
const PageStateComparableLiteralSchema = z.union([
  z.string(),
  z.number().finite(),
  z.boolean(),
  z.null(),
]);
export const PageStateConditionSchema = z.discriminatedUnion("predicate", [
  z
    .object({
      stateId: ContractIdentifierSchema,
      predicate: z.literal("equals"),
      value: PageStateComparableLiteralSchema,
    })
    .strict(),
  z
    .object({
      stateId: ContractIdentifierSchema,
      predicate: z.literal("not-equals"),
      value: PageStateComparableLiteralSchema,
    })
    .strict(),
  z
    .object({
      stateId: ContractIdentifierSchema,
      predicate: z.literal("truthy"),
    })
    .strict(),
]);
export type PageStateCondition = z.infer<typeof PageStateConditionSchema>;
export type PageStateActivation = {
  operator: "all" | "any";
  conditions: Array<PageStateCondition | PageStateActivation>;
};
/**
 * A recursive boolean expression over governed Page state. Keeping leaf
 * conditions inside the original `conditions` array preserves the v1 flat
 * declaration while allowing groups to be nested without a parallel DSL.
 */
export const PageStateActivationSchema: z.ZodType<PageStateActivation> = z.lazy(
  () =>
    z
      .object({
        operator: z.enum(["all", "any"]),
        conditions: z
          .array(z.union([PageStateConditionSchema, PageStateActivationSchema]))
          .min(1),
      })
      .strict(),
);
const forEachPageStateCondition = (
  activation: PageStateActivation,
  visit: (condition: PageStateCondition, path: Array<string | number>) => void,
  path: Array<string | number> = [],
): void => {
  activation.conditions.forEach((candidate, index) => {
    const candidatePath = [...path, "conditions", index];
    if ("operator" in candidate) {
      forEachPageStateCondition(candidate, visit, candidatePath);
      return;
    }
    visit(candidate, candidatePath);
  });
};
const PageRouteValueSourceSchema = z.discriminatedUnion("kind", [
  z
    .object({
      kind: z.literal("route-parameter"),
      name: ContractIdentifierSchema,
    })
    .strict(),
  z
    .object({
      kind: z.literal("constant"),
      value: z.union([z.string(), z.number().finite(), z.boolean()]),
    })
    .strict(),
  z
    .object({
      kind: z.literal("page-state"),
      stateId: ContractIdentifierSchema,
    })
    .strict(),
]);
/**
 * Declares an ordered, state-driven route transition owned by one exact Page
 * revision. The compiler resolves targetRef to one active governed Release;
 * raw URLs and application-specific route switches are deliberately excluded.
 */
export const PageEntryTransitionSchema = z
  .object({
    browsingContext: z.enum(["same", "new"]).optional(),
    gestureSource: z
      .object({
        capabilityInstanceId: ContractIdentifierSchema,
        port: ContractIdentifierSchema,
      })
      .strict()
      .optional(),
    transitionId: ContractIdentifierSchema,
    activation: PageStateActivationSchema,
    targetRef: StableRefSchema,
    pathParameters: z.record(
      ContractIdentifierSchema,
      PageRouteValueSourceSchema,
    ),
    query: z
      .object({
        preserve: z.boolean(),
        remove: z.array(ContractIdentifierSchema),
        set: z.record(ContractIdentifierSchema, PageRouteValueSourceSchema),
      })
      .strict(),
  })
  .strict()
  .superRefine((value, context) => {
    if ((value.browsingContext === "new") !== Boolean(value.gestureSource)) {
      context.addIssue({
        code: "custom",
        path: ["gestureSource"],
        message:
          "New-context entry transitions require an exact gesture source; same-context transitions must omit it.",
      });
    }
    if (!["page", "workbench"].includes(value.targetRef.kind)) {
      context.addIssue({
        code: "custom",
        path: ["targetRef", "kind"],
        message:
          "Page entry transitions must reference a governed Page or Workbench.",
      });
    }
    if (new Set(value.query.remove).size !== value.query.remove.length) {
      context.addIssue({
        code: "custom",
        path: ["query", "remove"],
        message: "Removed query parameter names must be unique.",
      });
    }
  });
export const ResolvedPageEntryTransitionSchema =
  PageEntryTransitionSchema.safeExtend({
    targetRevisionRef: RevisionRefSchema,
    targetReleaseRevisionRef: RevisionRefSchema.optional(),
    targetAccessPolicy: AccessPolicySchema,
    targetRouteClaim: CompiledRouteClaimSchema,
  }).strict();
export const LegacyBrowserPreferenceImportSchema = z
  .object({
    storageKey: z.string().trim().min(1).max(256),
    jsonPath: z
      .array(
        z.union([
          z.string().trim().min(1).max(128),
          z.object({ stateId: ContractIdentifierSchema }).strict(),
        ]),
      )
      .min(1)
      .max(16)
      .optional(),
    valueType: z.enum(["string", "number", "boolean-01", "json"]),
  })
  .strict();
export const PageStateDefinitionSchema = z
  .object({
    stateId: ContractIdentifierSchema,
    scopeNodeId: ContractIdentifierSchema.optional(),
    initialValue: PageExpressionSchema.optional(),
    schemaRevisionRef: RevisionRefSchema,
    defaultValue: JsonValueSchema.optional(),
    persistence: z.enum([
      "none",
      "session",
      "url",
      "tenant-preference",
      "url-with-tenant-preference",
    ]),
    urlWriteback: z.enum(["synchronize", "never"]).optional(),
    preferencePartitionStateId: ContractIdentifierSchema.optional(),
    legacyBrowserPreferenceImport:
      LegacyBrowserPreferenceImportSchema.optional(),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.scopeNodeId && value.persistence !== "none")
      context.addIssue({
        code: "custom",
        path: ["persistence"],
        message:
          "Repeated instance state must not persist outside its instance.",
      });
    if (
      value.initialValue &&
      !value.scopeNodeId &&
      (value.persistence !== "none" ||
        value.initialValue.kind !== "read" ||
        value.initialValue.root !== "state" ||
        value.initialValue.path.length !== 1)
    )
      context.addIssue({
        code: "custom",
        path: ["initialValue"],
        message:
          "Root initialization must directly read one persisted Page state into non-persistent state.",
      });
    if (value.schemaRevisionRef.kind !== "schema") {
      context.addIssue({
        code: "custom",
        path: ["schemaRevisionRef", "kind"],
        message: "Page state must pin an exact schema revision.",
      });
    }
    if (
      value.preferencePartitionStateId !== undefined &&
      value.persistence !== "tenant-preference" &&
      value.persistence !== "url-with-tenant-preference"
    ) {
      context.addIssue({
        code: "custom",
        path: ["preferencePartitionStateId"],
        message: "Preference partitioning requires tenant preference state.",
      });
    }
    if (
      value.urlWriteback !== undefined &&
      value.persistence !== "url" &&
      value.persistence !== "url-with-tenant-preference"
    ) {
      context.addIssue({
        code: "custom",
        path: ["urlWriteback"],
        message: "URL writeback is only valid for URL-backed Page state.",
      });
    }
  });
export const InteractionBindingSchema = z
  .object({
    bindingId: ContractIdentifierSchema,
    source: z
      .object({
        capabilityInstanceId: ContractIdentifierSchema,
        port: ContractIdentifierSchema,
      })
      .strict(),
    sourceIntentSchemaRevisionRef: RevisionRefSchema,
    sourceResultSchemaRevisionRef: RevisionRefSchema.optional(),
    targetStateId: ContractIdentifierSchema,
    transition: z.enum(["set", "merge", "toggle", "append", "remove", "reset"]),
    inputMapping: z.record(
      ContractIdentifierSchema,
      InteractionBindingSourceSchema,
    ),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.sourceIntentSchemaRevisionRef.kind !== "schema") {
      context.addIssue({
        code: "custom",
        path: ["sourceIntentSchemaRevisionRef", "kind"],
        message: "Interaction source intents must pin a schema revision.",
      });
    }
    const mapsResult = Object.values(value.inputMapping).some(
      (source) =>
        source.kind === "result-field" ||
        (source.kind === "expression" &&
          collectPageExpressionReads(source.expression).some(
            (read) => read.root === "result",
          )),
    );
    if (mapsResult && !value.sourceResultSchemaRevisionRef) {
      context.addIssue({
        code: "custom",
        path: ["sourceResultSchemaRevisionRef"],
        message:
          "Result-field interactions must pin the exact Action result schema revision.",
      });
    }
    if (
      value.sourceResultSchemaRevisionRef?.kind !== undefined &&
      value.sourceResultSchemaRevisionRef.kind !== "schema"
    ) {
      context.addIssue({
        code: "custom",
        path: ["sourceResultSchemaRevisionRef", "kind"],
        message: "Interaction source results must pin a schema revision.",
      });
    }
    if (!mapsResult && value.sourceResultSchemaRevisionRef) {
      context.addIssue({
        code: "custom",
        path: ["sourceResultSchemaRevisionRef"],
        message:
          "Interaction result schemas are only valid when inputMapping declares a result-field source.",
      });
    }
    const mappedInputs = Object.keys(value.inputMapping);
    if (
      (value.transition === "toggle" || value.transition === "reset") &&
      mappedInputs.length > 0
    ) {
      context.addIssue({
        code: "custom",
        path: ["inputMapping"],
        message: `${value.transition} transitions cannot declare mapped inputs.`,
      });
    }
    if (
      value.transition !== "toggle" &&
      value.transition !== "reset" &&
      mappedInputs.length === 0
    ) {
      context.addIssue({
        code: "custom",
        path: ["inputMapping"],
        message: `${value.transition} transitions require at least one mapped input.`,
      });
    }
  });
export const GovernedCatalogResourceKindSchema = z.enum([
  "tag",
  "tag-group",
  "feature-column",
]);
export const GovernedCatalogDomainQueryDataSourceSchema = z
  .object({
    kind: z.literal("governed-catalog"),
    resourceKind: GovernedCatalogResourceKindSchema,
  })
  .strict();
export const RegisteredServiceDomainQueryDataSourceSchema = z
  .object({
    kind: z.literal("registered-service"),
  })
  .strict();
export const DomainQueryDataSourceSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("exact-view") }).strict(),
  z
    .object({
      kind: z.literal("tenant-catalog"),
      resource: z.enum(["ontology", "view"]),
      ontologyIdParameter: ContractIdentifierSchema.optional(),
    })
    .strict()
    .superRefine((source, context) => {
      if (source.resource === "view" && !source.ontologyIdParameter) {
        context.addIssue({
          code: "custom",
          path: ["ontologyIdParameter"],
          message:
            "A tenant View catalog must declare the input parameter that scopes it to one Ontology.",
        });
      }
      if (source.resource === "ontology" && source.ontologyIdParameter) {
        context.addIssue({
          code: "custom",
          path: ["ontologyIdParameter"],
          message:
            "An Ontology catalog cannot be pre-scoped by an Ontology input.",
        });
      }
    }),
  z
    .object({
      kind: z.literal("tenant-current-view"),
      ontologyIdParameter: ContractIdentifierSchema,
      viewIdParameter: ContractIdentifierSchema,
    })
    .strict(),
  z.object({ kind: z.literal("page-state") }).strict(),
  GovernedCatalogDomainQueryDataSourceSchema,
  RegisteredServiceDomainQueryDataSourceSchema,
]);
export const DomainQueryDefinitionSchema = z
  .object({
    contract: z.literal("DomainQueryDefinition"),
    schemaVersion: z.literal(DECLARATIVE_CONTROL_SCHEMA_VERSION),
    queryId: ContractIdentifierSchema,
    tenantScope: TenantScopeSchema,
    dataSource: DomainQueryDataSourceSchema.optional(),
    handlerRef: EntityRefSchema.optional(),
    ontologyDefinitionRevisionRef: RevisionRefSchema.optional(),
    viewRevisionRef: RevisionRefSchema.optional(),
    canonicalDataViewRevisionRef: RevisionRefSchema.optional(),
    inputSchemaRevisionRef: RevisionRefSchema,
    resultSchemaRevisionRef: RevisionRefSchema,
    accessPolicy: AccessPolicySchema,
    lineageRequired: z.literal(true),
  })
  .strict()
  .superRefine((value, context) => {
    const sourceKind = value.dataSource?.kind ?? "exact-view";
    const exactDataRefs = [
      value.ontologyDefinitionRevisionRef,
      value.viewRevisionRef,
      value.canonicalDataViewRevisionRef,
    ];
    if (
      sourceKind === "exact-view" &&
      exactDataRefs.some((reference) => !reference)
    ) {
      context.addIssue({
        code: "custom",
        path: ["dataSource"],
        message:
          "An exact-view Domain Query must pin Ontology, governed View, and canonical Data View revisions.",
      });
    }
    if (sourceKind !== "exact-view" && exactDataRefs.some(Boolean)) {
      context.addIssue({
        code: "custom",
        path: ["dataSource"],
        message: "A non-View Domain Query cannot also pin one fixed View.",
      });
    }
    if (
      value.dataSource &&
      (!value.handlerRef || value.handlerRef.version === undefined)
    ) {
      context.addIssue({
        code: "custom",
        path: ["handlerRef"],
        message:
          "A source-aware Domain Query must pin its release-owned handler version.",
      });
    }
    const refs: Array<
      readonly [string, z.infer<typeof RevisionRefSchema>, string]
    > = [
      ...(sourceKind === "exact-view" && value.ontologyDefinitionRevisionRef
        ? [
            [
              "ontologyDefinitionRevisionRef",
              value.ontologyDefinitionRevisionRef,
              "ontology-definition",
            ] as const,
          ]
        : []),
      ...(sourceKind === "exact-view" && value.viewRevisionRef
        ? [["viewRevisionRef", value.viewRevisionRef, "view"] as const]
        : []),
      ...(sourceKind === "exact-view" && value.canonicalDataViewRevisionRef
        ? [
            [
              "canonicalDataViewRevisionRef",
              value.canonicalDataViewRevisionRef,
              "view",
            ] as const,
          ]
        : []),
      ["inputSchemaRevisionRef", value.inputSchemaRevisionRef, "schema"],
      ["resultSchemaRevisionRef", value.resultSchemaRevisionRef, "schema"],
    ];
    refs.forEach(([field, reference, expectedKind]) => {
      if (reference.kind !== expectedKind) {
        context.addIssue({
          code: "custom",
          path: [field, "kind"],
          message: `${field} must reference ${expectedKind}.`,
        });
      }
      validateTenantCompatibleReference(
        reference,
        value.tenantScope,
        [field],
        context,
      );
    });
    [
      ...value.accessPolicy.groupAllOf,
      ...value.accessPolicy.groupAnyOf,
    ].forEach((reference, index) =>
      validateTenantCompatibleReference(
        reference,
        value.tenantScope,
        ["accessPolicy", "groups", index],
        context,
      ),
    );
    value.accessPolicy.conditionAllOf.forEach((reference, index) =>
      validateTenantCompatibleReference(
        reference,
        value.tenantScope,
        ["accessPolicy", "conditionAllOf", index],
        context,
      ),
    );
    if (
      value.viewRevisionRef &&
      value.canonicalDataViewRevisionRef &&
      exactRevisionRef(
        value.viewRevisionRef,
        value.canonicalDataViewRevisionRef,
      )
    ) {
      context.addIssue({
        code: "custom",
        path: ["canonicalDataViewRevisionRef"],
        message:
          "Governed View adapter and canonical data.view revisions must be distinct.",
      });
    }
  });
export const CursorWindowBindingSchema = z
  .object({
    sourceCapabilityInstanceId: ContractIdentifierSchema.optional(),
    pageChangePort: ContractIdentifierSchema,
    pageChangeIntentSchemaRevisionRef: RevisionRefSchema,
  })
  .strict()
  .superRefine((value, context) => {
    if (value.pageChangeIntentSchemaRevisionRef.kind !== "schema") {
      context.addIssue({
        code: "custom",
        path: ["pageChangeIntentSchemaRevisionRef", "kind"],
        message:
          "Cursor-window page-change intents must pin a schema revision.",
      });
    }
  });
export const QueryResultStateBindingSchema = z
  .object({
    targetStateId: ContractIdentifierSchema,
    targetStateSchemaRevisionRef: RevisionRefSchema,
    source: z
      .object({ kind: z.enum(["page-info-total", "model-total"]) })
      .strict(),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.targetStateSchemaRevisionRef.kind !== "schema") {
      context.addIssue({
        code: "custom",
        path: ["targetStateSchemaRevisionRef", "kind"],
        message:
          "Query result state bindings must pin a Page-state schema revision.",
      });
    }
  });
export const QueryBindingSchema = z
  .object({
    bindingId: ContractIdentifierSchema,
    queryDefinitionRevisionRef: RevisionRefSchema,
    parameters: z.record(ContractIdentifierSchema, BindingSourceSchema),
    target: z
      .object({
        capabilityInstanceId: ContractIdentifierSchema,
        port: ContractIdentifierSchema,
      })
      .strict(),
    renderModelSchemaRevisionRef: RevisionRefSchema,
    targetProjection: z
      .object({
        expression: PageExpressionSchema,
        schemaRevisionRef: RevisionRefSchema,
      })
      .strict()
      .optional(),
    streamTargetProjection: z
      .object({
        expression: PageExpressionSchema,
        schemaRevisionRef: RevisionRefSchema,
      })
      .strict()
      .optional(),
    stateEffects: z
      .array(
        z
          .object({
            targetStateId: ContractIdentifierSchema,
            value: PageExpressionSchema,
            when: PageExpressionSchema.optional(),
          })
          .strict(),
      )
      .max(32)
      .optional(),
    queryWhen: PageStateActivationSchema.optional(),
    accessFailure: z.literal("render-forbidden").optional(),
    draftRetention: z.object({
      identityParameters: z.array(ContractIdentifierSchema).min(1).max(32),
    }).strict().optional(),
    resultStateBindings: z
      .array(QueryResultStateBindingSchema)
      .max(32)
      .optional(),
    execution: z.enum(["server", "local-state"]).default("server"),
    pagination: z.enum(["none", "cursor", "offset"]),
    cursorWindow: CursorWindowBindingSchema.optional(),
    cache: z.enum(["none", "identity-scoped", "tenant-scoped"]),
    cancelOnChange: z.boolean(),
    refreshPolicy: z
      .object({
        intervalMs: z.number().int().min(1000).max(300000),
        when: PageExpressionSchema.optional(),
      })
      .strict()
      .optional(),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.draftRetention) {
      const names = value.draftRetention.identityParameters;
      if (value.execution !== 'server' || new Set(names).size !== names.length || names.some(name => !Object.prototype.hasOwnProperty.call(value.parameters, name))) {
        context.addIssue({ code: 'custom', path: ['draftRetention'], message: 'Draft retention requires distinct declared Server query identity parameters.' });
      }
    }
    if (value.targetProjection) {
      if (value.targetProjection.schemaRevisionRef.kind !== "schema")
        context.addIssue({
          code: "custom",
          path: ["targetProjection", "schemaRevisionRef"],
          message:
            "Query target projections require an exact target schema revision.",
        });
      for (const read of collectExternalPageExpressionReads(
        value.targetProjection.expression,
      ))
        if (read.root !== "model")
          context.addIssue({
            code: "custom",
            path: ["targetProjection", "expression"],
            message:
              "Query target projections may read only the validated raw model.",
          });
    }
    if (value.streamTargetProjection) {
      const projection = value.streamTargetProjection;
      if (projection.schemaRevisionRef.kind !== "schema")
        context.addIssue({
          code: "custom",
          path: ["streamTargetProjection", "schemaRevisionRef"],
          message:
            "Stream target projections require an exact target schema revision.",
        });
      for (const read of collectExternalPageExpressionReads(
        projection.expression,
      ))
        if (read.root !== "model")
          context.addIssue({
            code: "custom",
            path: ["streamTargetProjection", "expression"],
            message:
              "Stream target projections may read only the verified query and stream envelope.",
          });
      if (value.execution !== "server" || value.pagination !== "none")
        context.addIssue({
          code: "custom",
          path: ["streamTargetProjection"],
          message:
            "Stream target projections require a non-paginated Server query.",
        });
    }
    const effects = value.stateEffects ?? [];
    if (
      new Set(effects.map((effect) => effect.targetStateId)).size !==
      effects.length
    )
      context.addIssue({
        code: "custom",
        path: ["stateEffects"],
        message: "A query completion may update each state only once.",
      });
    for (const [index, effect] of effects.entries())
      for (const expression of [
        effect.value,
        ...(effect.when ? [effect.when] : []),
      ]) {
        for (const read of collectPageExpressionReads(expression))
          if (!["model", "state", "scope"].includes(read.root))
            context.addIssue({
              code: "custom",
              path: ["stateEffects", index],
              message:
                "Query state effects may read only model, state, and scope.",
            });
      }
    if (
      effects.length &&
      (value.execution !== "server" || value.pagination !== "none")
    )
      context.addIssue({
        code: "custom",
        path: ["stateEffects"],
        message: "Query state effects require a non-paginated Server query.",
      });
    if (value.refreshPolicy?.when) {
      for (const read of collectExternalPageExpressionReads(
        value.refreshPolicy.when,
      )) {
        if (
          read.root !== "model" &&
          !(
            read.root === "actions" &&
            read.path.length === 2 &&
            read.path[1] === "pending"
          )
        )
          context.addIssue({
            code: "custom",
            path: ["refreshPolicy", "when"],
            message:
              "Automatic refresh conditions may read only the verified raw model and declared action pending state.",
          });
      }
    }
    if (
      value.refreshPolicy &&
      (value.execution !== "server" || value.pagination !== "none")
    ) {
      context.addIssue({
        code: "custom",
        path: ["refreshPolicy"],
        message: "Automatic refresh requires a non-paginated Server query.",
      });
    }
    if (value.queryDefinitionRevisionRef.kind !== "domain-query-definition") {
      context.addIssue({
        code: "custom",
        path: ["queryDefinitionRevisionRef", "kind"],
        message:
          "Query bindings must pin a governed domain-query-definition revision.",
      });
    }
    if (value.renderModelSchemaRevisionRef.kind !== "schema") {
      context.addIssue({
        code: "custom",
        path: ["renderModelSchemaRevisionRef", "kind"],
        message: "Query bindings must pin a render-model schema revision.",
      });
    }
    if (value.execution === "local-state" && value.pagination !== "none") {
      context.addIssue({
        code: "custom",
        path: ["pagination"],
        message: "Local Page-state queries cannot paginate.",
      });
    }
    if (value.execution === "local-state" && value.accessFailure) {
      context.addIssue({
        code: "custom",
        path: ["accessFailure"],
        message:
          "Only a Server query can render an independently governed access failure.",
      });
    }
    if (
      value.execution === "local-state" &&
      (value.resultStateBindings?.length ?? 0) > 0
    ) {
      context.addIssue({
        code: "custom",
        path: ["resultStateBindings"],
        message:
          "Only Server queries can project governed result totals into Page state.",
      });
    }
    const targetStateIds =
      value.resultStateBindings?.map((binding) => binding.targetStateId) ?? [];
    if (new Set(targetStateIds).size !== targetStateIds.length) {
      context.addIssue({
        code: "custom",
        path: ["resultStateBindings"],
        message:
          "A Query binding can project a governed result total to each Page state at most once.",
      });
    }
    if (value.cursorWindow && value.pagination !== "cursor") {
      context.addIssue({
        code: "custom",
        path: ["cursorWindow"],
        message: "Cursor-window navigation requires cursor pagination.",
      });
    }
    if (value.cursorWindow && value.execution !== "server") {
      context.addIssue({
        code: "custom",
        path: ["cursorWindow"],
        message: "Cursor-window navigation requires Server query execution.",
      });
    }
  });
export const CapabilityInstanceSchema = z
  .object({
    instanceId: ContractIdentifierSchema,
    nodeId: ContractIdentifierSchema,
    capabilityRevisionRef: RevisionRefSchema,
    providerRevisionRef: RevisionRefSchema,
    propertySchemaRevisionRef: RevisionRefSchema,
    properties: JsonObjectSchema,
    propertyBindings: z.array(PagePropertyBindingSchema).max(128).optional(),
    eventPayloadBindings: z
      .array(
        z
          .object({
            port: ContractIdentifierSchema,
            expression: PageExpressionSchema,
          })
          .strict(),
      )
      .max(32)
      .optional(),
    eventEffects: z
      .array(
        z
          .object({
            sourcePort: ContractIdentifierSchema,
            sourceIntentSchemaRevisionRef: RevisionRefSchema,
            refreshBindingIds: z
              .array(ContractIdentifierSchema)
              .min(1)
              .max(128),
          })
          .strict(),
      )
      .max(32)
      .optional(),
    accessPolicy: AccessPolicySchema.optional(),
    activationWhen: PageStateActivationSchema.optional(),
    allowedSideEffects: z.array(
      z.enum([
        "network",
        "storage",
        "navigation",
        "clipboard",
        "worker",
        "websocket",
      ]),
    ),
  })
  .strict();
export const OntologyBindingSchema = z
  .object({
    bindingId: ContractIdentifierSchema,
    ontologyDefinitionRevisionRef: RevisionRefSchema,
    viewRevisionRef: RevisionRefSchema,
    canonicalDataViewRevisionRef: RevisionRefSchema,
    parameters: z.record(ContractIdentifierSchema, BindingSourceSchema),
    target: z
      .object({
        capabilityInstanceId: ContractIdentifierSchema,
        port: ContractIdentifierSchema,
      })
      .strict(),
    renderModelSchemaRevisionRef: RevisionRefSchema,
    pagination: z.enum(["none", "cursor", "offset"]),
    cursorWindow: CursorWindowBindingSchema.optional(),
    cache: z.enum(["none", "identity-scoped", "tenant-scoped"]),
    cancelOnChange: z.boolean(),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.viewRevisionRef.kind !== "view") {
      context.addIssue({
        code: "custom",
        path: ["viewRevisionRef", "kind"],
        message: "Ontology bindings require an exact governed View revision.",
      });
    }
    if (value.canonicalDataViewRevisionRef.kind !== "view") {
      context.addIssue({
        code: "custom",
        path: ["canonicalDataViewRevisionRef", "kind"],
        message:
          "Ontology bindings require an exact canonical data.view revision.",
      });
    }
    if (
      exactRevisionRef(
        value.viewRevisionRef,
        value.canonicalDataViewRevisionRef,
      )
    ) {
      context.addIssue({
        code: "custom",
        path: ["canonicalDataViewRevisionRef"],
        message:
          "Governed View adapter and canonical data.view revisions must be distinct.",
      });
    }
    if (value.ontologyDefinitionRevisionRef.kind !== "ontology-definition") {
      context.addIssue({
        code: "custom",
        path: ["ontologyDefinitionRevisionRef", "kind"],
        message: "Expected an ontology-definition revision.",
      });
    }
    if (value.cursorWindow && value.pagination !== "cursor") {
      context.addIssue({
        code: "custom",
        path: ["cursorWindow"],
        message: "Cursor-window navigation requires cursor pagination.",
      });
    }
  });
/** Persisted pre-canonical bindings retain their exact references and content hashes. */
export const LegacyOntologyBindingSchema = z
  .object({
    ...OntologyBindingSchema.shape,
    viewRevisionRef: RevisionRefSchema.optional(),
    canonicalDataViewRevisionRef: z.never().optional(),
    projectionRevisionRef: RevisionRefSchema.optional(),
  })
  .strict()
  .superRefine((value, context) => {
    if (
      Boolean(value.viewRevisionRef) === Boolean(value.projectionRevisionRef)
    ) {
      context.addIssue({
        code: "custom",
        path: ["viewRevisionRef"],
        message:
          "Legacy bindings require exactly one View or projection revision.",
      });
    }
    for (const [key, reference, kind] of [
      [
        "ontologyDefinitionRevisionRef",
        value.ontologyDefinitionRevisionRef,
        "ontology-definition",
      ],
      ["viewRevisionRef", value.viewRevisionRef, "view"],
      ["projectionRevisionRef", value.projectionRevisionRef, "projection-spec"],
    ] as const) {
      if (reference && reference.kind !== kind)
        context.addIssue({
          code: "custom",
          path: [key, "kind"],
          message: `Expected a ${kind} revision.`,
        });
    }
    if (value.cursorWindow && value.pagination !== "cursor")
      context.addIssue({
        code: "custom",
        path: ["cursorWindow"],
        message: "Cursor-window navigation requires cursor pagination.",
      });
  });

export const PersistedOntologyBindingSchema = z
  .object({
    ...OntologyBindingSchema.shape,
    viewRevisionRef: RevisionRefSchema.optional(),
    canonicalDataViewRevisionRef: RevisionRefSchema.optional(),
    projectionRevisionRef: RevisionRefSchema.optional(),
  })
  .strict()
  .superRefine((value, context) => {
    const schema = value.canonicalDataViewRevisionRef
      ? OntologyBindingSchema
      : LegacyOntologyBindingSchema;
    const parsed = schema.safeParse(value);
    if (!parsed.success)
      for (const issue of parsed.error.issues)
        context.addIssue({
          code: "custom",
          path: issue.path,
          message: issue.message,
        });
  });

export const ActionResultBindingEffectSourceSchema = z.discriminatedUnion(
  "kind",
  [
    z
      .object({
        kind: z.literal("result-field"),
        path: z
          .string()
          .trim()
          .regex(/^[A-Za-z0-9_.-]+$/),
      })
      .strict(),
    z.object({ kind: z.literal("constant"), value: JsonValueSchema }).strict(),
    z
      .object({
        kind: z.literal("collection-length"),
        offset: z.number().int().min(-1000).max(1000),
      })
      .strict(),
  ],
);
export const ActionResultBindingEffectSchema = z
  .object({
    bindingId: ContractIdentifierSchema,
    operation: z.enum(["upsert-append", "remove-exact"]),
    collectionPath: z.array(ContractIdentifierSchema).min(1).max(8),
    identityPath: z.array(ContractIdentifierSchema).min(1).max(8),
    mappings: z
      .array(
        z
          .object({
            targetPath: z.array(ContractIdentifierSchema).min(1).max(8),
            source: ActionResultBindingEffectSourceSchema,
          })
          .strict(),
      )
      .min(1)
      .max(64),
  })
  .strict()
  .superRefine((value, context) => {
    const targetPaths = value.mappings.map(({ targetPath }) =>
      targetPath.join("."),
    );
    if (new Set(targetPaths).size !== targetPaths.length) {
      context.addIssue({
        code: "custom",
        path: ["mappings"],
        message: "Result binding effect target paths must be unique.",
      });
    }
    if (!targetPaths.includes(value.identityPath.join("."))) {
      context.addIssue({
        code: "custom",
        path: ["identityPath"],
        message:
          "A result binding effect must map the exact identity path of the projected item.",
      });
    }
    const identityMapping = value.mappings.find(
      ({ targetPath }) => targetPath.join(".") === value.identityPath.join("."),
    );
    if (identityMapping?.source.kind === "collection-length") {
      context.addIssue({
        code: "custom",
        path: ["identityPath"],
        message:
          "A projected item identity must come from the verified result or a declared constant.",
      });
    }
    if (value.operation === "remove-exact" && value.mappings.length !== 1) {
      context.addIssue({
        code: "custom",
        path: ["mappings"],
        message:
          "An exact removal declares only the verified identity mapping used to remove one item.",
      });
    }
  });

export const ActionResultClipboardEffectSchema = z
  .object({
    source: z
      .object({
        kind: z.literal("result-field"),
        path: z
          .string()
          .trim()
          .regex(/^[A-Za-z0-9_.-]+$/),
      })
      .strict(),
    copiedToast: I18nTextSchema.optional(),
    fallbackToast: I18nTextSchema.superRefine((value, context) => {
      for (const [locale, message] of Object.entries(value.values)) {
        if (!message.includes("{value}")) {
          context.addIssue({
            code: "custom",
            path: ["values", locale],
            message:
              "Clipboard fallback feedback must visibly include the exact verified value placeholder.",
          });
        }
      }
    }),
  })
  .strict();

export const ActionBindingSchema = z
  .object({
    bindingId: ContractIdentifierSchema,
    commandRevisionRef: RevisionRefSchema,
    source: z
      .object({
        capabilityInstanceId: ContractIdentifierSchema,
        port: ContractIdentifierSchema,
      })
      .strict(),
    sourceIntentSchemaRevisionRef: RevisionRefSchema,
    inputSchemaRevisionRef: RevisionRefSchema,
    when: PageExpressionSchema.optional(),
    fileInputs: z.array(ActionFileInputSchema).min(1).max(4).optional(),
    inputMapping: z.record(
      ContractIdentifierSchema,
      ActionInputBindingSourceSchema,
    ),
    sensitiveInputPaths: SensitiveResultPathsSchema.optional(),
    accessPolicy: AccessPolicySchema,
    confirmation: I18nTextSchema.optional(),
    idempotencyKeySource: z.enum([
      "interaction",
      "record-and-interaction",
      "caller-provided",
    ]),
    compensationCommandRevisionRef: RevisionRefSchema.optional(),
    resultSchemaRevisionRef: RevisionRefSchema,
    success: z
      .object({
        download: z
          .discriminatedUnion("kind", [
            z.object({ kind: z.literal("native") }).strict(),
            z
              .object({
                kind: z.literal("text-artifact"),
                fileNamePath: PageValuePathSchema.min(1),
                mimeTypePath: PageValuePathSchema.min(1),
                contentPath: PageValuePathSchema.min(1),
                maxBytes: z.number().int().min(1).max(1048576),
              })
              .strict(),
          ])
          .optional(),
        refreshBindingIds: z.array(ContractIdentifierSchema),
        ephemeralResult: z
          .object({
            kind: z.literal("one-time-value"),
            valuePath: SensitiveResultPathSchema,
            labelPath: SensitiveResultPathSchema,
            title: I18nTextSchema,
            description: I18nTextSchema,
            copySuccessToast: I18nTextSchema,
            copyFailureToast: I18nTextSchema,
          })
          .strict()
          .optional(),
        resultBindingEffects: z
          .array(ActionResultBindingEffectSchema)
          .max(64)
          .optional(),
        clipboard: ActionResultClipboardEffectSchema.optional(),
        navigationTargetRef: StableRefSchema.optional(),
        toast: I18nTextSchema.optional(),
      })
      .strict(),
    recovery: z.enum(["retry-safe", "compensating-command", "manual-review"]),
    lineageRequired: z.literal(true),
  })
  .strict()
  .superRefine((value, context) => {
    const fileIds = new Set<string>();
    for (const file of value.fileInputs ?? []) {
      if (fileIds.has(file.inputId))
        context.addIssue({
          code: "custom",
          path: ["fileInputs"],
          message: "File input ids must be unique.",
        });
      fileIds.add(file.inputId);
      if (
        !Object.values(value.inputMapping).some(
          (source) =>
            source.kind === "file-field" && source.fileInputId === file.inputId,
        )
      )
        context.addIssue({
          code: "custom",
          path: ["fileInputs"],
          message: "File inputs require an explicit governed input mapping.",
        });
    }
    for (const [name, source] of Object.entries(value.inputMapping))
      if (source.kind === "file-field") {
        const file = value.fileInputs?.find(
          (file) => file.inputId === source.fileInputId,
        );
        if (
          (source.path === "canonicalUri" && !file?.upload) ||
          (source.path === "content" && file?.upload)
        )
          context.addIssue({
            code: "custom",
            path: ["inputMapping", name],
            message: "File field must match its declared transport mode.",
          });
        if (!fileIds.has(source.fileInputId))
          context.addIssue({
            code: "custom",
            path: ["inputMapping", name],
            message: "File fields must reference a declared file input.",
          });
        if (
          source.path === "content" &&
          !value.sensitiveInputPaths?.includes(`/${name}`)
        )
          context.addIssue({
            code: "custom",
            path: ["sensitiveInputPaths"],
            message:
              "File content must be declared as a sensitive command input.",
          });
      }
    if (value.when)
      for (const read of collectPageExpressionReads(value.when)) {
        if (!["intent", "state", "scope"].includes(read.root))
          context.addIssue({
            code: "custom",
            path: ["when"],
            message:
              "Action conditions may read only intent, declared Page state, and instance scope.",
          });
      }
    if (value.success.ephemeralResult) {
      const { valuePath, labelPath } = value.success.ephemeralResult;
      const segments = (path: string) => path.split("/").slice(1);
      const valueSegments = segments(valuePath);
      const labelSegments = segments(labelPath);
      const sharedLength = Math.min(valueSegments.length, labelSegments.length);
      if (
        valueSegments
          .slice(0, sharedLength)
          .every((segment, index) => segment === labelSegments[index])
      ) {
        context.addIssue({
          code: "custom",
          path: ["success", "ephemeralResult", "labelPath"],
          message:
            "One-time result labels cannot overlap the sensitive value path.",
        });
      }
    }
    if (
      value.success.ephemeralResult &&
      (value.success.resultBindingEffects?.length || 0) > 0
    ) {
      context.addIssue({
        code: "custom",
        path: ["success", "resultBindingEffects"],
        message:
          "One-time result presentation cannot share a result with durable binding effects.",
      });
    }
    if (value.commandRevisionRef.kind !== "domain-command") {
      context.addIssue({
        code: "custom",
        path: ["commandRevisionRef", "kind"],
        message: "Action bindings must reference a domain-command revision.",
      });
    }
    if (value.sourceIntentSchemaRevisionRef.kind !== "schema") {
      context.addIssue({
        code: "custom",
        path: ["sourceIntentSchemaRevisionRef", "kind"],
        message: "Action source intents must pin a schema revision.",
      });
    }
    if (value.inputSchemaRevisionRef.kind !== "schema") {
      context.addIssue({
        code: "custom",
        path: ["inputSchemaRevisionRef", "kind"],
        message: "Action command inputs must pin a schema revision.",
      });
    }
    if (
      value.recovery === "compensating-command" &&
      !value.compensationCommandRevisionRef
    ) {
      context.addIssue({
        code: "custom",
        path: ["compensationCommandRevisionRef"],
        message: "Compensating recovery requires a compensation command.",
      });
    }
  });
export const PageMigrationEquivalenceDimensionSchema = z.enum([
  "url",
  "navigation",
  "access",
  "deep-link",
  "layout",
  "size",
  "spacing",
  "design-tokens",
  "responsive",
  "view-modes",
  "search-filter",
  "editing",
  "detail",
  "history",
  "dialogs",
  "keyboard",
  "loading",
  "empty",
  "error",
  "forbidden",
]);
export const PageMigrationEquivalenceSchema = z
  .object({
    contract: z.literal("PageMigrationEquivalence"),
    schemaVersion: z.literal(1),
    policy: z.literal("preserve-ui-ux"),
    baseline: z
      .object({
        repository: ContractIdentifierSchema,
        revision: z.string().regex(/^[0-9a-f]{40}$/),
        pageId: ContractIdentifierSchema,
        routePath: RoutePathTemplateSchema,
      })
      .strict(),
    protectedDimensions: z
      .array(PageMigrationEquivalenceDimensionSchema)
      .min(1),
    viewports: z
      .array(
        z
          .object({
            viewportId: ContractIdentifierSchema,
            width: z.number().int().min(320).max(7680),
            height: z.number().int().min(480).max(4320),
          })
          .strict(),
      )
      .min(2),
    scenarios: z
      .array(
        z
          .object({
            scenarioId: ContractIdentifierSchema,
            viewportIds: z.array(ContractIdentifierSchema).min(1),
          })
          .strict(),
      )
      .min(1),
    evidence: z
      .object({
        sideBySideVisual: z.literal(true),
        domSnapshot: z.literal(true),
        consoleErrors: z.literal("none"),
      })
      .strict(),
    allowedDifferences: z.array(
      z
        .object({
          differenceId: ContractIdentifierSchema,
          requirementRevisionRef: RevisionRefSchema,
        })
        .strict(),
    ),
  })
  .strict()
  .superRefine((value, context) => {
    if (uniqueArray(value.protectedDimensions, (candidate) => candidate)) {
      context.addIssue({
        code: "custom",
        path: ["protectedDimensions"],
        message: "Protected UI/UX dimensions must be unique.",
      });
    }
    if (uniqueArray(value.viewports, (candidate) => candidate.viewportId)) {
      context.addIssue({
        code: "custom",
        path: ["viewports"],
        message: "Migration equivalence viewport identities must be unique.",
      });
    }
    if (uniqueArray(value.scenarios, (candidate) => candidate.scenarioId)) {
      context.addIssue({
        code: "custom",
        path: ["scenarios"],
        message: "Migration equivalence scenario identities must be unique.",
      });
    }
    const viewportIds = new Set(
      value.viewports.map((viewport) => viewport.viewportId),
    );
    value.scenarios.forEach((scenario, index) => {
      scenario.viewportIds.forEach((viewportId, viewportIndex) => {
        if (!viewportIds.has(viewportId)) {
          context.addIssue({
            code: "custom",
            path: ["scenarios", index, "viewportIds", viewportIndex],
            message: `Migration equivalence scenario references unknown viewport ${viewportId}.`,
          });
        }
      });
    });
  });

export const PageRouteStatePresentationSchema = z
  .object({
    surface: ProductSurfaceSchema,
    state: z.literal("forbidden"),
    kind: z.literal("status"),
    presentation: z.enum(["panel", "page"]),
    title: I18nTextSchema,
    description: I18nTextSchema.optional(),
  })
  .strict()
  .superRefine((value, context) => {
    const localizedFields = [
      ["title", value.title, 160],
      ["description", value.description, 1000],
    ] as const;
    localizedFields.forEach(([field, copy, maxLength]) => {
      if (!copy) return;
      const entries = Object.entries(copy.values);
      if (entries.length > 16) {
        context.addIssue({
          code: "custom",
          path: [field, "values"],
          message: "Route-state presentation copy supports at most 16 locales.",
        });
      }
      entries.forEach(([locale, text]) => {
        if (text.length > maxLength) {
          context.addIssue({
            code: "custom",
            path: [field, "values", locale],
            message: `Route-state ${field} copy must contain at most ${maxLength} characters.`,
          });
        }
      });
    });
  });

export const PageStateSchema = PageStateDefinitionSchema.omit({
  schemaRevisionRef: true,
})
  .extend({
    stateId: ContractIdentifierSchema,
    schema: ContractIdentifierSchema,
  })
  .strict();

export const PageEntryTargetSchema = z
  .object({
    kind: z.enum(["page", "workbench"]),
    id: ContractIdentifierSchema,
  })
  .strict();

export const PageEntrySchema = PageEntryTransitionSchema.omit({
  targetRef: true,
})
  .extend({
    target: PageEntryTargetSchema,
  })
  .strict();

export const PageInteractionSchema = InteractionBindingSchema.omit({
  source: true,
  sourceIntentSchemaRevisionRef: true,
  sourceResultSchemaRevisionRef: true,
})
  .extend({
    port: ContractIdentifierSchema,
  })
  .strict();

const PageCursorWindowSchema = CursorWindowBindingSchema.omit({
  pageChangeIntentSchemaRevisionRef: true,
}).strict();
const PageResultStateBindingSchema = QueryResultStateBindingSchema.omit({
  targetStateSchemaRevisionRef: true,
}).strict();

export const PageDataSchema = QueryBindingSchema.omit({
  queryDefinitionRevisionRef: true,
  target: true,
  renderModelSchemaRevisionRef: true,
  targetProjection: true,
  streamTargetProjection: true,
  cursorWindow: true,
  resultStateBindings: true,
})
  .extend({
    query: ContractIdentifierSchema,
    port: ContractIdentifierSchema,
    targetProjection: z
      .object({ expression: PageExpressionSchema })
      .strict()
      .optional(),
    streamTargetProjection: z
      .object({ expression: PageExpressionSchema })
      .strict()
      .optional(),
    cursorWindow: PageCursorWindowSchema.optional(),
    resultStateBindings: z
      .array(PageResultStateBindingSchema)
      .max(32)
      .optional(),
  })
  .strict();

export const PageActionSchema = ActionBindingSchema.omit({
  commandRevisionRef: true,
  source: true,
  sourceIntentSchemaRevisionRef: true,
  inputSchemaRevisionRef: true,
  compensationCommandRevisionRef: true,
  resultSchemaRevisionRef: true,
})
  .extend({
    command: ContractIdentifierSchema,
    port: ContractIdentifierSchema,
    compensationCommand: ContractIdentifierSchema.optional(),
  })
  .strict();

const PageEventEffectSchema = z
  .object({
    port: ContractIdentifierSchema,
    refresh: z.array(ContractIdentifierSchema).min(1).max(128),
  })
  .strict();

export interface PageNode {
  id: string;
  component: string;
  kind?: z.infer<typeof RenderNodeKindSchema>;
  slot?: string;
  props?: z.infer<typeof JsonObjectSchema>;
  bindings?: z.infer<typeof PagePropertyBindingSchema>[];
  model?: z.infer<typeof JsonObjectSchema>;
  style?: z.infer<typeof RenderStyleSchema>;
  layout?: z.infer<typeof RenderLayoutSchema>;
  responsive?: z.infer<typeof RenderResponsiveRuleSchema>[];
  surface?: z.infer<typeof RenderSurfaceSchema>;
  scroll?: z.infer<typeof RenderScrollSchema>;
  activation?: z.infer<typeof RenderActivationSchema>;
  lifecycle?: z.infer<typeof RenderLifecycleSchema>;
  state?: z.infer<typeof RenderNodeStateSchema>;
  access?: z.infer<typeof AccessPolicySchema>;
  activeWhen?: PageStateActivation;
  repeat?: {
    source: z.infer<typeof PageExpressionSchema>;
    keyPath: string[];
    limit?: number;
  };
  data?: z.infer<typeof PageDataSchema>[];
  actions?: z.infer<typeof PageActionSchema>[];
  on?: z.infer<typeof PageInteractionSchema>[];
  effects?: z.infer<typeof PageEventEffectSchema>[];
  eventPayloads?: Array<{
    port: string;
    expression: z.infer<typeof PageExpressionSchema>;
  }>;
  children?: PageNode[];
}

export const PageNodeSchema: z.ZodType<PageNode> = z.lazy(() =>
  z
    .object({
      id: ContractIdentifierSchema,
      component: ContractIdentifierSchema,
      kind: RenderNodeKindSchema.optional(),
      slot: ContractIdentifierSchema.optional(),
      props: JsonObjectSchema.optional(),
      bindings: z.array(PagePropertyBindingSchema).max(128).optional(),
      model: JsonObjectSchema.optional(),
      style: RenderStyleSchema.optional(),
      layout: RenderLayoutSchema.optional(),
      responsive: z.array(RenderResponsiveRuleSchema).optional(),
      surface: RenderSurfaceSchema.optional(),
      scroll: RenderScrollSchema.optional(),
      activation: RenderActivationSchema.optional(),
      lifecycle: RenderLifecycleSchema.optional(),
      state: RenderNodeStateSchema.optional(),
      access: AccessPolicySchema.optional(),
      activeWhen: PageStateActivationSchema.optional(),
      repeat: z
        .object({
          source: PageExpressionSchema,
          keyPath: PageValuePathSchema.min(1),
          limit: z.number().int().min(1).max(1000).optional(),
        })
        .strict()
        .optional(),
      data: z.array(PageDataSchema).optional(),
      actions: z.array(PageActionSchema).optional(),
      on: z.array(PageInteractionSchema).optional(),
      effects: z.array(PageEventEffectSchema).optional(),
      eventPayloads: z
        .array(
          z
            .object({
              port: ContractIdentifierSchema,
              expression: PageExpressionSchema,
            })
            .strict(),
        )
        .optional(),
      children: z.array(PageNodeSchema).optional(),
    })
    .strict(),
);

export const PageSchema = z
  .object({
    contract: z.literal("Page"),
    schemaVersion: z.literal(DECLARATIVE_CONTROL_SCHEMA_VERSION),
    pageId: ContractIdentifierSchema,
    tenantScope: TenantScopeSchema,
    identity: IdentitySchema,
    surface: ProductSurfaceSchema,
    route: RoutePathTemplateSchema,
    routeSpace: ContractIdentifierSchema.optional(),
    lifecycle: DeclarativeLifecycleSchema.default("active"),
    routeStatePresentations: z
      .array(PageRouteStatePresentationSchema)
      .max(8)
      .optional(),
    shell: ContractIdentifierSchema.optional(),
    body: PageNodeSchema,
    state: z.array(PageStateSchema).optional(),
    entryTransitions: z.array(PageEntrySchema).optional(),
    access: AccessPolicySchema,
    managementAccess: ManagementAccessSchema,
    tokens: z.array(ContractIdentifierSchema).optional(),
    performanceBudget: ContractIdentifierSchema.optional(),
    observationPolicy: ContractIdentifierSchema.optional(),
    privacyClassification: z
      .enum(["public", "internal", "confidential", "restricted"])
      .default("internal"),
  })
  .strict()
  .superRefine((page, context) => {
    const ids = new Set<string>();
    const dataIds = new Set<string>();
    const actionIds = new Set<string>();
    const interactionIds = new Set<string>();
    const visit = (node: PageNode, path: Array<string | number>) => {
      if (ids.has(node.id))
        context.addIssue({
          code: "custom",
          path: [...path, "id"],
          message: `Duplicate Page node id ${node.id}.`,
        });
      ids.add(node.id);
      for (const [field, values, target] of [
        ["data", node.data ?? [], dataIds],
        ["actions", node.actions ?? [], actionIds],
        ["on", node.on ?? [], interactionIds],
      ] as const)
        for (const [index, value] of values.entries()) {
          if (target.has(value.bindingId))
            context.addIssue({
              code: "custom",
              path: [...path, field, index, "bindingId"],
              message: `Duplicate Page binding id ${value.bindingId}.`,
            });
          target.add(value.bindingId);
        }
      (node.children ?? []).forEach((child, index) =>
        visit(child, [...path, "children", index]),
      );
    };
    visit(page.body, ["body"]);
    const stateIds = (page.state ?? []).map((entry) => entry.stateId);
    if (new Set(stateIds).size !== stateIds.length)
      context.addIssue({
        code: "custom",
        path: ["state"],
        message: "Page state ids must be unique.",
      });
  });

export const ResolvedPageSchema = z
  .object({
    contract: z.literal("Page"),
    schemaVersion: z.literal(DECLARATIVE_CONTROL_SCHEMA_VERSION),
    pageId: ContractIdentifierSchema,
    tenantScope: TenantScopeSchema,
    identity: IdentitySchema,
    supportedSurfaces: z.array(ProductSurfaceSchema).min(1),
    lifecycle: DeclarativeLifecycleSchema,
    legacyRoutePolicy: LegacyRoutePolicySchema.optional(),
    migrationEquivalence: PageMigrationEquivalenceSchema.optional(),
    routeStatePresentations: z
      .array(PageRouteStatePresentationSchema)
      .max(8)
      .optional(),
    routeClaims: z
      .array(
        z.union([
          DeclarativeRouteClaimSchema,
          LegacyDeclarativeRouteClaimSchema,
        ]),
      )
      .min(1),
    shellRevisionRef: RevisionRefSchema,
    renderTree: RenderTreeSchema,
    capabilityInstances: z.array(CapabilityInstanceSchema).min(1),
    stateDefinitions: z.array(PageStateDefinitionSchema).optional(),
    entryTransitions: z.array(PageEntryTransitionSchema).optional(),
    interactionBindings: z.array(InteractionBindingSchema).optional(),
    ontologyBindings: z.array(PersistedOntologyBindingSchema),
    queryBindings: z.array(QueryBindingSchema).optional(),
    actionBindings: z.array(ActionBindingSchema),
    pageAccessPolicy: AccessPolicySchema,
    managementAccess: ManagementAccessSchema,
    tokenRevisionRefs: z.array(RevisionRefSchema).min(1),
    performanceBudgetRef: RevisionRefSchema,
    observationPolicyRevisionRef: RevisionRefSchema,
    privacyClassification: z.enum([
      "public",
      "internal",
      "confidential",
      "restricted",
    ]),
  })
  .strict()
  .superRefine((value, context) => {
    validateDeclaredRouteSurfaces(
      value.supportedSurfaces,
      value.routeClaims,
      context,
    );
    const routeStatePresentations = value.routeStatePresentations ?? [];
    if (
      uniqueArray(
        routeStatePresentations,
        (candidate) => `${candidate.surface}:${candidate.state}`,
      )
    ) {
      context.addIssue({
        code: "custom",
        path: ["routeStatePresentations"],
        message:
          "Page route-state presentations must be unique per surface and state.",
      });
    }
    routeStatePresentations.forEach((presentation, index) => {
      if (!value.supportedSurfaces.includes(presentation.surface)) {
        context.addIssue({
          code: "custom",
          path: ["routeStatePresentations", index, "surface"],
          message:
            "Page route-state presentation surface must be declared by supportedSurfaces.",
        });
      }
    });
    const stateDefinitions = value.stateDefinitions ?? [];
    const entryTransitions = value.entryTransitions ?? [];
    const interactionBindings = value.interactionBindings ?? [];
    const queryBindings = value.queryBindings ?? [];
    stateDefinitions.forEach((definition, index) => {
      const partitionStateId = definition.preferencePartitionStateId;
      const dynamicLegacySegments =
        definition.legacyBrowserPreferenceImport?.jsonPath?.filter(
          (segment) => typeof segment !== "string",
        ) ?? [];
      if (!partitionStateId) {
        if (dynamicLegacySegments.length > 0) {
          context.addIssue({
            code: "custom",
            path: [
              "stateDefinitions",
              index,
              "legacyBrowserPreferenceImport",
              "jsonPath",
            ],
            message:
              "A dynamic legacy preference path requires a declared preference partition state.",
          });
        }
        return;
      }
      const partitionDefinition = stateDefinitions.find(
        (candidate) => candidate.stateId === partitionStateId,
      );
      if (
        partitionStateId === definition.stateId ||
        !partitionDefinition ||
        partitionDefinition.preferencePartitionStateId
      ) {
        context.addIssue({
          code: "custom",
          path: ["stateDefinitions", index, "preferencePartitionStateId"],
          message:
            "Preference partitioning must reference a distinct, non-partitioned Page state.",
        });
      }
      definition.legacyBrowserPreferenceImport?.jsonPath?.forEach(
        (segment, segmentIndex) => {
          if (
            typeof segment !== "string" &&
            segment.stateId !== partitionStateId
          ) {
            context.addIssue({
              code: "custom",
              path: [
                "stateDefinitions",
                index,
                "legacyBrowserPreferenceImport",
                "jsonPath",
                segmentIndex,
              ],
              message:
                "A dynamic legacy preference path must use the declared preference partition state.",
            });
          }
        },
      );
    });
    const uniqueness: Array<
      [
        string,
        readonly {
          [key: string]: unknown;
        }[],
        (candidate: { [key: string]: unknown }) => string,
      ]
    > = [
      [
        "capabilityInstances",
        value.capabilityInstances,
        (candidate) => String(candidate.instanceId),
      ],
      [
        "stateDefinitions",
        stateDefinitions,
        (candidate) => String(candidate.stateId),
      ],
      [
        "entryTransitions",
        entryTransitions,
        (candidate) => String(candidate.transitionId),
      ],
      [
        "interactionBindings",
        interactionBindings,
        (candidate) => String(candidate.bindingId),
      ],
      [
        "ontologyBindings",
        value.ontologyBindings,
        (candidate) => String(candidate.bindingId),
      ],
      [
        "queryBindings",
        queryBindings,
        (candidate) => String(candidate.bindingId),
      ],
      [
        "actionBindings",
        value.actionBindings,
        (candidate) => String(candidate.bindingId),
      ],
    ];
    uniqueness.forEach(([field, values, identity]) => {
      if (uniqueArray(values, identity))
        context.addIssue({
          code: "custom",
          path: [field],
          message: `${field} identities must be unique.`,
        });
    });
    const instanceIds = new Set(
      value.capabilityInstances.map((instance) => instance.instanceId),
    );
    const stateIds = new Set(stateDefinitions.map((state) => state.stateId));
    value.capabilityInstances.forEach((instance, index) => {
      const ports = new Set<string>();
      const payloadPorts = new Set<string>();
      instance.eventPayloadBindings?.forEach((binding, bindingIndex) => {
        const path = [
          "capabilityInstances",
          index,
          "eventPayloadBindings",
          bindingIndex,
        ];
        if (payloadPorts.has(binding.port))
          context.addIssue({
            code: "custom",
            path,
            message:
              "An event payload can have only one declarative projection.",
          });
        payloadPorts.add(binding.port);
        for (const read of collectPageExpressionReads(binding.expression)) {
          if (
            read.root === "actions" ||
            read.root === "result" ||
            (read.root === "state" && !stateIds.has(read.path[0] ?? "")) ||
            (read.root === "bindings" &&
              ![...value.ontologyBindings, ...queryBindings].some(
                (candidate) => candidate.bindingId === read.path[0],
              ))
          )
            context.addIssue({
              code: "custom",
              path,
              message:
                "Event payload projections require local event, model, scope, declared query results, or declared state.",
            });
        }
      });

      instance.eventEffects?.forEach((effect, effectIndex) => {
        const path = [
          "capabilityInstances",
          index,
          "eventEffects",
          effectIndex,
        ];
        if (
          effect.sourceIntentSchemaRevisionRef.kind !== "schema" ||
          ports.has(effect.sourcePort)
        )
          context.addIssue({
            code: "custom",
            path,
            message:
              "Event effects require one exact source schema per output port.",
          });
        ports.add(effect.sourcePort);
        if (
          value.actionBindings.some(
            (binding) =>
              binding.source.capabilityInstanceId === instance.instanceId &&
              binding.source.port === effect.sourcePort,
          )
        )
          context.addIssue({
            code: "custom",
            path,
            message:
              "An Action output port must declare refresh effects through Action.success.",
          });
        for (const id of effect.refreshBindingIds)
          if (
            ![...value.ontologyBindings, ...queryBindings].some(
              (binding) => binding.bindingId === id,
            )
          )
            context.addIssue({
              code: "custom",
              path,
              message: "Event effect references an unknown query binding.",
            });
      });
    });

    const repeatNodes = new Set(
      value.renderTree.nodes
        .filter((node) => node.repeat)
        .map((node) => node.nodeId),
    );
    stateDefinitions.forEach((definition, index) => {
      if (definition.scopeNodeId && !repeatNodes.has(definition.scopeNodeId))
        context.addIssue({
          code: "custom",
          path: ["stateDefinitions", index, "scopeNodeId"],
          message:
            "Instance state must reference an existing repeated RenderNode.",
        });
      if (definition.initialValue && !definition.scopeNodeId) {
        const expression = definition.initialValue;
        const source =
          expression.kind === "read"
            ? stateDefinitions.find(
                (state) =>
                  state.stateId === expression.path[0] && !state.scopeNodeId,
              )
            : undefined;
        if (
          !source ||
          source.initialValue ||
          !["tenant-preference", "url-with-tenant-preference"].includes(
            source.persistence,
          )
        )
          context.addIssue({
            code: "custom",
            path: ["stateDefinitions", index, "initialValue"],
            message:
              "Root initialization requires an independently hydrated tenant preference; initialization chains are forbidden.",
          });
      }
      if (definition.initialValue) {
        for (const read of collectPageExpressionReads(
          definition.initialValue,
        )) {
          if (
            !["scope", "state"].includes(read.root) ||
            (read.root === "state" &&
              !stateDefinitions.some(
                (state) => state.stateId === read.path[0] && !state.scopeNodeId,
              ))
          )
            context.addIssue({
              code: "custom",
              path: ["stateDefinitions", index, "initialValue"],
              message:
                "Instance initial values can read only their item scope and declared Page state.",
            });
        }
      }
    });
    value.renderTree.nodes.forEach((node, index) => {
      if (!node.repeat) return;
      for (const read of collectPageExpressionReads(node.repeat.source)) {
        if (
          read.root === "actions" ||
          read.root === "intent" ||
          read.root === "result" ||
          read.root === "model" ||
          (read.root === "state" && !stateIds.has(read.path[0] ?? "")) ||
          (read.root === "bindings" &&
            ![...value.ontologyBindings, ...queryBindings].some(
              (binding) => binding.bindingId === read.path[0],
            ))
        )
          context.addIssue({
            code: "custom",
            path: ["renderTree", "nodes", index, "repeat", "source"],
            message:
              "Repeated nodes require declared Page state, query results, or parent item scope.",
          });
      }
    });

    // A declaration can consume its own instance or ancestors, never an arbitrary sibling row.
    const renderNodesById = new Map(
      value.renderTree.nodes.map((node) => [node.nodeId, node]),
    );
    const instanceNodes = new Map(
      value.capabilityInstances.map((instance) => [
        instance.instanceId,
        instance.nodeId,
      ]),
    );
    const scopesForNode = (nodeId: string | undefined): Set<string> => {
      const scopes = new Set<string>();
      const visited = new Set<string>();
      let node = nodeId ? renderNodesById.get(nodeId) : undefined;
      while (node && !visited.has(node.nodeId)) {
        visited.add(node.nodeId);
        if (node.repeat) scopes.add(node.nodeId);
        node = node.parentNodeId
          ? renderNodesById.get(node.parentNodeId)
          : undefined;
      }
      return scopes;
    };
    const queryOwners = new Map(
      [...value.ontologyBindings, ...queryBindings].map((binding) => [
        binding.bindingId,
        [
          ...scopesForNode(
            instanceNodes.get(binding.target.capabilityInstanceId),
          ),
        ][0],
      ]),
    );
    const actionScopes = new Map(
      value.actionBindings.map((binding) => [
        binding.bindingId,
        scopesForNode(instanceNodes.get(binding.source.capabilityInstanceId)),
      ]),
    );
    const actionOwners = new Map(
      [...actionScopes].map(([id, scopes]) => [id, [...scopes][0]]),
    );
    if (actionOwners.size !== value.actionBindings.length)
      context.addIssue({
        code: "custom",
        path: ["actionBindings"],
        message: "Action binding identifiers must be unique.",
      });
    const checkScopedReads = (
      reads: ReturnType<typeof collectPageExpressionReads>,
      scopes: Set<string>,
      path: (string | number)[],
    ) => {
      for (const read of reads) {
        const owner =
          read.root === "state"
            ? stateDefinitions.find((state) => state.stateId === read.path[0])
                ?.scopeNodeId
            : read.root === "bindings"
              ? queryOwners.get(read.path[0])
              : read.root === "actions"
                ? actionOwners.get(read.path[0])
                : undefined;
        // A parent may observe only aggregate pending for its descendant action scopes.
        // Error codes and individual row state remain scoped; unrelated repeat branches cannot aggregate.
        const pendingAggregate =
          read.root === "actions" &&
          read.path.length === 2 &&
          read.path[1] === "pending" &&
          actionScopes.has(read.path[0]) &&
          [...scopes].every((scope) =>
            actionScopes.get(read.path[0])!.has(scope),
          );
        if (owner && !scopes.has(owner) && !pendingAggregate)
          context.addIssue({
            code: "custom",
            path,
            message:
              "A binding cannot read state, query results, or individual action status from a sibling or descendant instance.",
          });
      }
    };
    const checkScopedSources = (
      sources: Record<
        string,
        | z.infer<typeof BindingSourceSchema>
        | z.infer<typeof InteractionBindingSourceSchema>
        | z.infer<typeof FileFieldBindingSourceSchema>
      >,
      scopes: Set<string>,
      path: (string | number)[],
    ) => {
      Object.entries(sources).forEach(([name, source]) => {
        if (source.kind === "expression")
          checkScopedReads(
            collectPageExpressionReads(source.expression),
            scopes,
            [...path, name],
          );
        if (source.kind === "page-state")
          checkScopedReads(
            [{ kind: "read", root: "state", path: [source.stateId] }],
            scopes,
            [...path, name],
          );
        if (source.kind === "binding-field")
          checkScopedReads(
            [{ kind: "read", root: "bindings", path: [source.bindingId] }],
            scopes,
            [...path, name],
          );
        if (source.kind === "scope-field" && scopes.size === 0)
          context.addIssue({
            code: "custom",
            path: [...path, name],
            message: "A scope field requires a repeated instance.",
          });
      });
    };
    value.capabilityInstances.forEach((instance, index) =>
      instance.eventPayloadBindings?.forEach((binding, bindingIndex) =>
        checkScopedReads(
          collectPageExpressionReads(binding.expression),
          scopesForNode(instance.nodeId),
          ["capabilityInstances", index, "eventPayloadBindings", bindingIndex],
        ),
      ),
    );
    value.capabilityInstances.forEach((instance, index) =>
      instance.propertyBindings?.forEach((binding, bindingIndex) => {
        checkScopedReads(
          collectPageExpressionReads(binding.expression),
          scopesForNode(instance.nodeId),
          ["capabilityInstances", index, "propertyBindings", bindingIndex],
        );
      }),
    );
    for (const [collection, bindings] of [
      ["ontologyBindings", value.ontologyBindings],
      ["queryBindings", queryBindings],
    ] as const) {
      bindings.forEach((binding, index) =>
        checkScopedSources(
          binding.parameters,
          scopesForNode(instanceNodes.get(binding.target.capabilityInstanceId)),
          [collection, index, "parameters"],
        ),
      );
    }
    value.actionBindings.forEach((binding, index) => {
      const scopes = scopesForNode(
        instanceNodes.get(binding.source.capabilityInstanceId),
      );
      checkScopedSources(binding.inputMapping, scopes, [
        "actionBindings",
        index,
        "inputMapping",
      ]);
      for (const [fileIndex, file] of (binding.fileInputs ?? []).entries()) {
        if (file.source.kind === "page-state") {
          const stateId = file.source.stateId;
          const state = stateDefinitions.find(
            (candidate) => candidate.stateId === stateId,
          );
          if (!state || state.persistence !== "none")
            context.addIssue({
              code: "custom",
              path: ["actionBindings", index, "fileInputs", fileIndex],
              message:
                "File handles require declared nonpersistent Page state.",
            });
          checkScopedSources({ file: file.source }, scopes, [
            "actionBindings",
            index,
            "fileInputs",
            fileIndex,
          ]);
        }
      }

      if (binding.when) {
        const reads = collectPageExpressionReads(binding.when);
        checkScopedReads(reads, scopes, ["actionBindings", index, "when"]);
        for (const read of reads)
          if (read.root === "state" && !stateIds.has(read.path[0]!))
            context.addIssue({
              code: "custom",
              path: ["actionBindings", index, "when"],
              message: "Action condition references an unknown Page state.",
            });
      }
    });
    interactionBindings.forEach((binding, index) => {
      const sourceScopes = scopesForNode(
        instanceNodes.get(binding.source.capabilityInstanceId),
      );
      const targetScope = stateDefinitions.find(
        (state) => state.stateId === binding.targetStateId,
      )?.scopeNodeId;
      if (targetScope && !sourceScopes.has(targetScope))
        context.addIssue({
          code: "custom",
          path: ["interactionBindings", index, "targetStateId"],
          message:
            "An interaction must target its own instance or an ancestor.",
        });
      checkScopedSources(
        binding.inputMapping,
        targetScope ? scopesForNode(targetScope) : new Set(),
        ["interactionBindings", index, "inputMapping"],
      );
    });
    value.renderTree.nodes.forEach((node, index) => {
      if (node.repeat)
        checkScopedReads(
          collectPageExpressionReads(node.repeat.source),
          scopesForNode(node.parentNodeId),
          ["renderTree", "nodes", index, "repeat", "source"],
        );
    });

    entryTransitions.forEach((transition, transitionIndex) => {
      if (
        transition.gestureSource &&
        (!instanceIds.has(transition.gestureSource.capabilityInstanceId) ||
          !interactionBindings.some(
            (binding) =>
              binding.source.capabilityInstanceId ===
                transition.gestureSource!.capabilityInstanceId &&
              binding.source.port === transition.gestureSource!.port,
          ))
      ) {
        context.addIssue({
          code: "custom",
          path: ["entryTransitions", transitionIndex, "gestureSource"],
          message:
            "Entry gesture source must match an existing capability interaction source.",
        });
      }
      if (
        transition.targetRef.kind === "page" &&
        transition.targetRef.id === value.pageId
      ) {
        context.addIssue({
          code: "custom",
          path: ["entryTransitions", transitionIndex, "targetRef"],
          message: "A Page cannot route into itself on entry.",
        });
      }
      forEachPageStateCondition(
        transition.activation,
        (condition, conditionPath) => {
          if (!stateIds.has(condition.stateId)) {
            context.addIssue({
              code: "custom",
              path: [
                "entryTransitions",
                transitionIndex,
                "activation",
                ...conditionPath,
                "stateId",
              ],
              message: `Entry transition references unknown Page state ${condition.stateId}.`,
            });
          }
        },
      );
      const declaredRouteParameters = new Set(
        value.routeClaims.flatMap((claim) =>
          [...claim.pathTemplate.matchAll(/:([A-Za-z][A-Za-z0-9_-]*)/g)].map(
            (match) => match[1],
          ),
        ),
      );
      for (const source of [
        ...Object.values(transition.pathParameters),
        ...Object.values(transition.query.set),
      ]) {
        if (
          source.kind === "route-parameter" &&
          !declaredRouteParameters.has(source.name)
        ) {
          context.addIssue({
            code: "custom",
            path: ["entryTransitions", transitionIndex],
            message: `Entry transition references unknown source route parameter ${source.name}.`,
          });
        }
      }
      const stateSources = [
        ...Object.values(transition.pathParameters).flatMap((source) =>
          source.kind === "page-state" ? [source.stateId] : [],
        ),
        ...Object.values(transition.query.set).flatMap((source) =>
          source.kind === "page-state" ? [source.stateId] : [],
        ),
      ];
      stateSources.forEach((stateId) => {
        if (!stateIds.has(stateId)) {
          context.addIssue({
            code: "custom",
            path: ["entryTransitions", transitionIndex],
            message: `Entry transition references unknown Page state ${stateId}.`,
          });
        }
      });
    });
    const validatePageStateSources = (
      sources: Record<
        string,
        | z.infer<typeof BindingSourceSchema>
        | z.infer<typeof InteractionBindingSourceSchema>
        | z.infer<typeof FileFieldBindingSourceSchema>
      >,
      path: (string | number)[],
    ) => {
      Object.entries(sources).forEach(([name, source]) => {
        if (source.kind === "expression") {
          for (const read of collectPageExpressionReads(source.expression)) {
            if (
              (read.root === "state" &&
                (!read.path[0] || !stateIds.has(read.path[0]))) ||
              read.root === "model" ||
              read.root === "bindings" ||
              (read.root === "result" && path[0] !== "interactionBindings")
            ) {
              context.addIssue({
                code: "custom",
                path: [...path, name, "expression"],
                message:
                  "Expression references unavailable context or an undeclared Page state.",
              });
            }
          }
        }
        if (source.kind === "page-state" && !stateIds.has(source.stateId)) {
          context.addIssue({
            code: "custom",
            path: [...path, name, "stateId"],
            message: `Unknown Page state: ${source.stateId}`,
          });
        }
      });
    };
    interactionBindings.forEach((binding, index) => {
      if (!instanceIds.has(binding.source.capabilityInstanceId)) {
        context.addIssue({
          code: "custom",
          path: [
            "interactionBindings",
            index,
            "source",
            "capabilityInstanceId",
          ],
          message:
            "Interaction binding sources an unknown capability instance.",
        });
      }
      if (!stateIds.has(binding.targetStateId)) {
        context.addIssue({
          code: "custom",
          path: ["interactionBindings", index, "targetStateId"],
          message: "Interaction binding targets an unknown Page state.",
        });
      }
      validatePageStateSources(binding.inputMapping, [
        "interactionBindings",
        index,
        "inputMapping",
      ]);
      if (
        Object.values(binding.inputMapping).some(
          (source) =>
            source.kind === "result-field" ||
            (source.kind === "expression" &&
              collectPageExpressionReads(source.expression).some(
                (read) => read.root === "result",
              )),
        )
      ) {
        const action = value.actionBindings.find(
          (candidate) =>
            candidate.source.capabilityInstanceId ===
              binding.source.capabilityInstanceId &&
            candidate.source.port === binding.source.port,
        );
        if (!action) {
          context.addIssue({
            code: "custom",
            path: ["interactionBindings", index, "source"],
            message:
              "Result-field interactions must source one declared Action binding.",
          });
        } else if (
          !binding.sourceResultSchemaRevisionRef ||
          !exactRevisionRef(
            binding.sourceResultSchemaRevisionRef,
            action.resultSchemaRevisionRef,
          )
        ) {
          context.addIssue({
            code: "custom",
            path: [
              "interactionBindings",
              index,
              "sourceResultSchemaRevisionRef",
            ],
            message:
              "Interaction result schema must exactly match the sourced Action result schema.",
          });
        }
      }
    });
    value.capabilityInstances.forEach((instance, index) => {
      const paths: string[][] = [];
      instance.propertyBindings?.forEach((binding, bindingIndex) => {
        const path = [
          "capabilityInstances",
          index,
          "propertyBindings",
          bindingIndex,
        ];
        if (
          instance.capabilityRevisionRef.id.startsWith(
            "monkeys.design.component.",
          )
        ) {
          const [group, member, field] = binding.targetPath;
          const messages = instance.properties.messages;
          const message =
            messages && typeof messages === "object" && !Array.isArray(messages)
              ? messages[member]
              : undefined;
          const declaredMessage =
            message && typeof message === "object" && !Array.isArray(message);
          const allowed =
            (group === "props" && binding.targetPath.length >= 2) ||
            (group === "messages" &&
              declaredMessage &&
              ((field === "values" && binding.targetPath.length >= 3) ||
                (binding.targetPath.length === 3 &&
                  (field === "key" || field === "textI18n") &&
                  Object.prototype.hasOwnProperty.call(message, field))));
          if (!allowed)
            context.addIssue({
              code: "custom",
              path: [...path, "targetPath"],
              message:
                "Component expressions can update property values or declared message fields, never executable wiring.",
            });
        }

        if (
          paths.some((previous) =>
            previous
              .slice(0, Math.min(previous.length, binding.targetPath.length))
              .every((key, i) => key === binding.targetPath[i]),
          )
        ) {
          context.addIssue({
            code: "custom",
            path: [...path, "targetPath"],
            message: "Dynamic property targets must not overlap.",
          });
        }
        paths.push(binding.targetPath);
        visitPageExpression(binding.expression, (expression) => {
          if (expression.kind !== "read") return;
          if (
            expression.root === "state" &&
            (!expression.path[0] || !stateIds.has(expression.path[0]))
          ) {
            context.addIssue({
              code: "custom",
              path: [...path, "expression"],
              message:
                "Property expressions must reference a declared Page state.",
            });
          }
          if (
            expression.root === "bindings" &&
            ![...value.ontologyBindings, ...queryBindings].some(
              (candidate) => candidate.bindingId === expression.path[0],
            )
          ) {
            context.addIssue({
              code: "custom",
              path: [...path, "expression"],
              message:
                "Property expressions must reference a declared Page query binding.",
            });
          }
          if (
            expression.root === "actions" &&
            (expression.path.length !== 2 ||
              !actionOwners.has(expression.path[0]) ||
              !["pending", "errorCode"].includes(expression.path[1]))
          ) {
            context.addIssue({
              code: "custom",
              path: [...path, "expression"],
              message:
                "Property expressions may read only pending or errorCode from a declared Action binding.",
            });
          }
          if (expression.root === "intent" || expression.root === "result") {
            context.addIssue({
              code: "custom",
              path: [...path, "expression"],
              message:
                "Property expressions cannot read transient event or Action results.",
            });
          }
        });
      });
      if (!instance.activationWhen) return;
      forEachPageStateCondition(
        instance.activationWhen,
        (condition, conditionPath) => {
          if (!stateIds.has(condition.stateId)) {
            context.addIssue({
              code: "custom",
              path: [
                "capabilityInstances",
                index,
                "activationWhen",
                ...conditionPath,
                "stateId",
              ],
              message:
                "Capability activation condition references an unknown Page state.",
            });
          }
        },
      );
    });
    value.ontologyBindings.forEach((binding, index) => {
      if (!instanceIds.has(binding.target.capabilityInstanceId)) {
        context.addIssue({
          code: "custom",
          path: ["ontologyBindings", index, "target", "capabilityInstanceId"],
          message: "Ontology binding targets an unknown capability instance.",
        });
      }
      validatePageStateSources(binding.parameters, [
        "ontologyBindings",
        index,
        "parameters",
      ]);
    });
    queryBindings.forEach((binding, index) => {
      if (!instanceIds.has(binding.target.capabilityInstanceId)) {
        context.addIssue({
          code: "custom",
          path: ["queryBindings", index, "target", "capabilityInstanceId"],
          message: "Query binding targets an unknown capability instance.",
        });
      }
      validatePageStateSources(binding.parameters, [
        "queryBindings",
        index,
        "parameters",
      ]);
      if (binding.queryWhen) {
        forEachPageStateCondition(
          binding.queryWhen,
          (condition, conditionPath) => {
            if (!stateIds.has(condition.stateId)) {
              context.addIssue({
                code: "custom",
                path: [
                  "queryBindings",
                  index,
                  "queryWhen",
                  ...conditionPath,
                  "stateId",
                ],
                message:
                  "Query activation condition references an unknown Page state.",
              });
            }
          },
        );
      }
      if (binding.refreshPolicy?.when) {
        const path = ["queryBindings", index, "refreshPolicy", "when"];
        const reads = collectExternalPageExpressionReads(
          binding.refreshPolicy.when,
        );
        checkScopedReads(
          reads,
          scopesForNode(instanceNodes.get(binding.target.capabilityInstanceId)),
          path,
        );
        for (const read of reads)
          if (read.root === "actions" && !actionScopes.has(read.path[0]))
            context.addIssue({
              code: "custom",
              path,
              message:
                "Automatic refresh condition references an unknown action binding.",
            });
      }
      const effectOwners = new Set(
        binding.stateEffects?.map(
          (effect) =>
            stateDefinitions.find(
              (definition) => definition.stateId === effect.targetStateId,
            )?.scopeNodeId ?? "",
        ) ?? [],
      );
      if (effectOwners.size > 1)
        context.addIssue({
          code: "custom",
          path: ["queryBindings", index, "stateEffects"],
          message:
            "A query completion must update a single state owner atomically.",
        });
      binding.stateEffects?.forEach((effect, effectIndex) => {
        const path = ["queryBindings", index, "stateEffects", effectIndex];
        const state = stateDefinitions.find(
          (definition) => definition.stateId === effect.targetStateId,
        );
        const scopes = scopesForNode(
          instanceNodes.get(binding.target.capabilityInstanceId),
        );
        if (!state || (state.scopeNodeId && !scopes.has(state.scopeNodeId)))
          context.addIssue({
            code: "custom",
            path: [...path, "targetStateId"],
            message:
              "A query effect must target declared state in its own scope or an ancestor.",
          });
        for (const expression of [
          effect.value,
          ...(effect.when ? [effect.when] : []),
        ]) {
          const reads = collectPageExpressionReads(expression);
          checkScopedReads(
            reads,
            state?.scopeNodeId ? scopesForNode(state.scopeNodeId) : new Set(),
            path,
          );
          for (const read of reads)
            if (read.root === "state" && !stateIds.has(read.path[0]!))
              context.addIssue({
                code: "custom",
                path,
                message: "Query effect references an unknown Page state.",
              });
        }
      });
      binding.resultStateBindings?.forEach((resultBinding, resultIndex) => {
        const stateDefinition = stateDefinitions.find(
          (definition) => definition.stateId === resultBinding.targetStateId,
        );
        if (!stateDefinition) {
          context.addIssue({
            code: "custom",
            path: [
              "queryBindings",
              index,
              "resultStateBindings",
              resultIndex,
              "targetStateId",
            ],
            message: "Query result binding targets an unknown Page state.",
          });
          return;
        }
        if (
          !exactRevisionRef(
            resultBinding.targetStateSchemaRevisionRef,
            stateDefinition.schemaRevisionRef,
          )
        ) {
          context.addIssue({
            code: "custom",
            path: [
              "queryBindings",
              index,
              "resultStateBindings",
              resultIndex,
              "targetStateSchemaRevisionRef",
            ],
            message:
              "Query result binding must pin the exact target Page-state schema revision.",
          });
        }
        if (stateDefinition.persistence !== "none") {
          context.addIssue({
            code: "custom",
            path: [
              "queryBindings",
              index,
              "resultStateBindings",
              resultIndex,
              "targetStateId",
            ],
            message:
              "Query result state projections must target non-persistent Page state.",
          });
        }
      });
    });
    const dependencyBindings = [...value.ontologyBindings, ...queryBindings];
    analyzePageBindingDependencies(dependencyBindings).errors.forEach(
      (error) => {
        const ontologyIndex = value.ontologyBindings.findIndex(
          (binding) => binding.bindingId === error.bindingId,
        );
        const collection =
          ontologyIndex >= 0 ? "ontologyBindings" : "queryBindings";
        const index =
          ontologyIndex >= 0
            ? ontologyIndex
            : queryBindings.findIndex(
                (binding) => binding.bindingId === error.bindingId,
              );
        context.addIssue({
          code: "custom",
          path: [collection, index, "parameters"],
          message: `Page binding dependency ${error.code}: ${error.dependencyId ?? error.bindingId}`,
        });
      },
    );
    const projectedQueryStateIds = new Set<string>();
    queryBindings.forEach((binding, index) => {
      binding.resultStateBindings?.forEach((resultBinding, resultIndex) => {
        if (projectedQueryStateIds.has(resultBinding.targetStateId)) {
          context.addIssue({
            code: "custom",
            path: [
              "queryBindings",
              index,
              "resultStateBindings",
              resultIndex,
              "targetStateId",
            ],
            message:
              "One Page state can have only one Server Query result owner.",
          });
        }
        projectedQueryStateIds.add(resultBinding.targetStateId);
      });
    });
    queryBindings.forEach((binding, index) => {
      if (binding.execution !== "server") return;
      const readStateIds = new Set(
        Object.values(binding.parameters).flatMap((source) =>
          source.kind === "page-state" ? [source.stateId] : [],
        ),
      );
      if (binding.queryWhen) {
        forEachPageStateCondition(binding.queryWhen, (condition) =>
          readStateIds.add(condition.stateId),
        );
      }
      const feedbackStateId = [...readStateIds].find((stateId) =>
        projectedQueryStateIds.has(stateId),
      );
      if (feedbackStateId) {
        context.addIssue({
          code: "custom",
          path: ["queryBindings", index],
          message: `Server Query bindings cannot read projected Query result state: ${feedbackStateId}`,
        });
      }
    });
    const cursorWindowBindings = [
      ...value.ontologyBindings.map((binding, index) => ({
        binding,
        index,
        collection: "ontologyBindings" as const,
      })),
      ...queryBindings.map((binding, index) => ({
        binding,
        index,
        collection: "queryBindings" as const,
      })),
    ].filter((candidate) => candidate.binding.cursorWindow !== undefined);
    const cursorWindowSources = new Set<string>();
    cursorWindowBindings.forEach(({ binding, index, collection }) => {
      const sourceId =
        binding.cursorWindow!.sourceCapabilityInstanceId ??
        binding.target.capabilityInstanceId;
      if (!instanceIds.has(sourceId))
        context.addIssue({
          code: "custom",
          path: [
            collection,
            index,
            "cursorWindow",
            "sourceCapabilityInstanceId",
          ],
          message:
            "Cursor-window source must reference a declared capability instance.",
        });
      const sourceScopes = [...scopesForNode(instanceNodes.get(sourceId))];
      const targetScopes = [
        ...scopesForNode(
          instanceNodes.get(binding.target.capabilityInstanceId),
        ),
      ];
      if (
        sourceScopes.length !== targetScopes.length ||
        sourceScopes.some((id, index) => id !== targetScopes[index])
      )
        context.addIssue({
          code: "custom",
          path: [
            collection,
            index,
            "cursorWindow",
            "sourceCapabilityInstanceId",
          ],
          message:
            "Cursor-window source and query target must share the same repeated scope.",
        });
      const sourceKey = `${sourceId}:${binding.cursorWindow!.pageChangePort}`;
      if (cursorWindowSources.has(sourceKey)) {
        context.addIssue({
          code: "custom",
          path: [collection, index, "cursorWindow", "pageChangePort"],
          message:
            "A capability output port can govern at most one cursor-window binding.",
        });
      }
      cursorWindowSources.add(sourceKey);
      const conflictingInteraction = interactionBindings.some(
        (candidate) =>
          candidate.source.capabilityInstanceId === sourceId &&
          candidate.source.port === binding.cursorWindow!.pageChangePort,
      );
      const conflictingAction = value.actionBindings.some(
        (candidate) =>
          candidate.source.capabilityInstanceId === sourceId &&
          candidate.source.port === binding.cursorWindow!.pageChangePort,
      );
      if (conflictingInteraction || conflictingAction) {
        context.addIssue({
          code: "custom",
          path: [collection, index, "cursorWindow", "pageChangePort"],
          message:
            "Cursor-window page-change ports cannot also drive Page state or Domain Actions.",
        });
      }
    });
    value.actionBindings.forEach((binding, index) => {
      if (!instanceIds.has(binding.source.capabilityInstanceId)) {
        context.addIssue({
          code: "custom",
          path: ["actionBindings", index, "source", "capabilityInstanceId"],
          message: "Action binding sources an unknown capability instance.",
        });
      }
      validatePageStateSources(binding.inputMapping, [
        "actionBindings",
        index,
        "inputMapping",
      ]);
      binding.success.refreshBindingIds.forEach((bindingId) => {
        if (
          !value.ontologyBindings.some(
            (candidate) => candidate.bindingId === bindingId,
          ) &&
          !queryBindings.some((candidate) => candidate.bindingId === bindingId)
        ) {
          context.addIssue({
            code: "custom",
            path: ["actionBindings", index, "success", "refreshBindingIds"],
            message: `Unknown refresh binding: ${bindingId}`,
          });
        }
      });
      const effectBindingIds =
        binding.success.resultBindingEffects?.map(
          (effect) => effect.bindingId,
        ) ?? [];
      if (new Set(effectBindingIds).size !== effectBindingIds.length) {
        context.addIssue({
          code: "custom",
          path: ["actionBindings", index, "success", "resultBindingEffects"],
          message:
            "An Action can declare at most one result effect for each target binding.",
        });
      }
      binding.success.resultBindingEffects?.forEach((effect, effectIndex) => {
        if (
          !value.ontologyBindings.some(
            (candidate) => candidate.bindingId === effect.bindingId,
          ) &&
          !queryBindings.some(
            (candidate) => candidate.bindingId === effect.bindingId,
          )
        ) {
          context.addIssue({
            code: "custom",
            path: [
              "actionBindings",
              index,
              "success",
              "resultBindingEffects",
              effectIndex,
              "bindingId",
            ],
            message: `Unknown result effect binding: ${effect.bindingId}`,
          });
        }
        if (binding.success.refreshBindingIds.includes(effect.bindingId)) {
          context.addIssue({
            code: "custom",
            path: [
              "actionBindings",
              index,
              "success",
              "resultBindingEffects",
              effectIndex,
              "bindingId",
            ],
            message:
              "A result-projected binding cannot also be refreshed by the same Action.",
          });
        }
      });
      if (binding.success.clipboard) {
        const sourceInstance = value.capabilityInstances.find(
          (instance) =>
            instance.instanceId === binding.source.capabilityInstanceId,
        );
        if (!sourceInstance?.allowedSideEffects.includes("clipboard"))
          context.addIssue({
            code: "custom",
            path: ["actionBindings", index, "success", "clipboard"],
            message:
              "An Action result clipboard effect requires clipboard permission on its source capability instance.",
          });
      }
    });
    if (value.shellRevisionRef.kind !== "shell")
      context.addIssue({
        code: "custom",
        path: ["shellRevisionRef", "kind"],
        message: "Page shellRevisionRef must reference a shell.",
      });
    value.capabilityInstances.forEach((instance, index) => {
      if (instance.accessPolicy) {
        [
          ...instance.accessPolicy.groupAllOf,
          ...instance.accessPolicy.groupAnyOf,
          ...instance.accessPolicy.conditionAllOf,
        ].forEach((reference, refIndex) =>
          validateTenantCompatibleReference(
            reference,
            value.tenantScope,
            ["capabilityInstances", index, "accessPolicy", refIndex],
            context,
          ),
        );
      }
      const refs: Array<[string, z.infer<typeof RevisionRefSchema>, string]> = [
        ["capabilityRevisionRef", instance.capabilityRevisionRef, "capability"],
        ["providerRevisionRef", instance.providerRevisionRef, "view-provider"],
        [
          "propertySchemaRevisionRef",
          instance.propertySchemaRevisionRef,
          "schema",
        ],
      ];
      refs.forEach(([field, reference, expectedKind]) => {
        if (reference.kind !== expectedKind)
          context.addIssue({
            code: "custom",
            path: ["capabilityInstances", index, field, "kind"],
            message: `${field} must reference ${expectedKind}.`,
          });
      });
    });
    value.tokenRevisionRefs.forEach((reference, index) => {
      if (reference.kind !== "design-token")
        context.addIssue({
          code: "custom",
          path: ["tokenRevisionRefs", index, "kind"],
          message: "Page token references must use kind design-token.",
        });
    });
    if (value.performanceBudgetRef.kind !== "performance-budget")
      context.addIssue({
        code: "custom",
        path: ["performanceBudgetRef", "kind"],
        message: "Page requires a performance-budget revision.",
      });
    if (value.observationPolicyRevisionRef.kind !== "observation-policy")
      context.addIssue({
        code: "custom",
        path: ["observationPolicyRevisionRef", "kind"],
        message: "Page requires an observation-policy revision.",
      });
  });
export const PageReleaseSchema = z
  .object({
    contract: z.literal("PageRelease"),
    ...ReleaseBaseShape,
    pageRevisionRef: RevisionRefSchema,
    target: z
      .object({
        environmentRef: StableRefSchema,
        surface: ProductSurfaceSchema,
        routeSpaceRevisionRef: RevisionRefSchema,
        normalizedPath: RoutePathTemplateSchema,
        routeClaim: z.union([
          CompiledRouteClaimSchema,
          LegacyCompiledRouteClaimSchema,
        ]),
        legacyRouteTakeoverAuthorization:
          LegacyRouteTakeoverAuthorizationSchema.optional(),
      })
      .strict(),
  })
  .strict()
  .superRefine((value, context) => {
    validateLegacyRestoration(value, "legacy-route-adapter", context);
    validateDependencySnapshot(value.dependencySnapshot, context);
    validateReleaseGovernanceScope(value, "page-release", context);
    if (value.pageRevisionRef.kind !== "page")
      context.addIssue({
        code: "custom",
        path: ["pageRevisionRef", "kind"],
        message: "Expected a page revision.",
      });
    if (value.target.environmentRef.kind !== "environment")
      context.addIssue({
        code: "custom",
        path: ["target", "environmentRef", "kind"],
        message: "Page release target requires an environment reference.",
      });
    if (value.target.routeSpaceRevisionRef.kind !== "route-space")
      context.addIssue({
        code: "custom",
        path: ["target", "routeSpaceRevisionRef", "kind"],
        message: "Page release target requires a route-space revision.",
      });
    validateReleaseRouteSurface(value.target, context);
    if (
      value.target.normalizedPath !== value.target.routeClaim.normalizedPath ||
      !exactRevisionRef(
        value.target.routeSpaceRevisionRef,
        value.target.routeClaim.routeSpaceRevisionRef,
      )
    ) {
      context.addIssue({
        code: "custom",
        path: ["target", "routeClaim"],
        message:
          "Page Release route authority must pin the exact compiled claim and normalized path.",
      });
    }
    const takeover = value.target.legacyRouteTakeoverAuthorization;
    if (
      takeover &&
      (value.target.routeClaim.kind !== "canonical" ||
        takeover.normalizedPath !== value.target.normalizedPath ||
        !exactRevisionRef(
          takeover.routeSpaceRevisionRef,
          value.target.routeSpaceRevisionRef,
        ) ||
        takeover.targetResourceRef.kind !== "page" ||
        takeover.targetResourceRef.id !== value.pageRevisionRef.id ||
        takeover.targetResourceRef.ownerRepo !==
          value.pageRevisionRef.ownerRepo)
    ) {
      context.addIssue({
        code: "custom",
        path: ["target", "legacyRouteTakeoverAuthorization"],
        message:
          "A Page route takeover must bind the exact canonical claim, RouteSpace and target Page.",
      });
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
    kind: z.enum([
      "built-in-application",
      "workflow-form",
      "workflow",
      "agent",
      "design",
      "capability",
    ]),
    targetRevisionRef: RevisionRefSchema,
    providerRevisionRef: RevisionRefSchema,
    inputSchemaRevisionRef: RevisionRefSchema,
    input: JsonObjectSchema,
    groupId: ContractIdentifierSchema,
    order: z.number().int(),
    display: z
      .object({
        name: I18nTextSchema.optional(),
        iconRef: StableRefSchema.optional(),
      })
      .strict(),
    accessPolicy: AccessPolicySchema,
  })
  .strict();
export const WorkbenchSchema = z
  .object({
    contract: z.literal("Workbench"),
    schemaVersion: z.literal(DECLARATIVE_CONTROL_SCHEMA_VERSION),
    workbenchId: ContractIdentifierSchema,
    tenantScope: TenantScopeSchema,
    purpose: z.enum(["instance", "template"]),
    sourceTemplateRevisionRef: RevisionRefSchema.optional(),
    identity: WorkbenchIdentitySchema,
    supportedSurfaces: z.array(ProductSurfaceSchema).min(1),
    lifecycle: DeclarativeLifecycleSchema,
    routeClaims: z
      .array(
        z.union([
          DeclarativeRouteClaimSchema,
          LegacyDeclarativeRouteClaimSchema,
        ]),
      )
      .min(1),
    groups: z.array(WorkbenchGroupSchema).min(1),
    appInstances: z.array(WorkbenchAppInstanceSchema).min(1),
    defaultEntry: z
      .object({
        groupId: ContractIdentifierSchema,
        instanceId: ContractIdentifierSchema,
        showDefaultGroup: z.boolean(),
      })
      .strict(),
    layout: z
      .object({
        hostCapabilityRevisionRef: RevisionRefSchema,
        hostProviderRevisionRef: RevisionRefSchema,
        layoutPolicyRevisionRef: RevisionRefSchema,
        tokenRevisionRefs: z.array(RevisionRefSchema).min(1),
      })
      .strict(),
    workbenchAccessPolicy: AccessPolicySchema,
    managementAccess: ManagementAccessSchema,
    personalPreferencesPolicy: z
      .object({
        allowed: z.array(
          z.enum(["collapsed-groups", "recent-entry", "layout-density"]),
        ),
        authority: z.literal("identity-overlay"),
      })
      .strict(),
    performanceBudgetRef: RevisionRefSchema,
    observationPolicyRevisionRef: RevisionRefSchema,
    privacyClassification: z.enum([
      "public",
      "internal",
      "confidential",
      "restricted",
    ]),
  })
  .strict()
  .superRefine((value, context) => {
    validateDeclaredRouteSurfaces(
      value.supportedSurfaces,
      value.routeClaims,
      context,
    );
    if (value.purpose === "template" && value.sourceTemplateRevisionRef) {
      context.addIssue({
        code: "custom",
        path: ["sourceTemplateRevisionRef"],
        message: "Templates cannot derive from another template at runtime.",
      });
    }
    const duplicateGroup = uniqueArray(value.groups, (group) => group.groupId);
    if (duplicateGroup)
      context.addIssue({
        code: "custom",
        path: ["groups"],
        message: `Duplicate Workbench group: ${duplicateGroup}`,
      });
    const duplicateInstance = uniqueArray(
      value.appInstances,
      (instance) => instance.instanceId,
    );
    if (duplicateInstance)
      context.addIssue({
        code: "custom",
        path: ["appInstances"],
        message: `Duplicate Workbench instance: ${duplicateInstance}`,
      });
    const groupIds = new Set(value.groups.map((group) => group.groupId));
    value.appInstances.forEach((instance, index) => {
      if (!groupIds.has(instance.groupId))
        context.addIssue({
          code: "custom",
          path: ["appInstances", index, "groupId"],
          message: "Workbench app references an unknown group.",
        });
    });
    const defaultInstance = value.appInstances.find(
      (instance) => instance.instanceId === value.defaultEntry.instanceId,
    );
    if (
      !defaultInstance ||
      defaultInstance.groupId !== value.defaultEntry.groupId
    ) {
      context.addIssue({
        code: "custom",
        path: ["defaultEntry"],
        message:
          "Workbench default entry must reference an app in the declared group.",
      });
    }
    const targetKindByInstanceKind: Readonly<
      Record<z.infer<typeof WorkbenchAppInstanceSchema>["kind"], string>
    > = {
      "built-in-application": "built-in-application",
      "workflow-form": "workflow",
      workflow: "workflow",
      agent: "agent",
      design: "design",
      capability: "capability",
    };
    value.appInstances.forEach((instance, index) => {
      if (
        instance.targetRevisionRef.kind !==
        targetKindByInstanceKind[instance.kind]
      )
        context.addIssue({
          code: "custom",
          path: ["appInstances", index, "targetRevisionRef", "kind"],
          message: `Workbench ${instance.kind} target has an incompatible reference kind.`,
        });
      if (instance.providerRevisionRef.kind !== "view-provider")
        context.addIssue({
          code: "custom",
          path: ["appInstances", index, "providerRevisionRef", "kind"],
          message: "Workbench app provider must use kind view-provider.",
        });
      if (instance.inputSchemaRevisionRef.kind !== "schema")
        context.addIssue({
          code: "custom",
          path: ["appInstances", index, "inputSchemaRevisionRef", "kind"],
          message: "Workbench app input must pin a schema revision.",
        });
    });
    const layoutRefs: Array<
      [string, z.infer<typeof RevisionRefSchema>, string]
    > = [
      [
        "hostCapabilityRevisionRef",
        value.layout.hostCapabilityRevisionRef,
        "capability",
      ],
      [
        "hostProviderRevisionRef",
        value.layout.hostProviderRevisionRef,
        "view-provider",
      ],
      [
        "layoutPolicyRevisionRef",
        value.layout.layoutPolicyRevisionRef,
        "layout-policy",
      ],
    ];
    layoutRefs.forEach(([field, reference, expectedKind]) => {
      if (reference.kind !== expectedKind)
        context.addIssue({
          code: "custom",
          path: ["layout", field, "kind"],
          message: `${field} must reference ${expectedKind}.`,
        });
    });
    value.layout.tokenRevisionRefs.forEach((reference, index) => {
      if (reference.kind !== "design-token")
        context.addIssue({
          code: "custom",
          path: ["layout", "tokenRevisionRefs", index, "kind"],
          message: "Workbench token references must use kind design-token.",
        });
    });
  });
export const WorkbenchReleaseSchema = z
  .object({
    contract: z.literal("WorkbenchRelease"),
    ...ReleaseBaseShape,
    workbenchRevisionRef: RevisionRefSchema,
    target: z
      .object({
        environmentRef: StableRefSchema,
        surface: ProductSurfaceSchema,
        workbenchId: ContractIdentifierSchema,
        routeSpaceRevisionRef: RevisionRefSchema,
        normalizedPath: RoutePathTemplateSchema,
        routeClaim: z.union([
          CompiledRouteClaimSchema,
          LegacyCompiledRouteClaimSchema,
        ]),
        legacyRouteTakeoverAuthorization:
          LegacyRouteTakeoverAuthorizationSchema.optional(),
        order: z.number().int(),
        isDefaultCandidate: z.boolean(),
      })
      .strict(),
  })
  .strict()
  .superRefine((value, context) => {
    validateLegacyRestoration(value, "legacy-workbench-adapter", context);
    validateDependencySnapshot(value.dependencySnapshot, context);
    validateReleaseGovernanceScope(value, "workbench-release", context);
    if (value.workbenchRevisionRef.kind !== "workbench")
      context.addIssue({
        code: "custom",
        path: ["workbenchRevisionRef", "kind"],
        message: "Expected a workbench revision.",
      });
    if (value.target.environmentRef.kind !== "environment")
      context.addIssue({
        code: "custom",
        path: ["target", "environmentRef", "kind"],
        message: "Workbench release target requires an environment reference.",
      });
    if (value.target.routeSpaceRevisionRef.kind !== "route-space")
      context.addIssue({
        code: "custom",
        path: ["target", "routeSpaceRevisionRef", "kind"],
        message: "Workbench release target requires a route-space revision.",
      });
    validateReleaseRouteSurface(value.target, context);
    if (
      value.target.normalizedPath !== value.target.routeClaim.normalizedPath ||
      !exactRevisionRef(
        value.target.routeSpaceRevisionRef,
        value.target.routeClaim.routeSpaceRevisionRef,
      )
    ) {
      context.addIssue({
        code: "custom",
        path: ["target", "routeClaim"],
        message:
          "Workbench Release route authority must pin the exact compiled claim and normalized path.",
      });
    }
    const takeover = value.target.legacyRouteTakeoverAuthorization;
    if (
      takeover &&
      (value.target.routeClaim.kind !== "canonical" ||
        takeover.normalizedPath !== value.target.normalizedPath ||
        !exactRevisionRef(
          takeover.routeSpaceRevisionRef,
          value.target.routeSpaceRevisionRef,
        ) ||
        takeover.targetResourceRef.kind !== "workbench" ||
        takeover.targetResourceRef.id !== value.workbenchRevisionRef.id ||
        takeover.targetResourceRef.ownerRepo !==
          value.workbenchRevisionRef.ownerRepo)
    ) {
      context.addIssue({
        code: "custom",
        path: ["target", "legacyRouteTakeoverAuthorization"],
        message:
          "A Workbench route takeover must bind the exact canonical claim, RouteSpace and target Workbench.",
      });
    }
  });
const NavigationNodeBaseShape = {
  nodeId: ContractIdentifierSchema,
  parentNodeId: ContractIdentifierSchema.nullable(),
  order: z.number().int(),
  disabled: z.boolean().optional(),
};
export const NavigationGroupNodeSchema = z
  .object({
    ...NavigationNodeBaseShape,
    kind: z.literal("group"),
    label: I18nTextSchema,
    iconRef: StableRefSchema.optional(),
    collapsedByDefault: z.boolean(),
    audience: AccessPolicySchema,
  })
  .strict();
export const NavigationTargetNodeSchema = z
  .object({
    ...NavigationNodeBaseShape,
    kind: z.literal("target"),
    label: I18nTextSchema,
    iconRef: StableRefSchema.optional(),
    tone: z.enum(["default", "danger"]).optional(),
    targetRef: StableRefSchema,
    parameterMapping: z.record(ContractIdentifierSchema, BindingSourceSchema),
    audience: AccessPolicySchema,
  })
  .strict();
export const NavigationSeparatorNodeSchema = z
  .object({
    ...NavigationNodeBaseShape,
    kind: z.literal("separator"),
  })
  .strict();
export const NavigationNodeSchema = z.discriminatedUnion("kind", [
  NavigationGroupNodeSchema,
  NavigationTargetNodeSchema,
  NavigationSeparatorNodeSchema,
]);
const validateNavigationTree = (
  nodes: readonly z.infer<typeof NavigationNodeSchema>[],
  context: z.RefinementCtx,
) => {
  const byId = new Map<
    string,
    {
      node: z.infer<typeof NavigationNodeSchema>;
      index: number;
    }
  >();
  nodes.forEach((node, index) => {
    if (byId.has(node.nodeId))
      context.addIssue({
        code: "custom",
        path: ["nodes", index, "nodeId"],
        message: `Duplicate Navigation node: ${node.nodeId}`,
      });
    else byId.set(node.nodeId, { node, index });
  });
  const siblingOrders = new Set<string>();
  nodes.forEach((node, index) => {
    const orderKey = `${node.parentNodeId ?? ""}:${node.order}`;
    if (siblingOrders.has(orderKey))
      context.addIssue({
        code: "custom",
        path: ["nodes", index, "order"],
        message: "Sibling Navigation order values must be unique.",
      });
    siblingOrders.add(orderKey);
    if (node.parentNodeId) {
      const parent = byId.get(node.parentNodeId)?.node;
      if (!parent)
        context.addIssue({
          code: "custom",
          path: ["nodes", index, "parentNodeId"],
          message: "Navigation node has an unknown parent.",
        });
      else if (parent.kind !== "group")
        context.addIssue({
          code: "custom",
          path: ["nodes", index, "parentNodeId"],
          message: "Navigation parents must be groups.",
        });
    }
    const ancestors = new Set([node.nodeId]);
    let parentId = node.parentNodeId;
    while (parentId) {
      if (ancestors.has(parentId)) {
        context.addIssue({
          code: "custom",
          path: ["nodes", index, "parentNodeId"],
          message: `Navigation cycle contains ${node.nodeId}.`,
        });
        break;
      }
      ancestors.add(parentId);
      parentId = byId.get(parentId)?.node.parentNodeId ?? null;
    }
  });
};
export const NavigationSchema = z
  .object({
    contract: z.literal("Navigation"),
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
      if (
        node.kind === "target" &&
        !["page", "workbench", "menu-action", "domain-command"].includes(
          node.targetRef.kind,
        )
      ) {
        context.addIssue({
          code: "custom",
          path: ["nodes", index, "targetRef", "kind"],
          message:
            "Navigation targets must reference Page, Workbench, registered Menu Action, or DomainCommand identities.",
        });
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

/** A reviewed missing Page reference is retained without inventing an executable revision. */
export const UnavailableNavigationTargetSchema = z
  .object({
    nodeId: ContractIdentifierSchema,
    stableTargetRef: StableRefSchema.refine(
      (reference) => reference.kind === "page",
      "Only missing Pages can be isolated.",
    ),
    reason: z.literal("page-missing"),
    accessPolicy: AccessPolicySchema.nullable(),
  })
  .strict();

export const NavigationReleaseSchema = z
  .object({
    contract: z.literal("NavigationRelease"),
    ...ReleaseBaseShape,
    navigationRevisionRef: RevisionRefSchema,
    target: z
      .object({
        environmentRef: StableRefSchema,
        surface: ProductSurfaceSchema,
        placement: ContractIdentifierSchema,
      })
      .strict(),
    resolvedTargets: z.array(ResolvedNavigationTargetSchema),
    unavailableTargets: z.array(UnavailableNavigationTargetSchema).optional(),
  })
  .strict()
  .superRefine((value, context) => {
    validateLegacyRestoration(value, "legacy-navigation-adapter", context);
    validateDependencySnapshot(value.dependencySnapshot, context);
    validateReleaseGovernanceScope(value, "navigation-release", context);
    if (value.navigationRevisionRef.kind !== "navigation")
      context.addIssue({
        code: "custom",
        path: ["navigationRevisionRef", "kind"],
        message: "Expected a navigation revision.",
      });
    if (value.target.environmentRef.kind !== "environment")
      context.addIssue({
        code: "custom",
        path: ["target", "environmentRef", "kind"],
        message: "Navigation release target requires an environment reference.",
      });
    if (uniqueArray(value.resolvedTargets, (target) => target.nodeId))
      context.addIssue({
        code: "custom",
        path: ["resolvedTargets"],
        message: "Resolved Navigation node IDs must be unique.",
      });
    if (
      uniqueArray(
        [...value.resolvedTargets, ...(value.unavailableTargets ?? [])],
        (target) => target.nodeId,
      )
    ) {
      context.addIssue({
        code: "custom",
        path: ["unavailableTargets"],
        message: "Navigation target resolutions must have unique node IDs.",
      });
    }
  });
const RuntimeDiagnosticSchema = z
  .object({
    code: ContractIdentifierSchema,
    severity: z.enum(["info", "warning", "error"]),
    path: z.string().trim().min(1),
    message: z.string().trim().min(1),
  })
  .strict();
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
const validateRuntimeBundleReference = (
  reference: z.infer<typeof RevisionRefSchema>,
  tenantScope: z.infer<typeof TenantScopeSchema>,
  path: string,
  expectedKind: string,
  expectedId: string | undefined,
  context: z.RefinementCtx,
) => {
  if (reference.kind !== expectedKind) {
    context.addIssue({
      code: "custom",
      path: [path, "kind"],
      message: `${path} must reference ${expectedKind}.`,
    });
  }
  if (expectedId !== undefined && reference.id !== expectedId) {
    context.addIssue({
      code: "custom",
      path: [path, "id"],
      message: `${path} must identify ${expectedId}.`,
    });
  }
  validateTenantCompatibleReference(reference, tenantScope, [path], context);
};
const validateRuntimeBundleBase = (
  value: {
    tenantScope: z.infer<typeof TenantScopeSchema>;
    releaseRevisionRef: z.infer<typeof RevisionRefSchema>;
    compilerRevisionRef: z.infer<typeof RevisionRefSchema>;
  },
  expectedReleaseKind: string,
  context: z.RefinementCtx,
) => {
  validateRuntimeBundleReference(
    value.releaseRevisionRef,
    value.tenantScope,
    "releaseRevisionRef",
    expectedReleaseKind,
    undefined,
    context,
  );
  validateRuntimeBundleReference(
    value.compilerRevisionRef,
    value.tenantScope,
    "compilerRevisionRef",
    "compiler",
    undefined,
    context,
  );
};
export const DeclarativeRouteOwnerIndexEntrySchema = z
  .object({
    resourceKind: z.enum(["page", "workbench"]),
    releaseSlotId: ContractIdentifierSchema,
    activeReleaseRevisionRef: RevisionRefSchema,
    routeClaim: CompiledRouteClaimSchema,
    authority: z.enum(["declarative", "legacy", "unavailable"]),
    legacyRestoration: LegacySlotRestorationSchema.optional(),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.authority === "legacy" && !value.legacyRestoration) {
      context.addIssue({
        code: "custom",
        path: ["legacyRestoration"],
        message:
          "A restored legacy route must pin its exact inspected source and adapter revisions.",
      });
    }
    if (value.authority !== "legacy" && value.legacyRestoration) {
      context.addIssue({
        code: "custom",
        path: ["legacyRestoration"],
        message:
          "Only a restored legacy route can carry legacy restoration provenance.",
      });
    }
  });
export const DeclarativeRouteOwnerIndexSchema = z
  .object({
    contract: z.literal("DeclarativeRouteOwnerIndex"),
    schemaVersion: z.literal(DECLARATIVE_CONTROL_SCHEMA_VERSION),
    tenantScope: TenantScopeSchema,
    environmentRef: StableRefSchema,
    surface: ProductSurfaceSchema,
    generation: z.number().int().positive(),
    entries: z.array(DeclarativeRouteOwnerIndexEntrySchema).max(4096),
    contentHash: Sha256Schema,
    rebuildable: z.literal(true),
  })
  .strict()
  .superRefine((value, context) => {
    const identities = value.entries.map(
      (entry) => `${entry.resourceKind}:${entry.releaseSlotId}`,
    );
    if (new Set(identities).size !== identities.length) {
      context.addIssue({
        code: "custom",
        path: ["entries"],
        message: "Route owner index entries must be unique by Release slot.",
      });
    }
    if (
      identities.some(
        (identity, index) =>
          index > 0 && identities[index - 1].localeCompare(identity) > 0,
      )
    ) {
      context.addIssue({
        code: "custom",
        path: ["entries"],
        message:
          "Route owner index entries must use deterministic Release-slot order.",
      });
    }
  });
export const DeclarativeWorkbenchCatalogEntrySchema = z
  .object({
    workbenchId: ContractIdentifierSchema,
    authority: z.enum(["declarative", "legacy", "unavailable"]),
    identity: WorkbenchIdentitySchema,
    order: z.number().int(),
    isDefaultCandidate: z.boolean(),
    activeReleaseRevisionRef: RevisionRefSchema.optional(),
    legacyAdapterRevisionRef: RevisionRefSchema.optional(),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.authority === "declarative") {
      if (value.activeReleaseRevisionRef?.kind !== "workbench-release") {
        context.addIssue({
          code: "custom",
          path: ["activeReleaseRevisionRef"],
          message:
            "A declarative Workbench catalog entry requires an exact Workbench Release.",
        });
      }
      if (value.legacyAdapterRevisionRef) {
        context.addIssue({
          code: "custom",
          path: ["legacyAdapterRevisionRef"],
          message:
            "A declarative Workbench catalog entry cannot carry a legacy adapter.",
        });
      }
      return;
    }
    if (value.activeReleaseRevisionRef) {
      context.addIssue({
        code: "custom",
        path: ["activeReleaseRevisionRef"],
        message:
          "A non-declarative Workbench entry cannot expose a Workbench Release.",
      });
    }
    if (
      value.authority === "legacy" &&
      value.legacyAdapterRevisionRef?.kind !== "legacy-workbench-adapter"
    ) {
      context.addIssue({
        code: "custom",
        path: ["legacyAdapterRevisionRef"],
        message:
          "A legacy Workbench entry requires an exact legacy-workbench-adapter revision.",
      });
    }
    if (value.authority === "unavailable" && value.legacyAdapterRevisionRef) {
      context.addIssue({
        code: "custom",
        path: ["legacyAdapterRevisionRef"],
        message:
          "An unavailable Workbench entry cannot carry a legacy adapter.",
      });
    }
  });
export const DeclarativeWorkbenchCatalogSchema = z
  .object({
    contract: z.literal("DeclarativeWorkbenchCatalog"),
    schemaVersion: z.literal(DECLARATIVE_CONTROL_SCHEMA_VERSION),
    tenantScope: TenantScopeSchema,
    environmentRef: StableRefSchema,
    surface: ProductSurfaceSchema,
    generation: z.number().int().positive(),
    entries: z.array(DeclarativeWorkbenchCatalogEntrySchema).max(4096),
    contentHash: Sha256Schema,
    rebuildable: z.literal(true),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.environmentRef.kind !== "environment") {
      context.addIssue({
        code: "custom",
        path: ["environmentRef", "kind"],
        message: "A Workbench catalog requires an Environment reference.",
      });
    }
    const ids = value.entries.map((entry) => entry.workbenchId);
    if (new Set(ids).size !== ids.length) {
      context.addIssue({
        code: "custom",
        path: ["entries"],
        message: "Workbench catalog identities must be unique.",
      });
    }
    if (
      value.entries.filter(
        (entry) =>
          entry.authority !== "unavailable" && entry.isDefaultCandidate,
      ).length > 1
    ) {
      context.addIssue({
        code: "custom",
        path: ["entries"],
        message:
          "The effective Workbench catalog may have at most one default.",
      });
    }
    const sorted = [...value.entries].sort(
      (left, right) =>
        left.order - right.order ||
        left.workbenchId.localeCompare(right.workbenchId),
    );
    if (
      sorted.some(
        (entry, index) =>
          entry.workbenchId !== value.entries[index]?.workbenchId,
      )
    ) {
      context.addIssue({
        code: "custom",
        path: ["entries"],
        message:
          "Workbench catalog entries must use deterministic order plus Workbench identity.",
      });
    }
  });
const CompatiblePageRuntimeBundleSchema = z
  .object({
    contract: z.literal("PageRuntimeBundle"),
    ...RuntimeBundleBaseShape,
    pageId: ContractIdentifierSchema,
    pageRevisionRef: RevisionRefSchema,
    surface: ProductSurfaceSchema,
    routeClaims: z.array(CompiledRouteClaimSchema),
    routeStatePresentations: z
      .array(PageRouteStatePresentationSchema)
      .default([]),
    shellRevisionRef: RevisionRefSchema,
    shellDescriptor: DeclarativeRuntimeShellDescriptorSchema.optional(),
    renderTree: RenderTreeSchema,
    capabilityInstances: z.array(CapabilityInstanceSchema),
    deniedCapabilityInstanceIds: z.array(ContractIdentifierSchema).default([]),
    capabilityAccessEvaluated: z.literal(true).optional(),
    stateDefinitions: z.array(PageStateDefinitionSchema).default([]),
    entryTransitions: z.array(ResolvedPageEntryTransitionSchema).default([]),
    interactionBindings: z.array(InteractionBindingSchema).default([]),
    ontologyBindings: z.array(PersistedOntologyBindingSchema),
    queryBindings: z.array(QueryBindingSchema).default([]),
    actionBindings: z.array(ActionBindingSchema),
    pageAccessPolicy: AccessPolicySchema,
    tokenRevisionRefs: z.array(RevisionRefSchema),
    performanceBudgetRef: RevisionRefSchema,
    observationPolicyRevisionRef: RevisionRefSchema,
    privacyClassification: z.enum([
      "public",
      "internal",
      "confidential",
      "restricted",
    ]),
  })
  .strict()
  .superRefine((value, context) => {
    const instanceIds = new Set(
      value.capabilityInstances.map((instance) => instance.instanceId),
    );
    if (
      new Set(value.deniedCapabilityInstanceIds).size !==
        value.deniedCapabilityInstanceIds.length ||
      value.deniedCapabilityInstanceIds.some((id) => !instanceIds.has(id))
    ) {
      context.addIssue({
        code: "custom",
        path: ["deniedCapabilityInstanceIds"],
        message:
          "Denied capability identities must be unique declared instances.",
      });
    }
    validateRuntimeBundleBase(value, "page-release", context);
    value.routeClaims.forEach((claim, index) => {
      if (claim.surface !== value.surface) {
        context.addIssue({
          code: "custom",
          path: ["routeClaims", index, "surface"],
          message: "Runtime route claims must match the bundle surface.",
        });
      }
    });
    validateRuntimeBundleReference(
      value.pageRevisionRef,
      value.tenantScope,
      "pageRevisionRef",
      "page",
      value.pageId,
      context,
    );
    value.routeStatePresentations.forEach((presentation, index) => {
      if (presentation.surface !== value.surface) {
        context.addIssue({
          code: "custom",
          path: ["routeStatePresentations", index, "surface"],
          message:
            "Runtime route-state presentations must match the compiled Page surface.",
        });
      }
    });
  });
export const ResolvedWorkbenchAppInstanceSchema =
  WorkbenchAppInstanceSchema.extend({
    targetAccessPolicy: AccessPolicySchema,
  }).strict();
export const PageRuntimeBundleSchema =
  CompatiblePageRuntimeBundleSchema.safeExtend({
    shellDescriptor: DeclarativeRuntimeShellDescriptorSchema,
    ontologyBindings: z.array(OntologyBindingSchema),
  });

/** Pre-canonical releases have no Shell descriptor and retain their legacy bindings. */
export const LegacyPageRuntimeBundleSchema: z.ZodType<LegacyPageRuntimeBundle> =
  CompatiblePageRuntimeBundleSchema.safeExtend({
    shellDescriptor: z.never().optional(),
    ontologyBindings: z.array(LegacyOntologyBindingSchema),
  });

/** Transport readers accept either complete contract, never a mixed partial document. */
export const ReadablePageRuntimeBundleSchema: z.ZodType<PageRuntimeBundle | LegacyPageRuntimeBundle> = z.union([PageRuntimeBundleSchema, LegacyPageRuntimeBundleSchema]);

export const WorkbenchRuntimeIdentitySchema = z
  .object({
    name: I18nTextSchema,
    description: I18nTextSchema.optional(),
  })
  .strict();
const WorkbenchRuntimeTargetSchema = WorkbenchReleaseSchema.shape.target
  .safeExtend({
    routeClaim: CompiledRouteClaimSchema,
  })
  .strict();
export const WorkbenchRuntimeBundleSchema = z
  .object({
    contract: z.literal("WorkbenchRuntimeBundle"),
    ...RuntimeBundleBaseShape,
    workbenchId: ContractIdentifierSchema,
    workbenchRevisionRef: RevisionRefSchema,
    identity: WorkbenchRuntimeIdentitySchema,
    surface: ProductSurfaceSchema,
    routeClaims: z.array(CompiledRouteClaimSchema),
    groups: z.array(WorkbenchGroupSchema),
    appInstances: z.array(ResolvedWorkbenchAppInstanceSchema),
    defaultEntry: WorkbenchSchema.shape.defaultEntry.nullable(),
    layout: WorkbenchSchema.shape.layout,
    workbenchAccessPolicy: AccessPolicySchema,
    personalPreferencesPolicy: WorkbenchSchema.shape.personalPreferencesPolicy,
    target: WorkbenchRuntimeTargetSchema,
    performanceBudgetRef: RevisionRefSchema,
    observationPolicyRevisionRef: RevisionRefSchema,
    privacyClassification: z.enum([
      "public",
      "internal",
      "confidential",
      "restricted",
    ]),
  })
  .strict()
  .superRefine((value, context) => {
    validateRuntimeBundleBase(value, "workbench-release", context);
    value.routeClaims.forEach((claim, index) => {
      if (claim.surface !== value.surface) {
        context.addIssue({
          code: "custom",
          path: ["routeClaims", index, "surface"],
          message: "Runtime route claims must match the bundle surface.",
        });
      }
    });
    validateRuntimeBundleReference(
      value.workbenchRevisionRef,
      value.tenantScope,
      "workbenchRevisionRef",
      "workbench",
      value.workbenchId,
      context,
    );
    if (value.appInstances.length === 0) {
      if (value.defaultEntry !== null) {
        context.addIssue({
          code: "custom",
          path: ["defaultEntry"],
          message:
            "An empty Workbench runtime bundle must use a null default entry.",
        });
      }
      return;
    }
    if (value.defaultEntry === null) {
      context.addIssue({
        code: "custom",
        path: ["defaultEntry"],
        message:
          "A non-empty Workbench runtime bundle requires a default entry.",
      });
      return;
    }
    const defaultInstance = value.appInstances.find(
      (instance) => instance.instanceId === value.defaultEntry?.instanceId,
    );
    if (
      !defaultInstance ||
      defaultInstance.groupId !== value.defaultEntry.groupId
    ) {
      context.addIssue({
        code: "custom",
        path: ["defaultEntry"],
        message:
          "Workbench runtime default entry must reference a visible app in the declared group.",
      });
    }
    if (
      !value.groups.some(
        (group) => group.groupId === value.defaultEntry?.groupId,
      )
    ) {
      context.addIssue({
        code: "custom",
        path: ["defaultEntry", "groupId"],
        message:
          "Workbench runtime default entry must reference a visible group.",
      });
    }
  });
const CompiledNavigationTargetSchema = ResolvedNavigationTargetSchema.extend({
  kind: z.literal("route"),
  accessPolicy: AccessPolicySchema,
  routeClaim: CompiledRouteClaimSchema,
}).strict();
export const CompiledNavigationRegisteredMenuActionTargetSchema =
  ResolvedNavigationTargetSchema.extend({
    kind: z.literal("registered-menu-action"),
    accessPolicy: AccessPolicySchema,
    execution: z.literal("client"),
    applicationId: ContractIdentifierSchema,
    actionRef: ContractIdentifierSchema,
    inputSchemaRef: ContractIdentifierSchema.optional(),
    input: JsonObjectSchema,
    sourceCatalogRevisionRef: RevisionRefSchema,
  }).strict();
export const CompiledNavigationDomainCommandTargetSchema =
  ResolvedNavigationTargetSchema.extend({
    kind: z.literal("governed-domain-command"),
    accessPolicy: AccessPolicySchema,
    execution: z.literal("server"),
    commandRevisionRef: RevisionRefSchema,
    inputSchemaRevisionRef: RevisionRefSchema,
    resultSchemaRevisionRef: RevisionRefSchema.optional(),
    input: JsonObjectSchema,
  }).strict();
export const CompiledNavigationResolvedTargetSchema = z.discriminatedUnion(
  "kind",
  [
    CompiledNavigationTargetSchema,
    CompiledNavigationRegisteredMenuActionTargetSchema,
    CompiledNavigationDomainCommandTargetSchema,
    UnavailableNavigationTargetSchema.omit({ reason: true })
      .extend({ kind: z.literal("unavailable") })
      .strict(),
  ],
);
export const CompiledNavigationGroupNodeSchema =
  NavigationGroupNodeSchema.extend({
    ancestorAccessPolicies: z.array(AccessPolicySchema),
  }).strict();
export const CompiledNavigationTargetNodeSchema =
  NavigationTargetNodeSchema.extend({
    ancestorAccessPolicies: z.array(AccessPolicySchema),
    resolvedTarget: CompiledNavigationResolvedTargetSchema,
  })
    .strict()
    .superRefine((node, context) => {
      if (
        node.resolvedTarget.nodeId !== node.nodeId ||
        stableRefIdentity(node.resolvedTarget.stableTargetRef) !==
          stableRefIdentity(node.targetRef)
      ) {
        context.addIssue({
          code: "custom",
          path: ["resolvedTarget"],
          message: "Resolved target identity must match the source node.",
        });
      }
      if (
        node.resolvedTarget.kind === "unavailable" &&
        (node.disabled !== true ||
          Object.keys(node.parameterMapping).length > 0)
      ) {
        context.addIssue({
          code: "custom",
          path: ["resolvedTarget"],
          message:
            "Unavailable targets must be disabled and contain no executable input.",
        });
      }
    });

export const CompiledNavigationSeparatorNodeSchema =
  NavigationSeparatorNodeSchema.extend({
    ancestorAccessPolicies: z.array(AccessPolicySchema),
  }).strict();
export const CompiledNavigationNodeSchema = z.discriminatedUnion("kind", [
  CompiledNavigationGroupNodeSchema,
  CompiledNavigationTargetNodeSchema,
  CompiledNavigationSeparatorNodeSchema,
]);
export const NavigationRuntimeBundleSchema = z
  .object({
    contract: z.literal("NavigationRuntimeBundle"),
    ...RuntimeBundleBaseShape,
    navigationId: ContractIdentifierSchema,
    navigationRevisionRef: RevisionRefSchema,
    surface: ProductSurfaceSchema,
    placement: ContractIdentifierSchema,
    nodes: z.array(CompiledNavigationNodeSchema),
    performanceBudgetRef: RevisionRefSchema,
    observationPolicyRevisionRef: RevisionRefSchema,
  })
  .strict()
  .superRefine((value, context) => {
    validateRuntimeBundleBase(value, "navigation-release", context);
    validateRuntimeBundleReference(
      value.navigationRevisionRef,
      value.tenantScope,
      "navigationRevisionRef",
      "navigation",
      value.navigationId,
      context,
    );
  });
export const DeclarativeControlOntologyDefinitionSchema =
  OntologyDefinitionSchema.extend({
    classification: z.literal("control"),
    discovery: z
      .object({
        ordinaryDataBrowser: z.literal(false),
        businessSearch: z.literal(false),
        businessStatistics: z.literal(false),
        ordinaryExport: z.literal(false),
        genericWrite: z.literal(false),
      })
      .strict(),
  }).strict();
const controlDefinition = (ontologyId: string, bodySchemaRef: string) =>
  DeclarativeControlOntologyDefinitionSchema.parse({
    contract: "OntologyDefinition",
    ontologyId,
    dataSpaceId: "monkeys.control",
    ownerRepo: "monkeys-js-sdk",
    bodySchemaRef,
    authority: {
      service: "monkeys-data-server",
      storage: "domain-record",
      scope: "tenant",
    },
    relationKinds: [],
    metricKinds: [],
    classification: "control",
    discovery: {
      ordinaryDataBrowser: false,
      businessSearch: false,
      businessStatistics: false,
      ordinaryExport: false,
      genericWrite: false,
    },
  });
export const DECLARATIVE_CONTROL_ONTOLOGY_DEFINITIONS = Object.freeze([
  controlDefinition("monkeys.system.page", "monkeys.system.page/v1"),
  controlDefinition(
    "monkeys.system.page-release",
    "monkeys.system.page-release/v1",
  ),
  controlDefinition("monkeys.system.workbench", "monkeys.system.workbench/v1"),
  controlDefinition(
    "monkeys.system.workbench-release",
    "monkeys.system.workbench-release/v1",
  ),
  controlDefinition(
    "monkeys.system.navigation",
    "monkeys.system.navigation/v1",
  ),
  controlDefinition(
    "monkeys.system.navigation-release",
    "monkeys.system.navigation-release/v1",
  ),
]);
export type I18nText = z.infer<typeof I18nTextSchema>;
export type ProductSurface = z.infer<typeof ProductSurfaceSchema>;
export type ScopedIdentityRef = z.infer<typeof ScopedIdentityRefSchema>;
export type TenantScope = z.infer<typeof TenantScopeSchema>;
export type StableRef = z.infer<typeof StableRefSchema>;
export type RevisionRef = z.infer<typeof RevisionRefSchema>;
export type StableRefAliasMap = z.infer<typeof StableRefAliasMapSchema>;
export type AccessPolicy = z.infer<typeof AccessPolicySchema>;
export type PermissionAlternativePolicy = z.infer<
  typeof PermissionAlternativePolicySchema
>;
export type ManagementAccess = z.infer<typeof ManagementAccessSchema>;
export type RouteSpace = z.infer<typeof RouteSpaceSchema>;
export type RouteClaim = z.infer<typeof RouteClaimSchema>;
export type LegacyRouteClaim = z.infer<typeof LegacyRouteClaimSchema>;
export type DeclarativeRouteClaim =
  | z.infer<typeof DeclarativeRouteClaimSchema>
  | z.infer<typeof LegacyDeclarativeRouteClaimSchema>;
export type CompiledRouteClaim = z.infer<typeof CompiledRouteClaimSchema>;
export type CompiledRouteMatcher = z.infer<typeof CompiledRouteMatcherSchema>;
export type ReleaseDependency = z.infer<typeof ReleaseDependencySchema>;
export type ReleaseEvidence = z.infer<typeof ReleaseEvidenceSchema>;
export type PublicationPlanOperation = z.infer<
  typeof PublicationPlanOperationSchema
>;
export type PublicationPlan = z.infer<typeof PublicationPlanSchema>;
export type CapabilityInstance = z.infer<typeof CapabilityInstanceSchema>;
export type PageStateDefinition = z.infer<typeof PageStateDefinitionSchema>;
export type LegacyBrowserPreferenceImport = z.infer<
  typeof LegacyBrowserPreferenceImportSchema
>;
export type PageEntryTransition = z.infer<typeof PageEntryTransitionSchema>;
export type ResolvedPageEntryTransition = z.infer<
  typeof ResolvedPageEntryTransitionSchema
>;
export type InteractionBinding = z.infer<typeof InteractionBindingSchema>;
export type CursorWindowBinding = z.infer<typeof CursorWindowBindingSchema>;
export type OntologyBinding = z.infer<typeof OntologyBindingSchema>;
export type GovernedCatalogResourceKind = z.infer<
  typeof GovernedCatalogResourceKindSchema
>;
export type GovernedCatalogDomainQueryDataSource = z.infer<
  typeof GovernedCatalogDomainQueryDataSourceSchema
>;
export type RegisteredServiceDomainQueryDataSource = z.infer<
  typeof RegisteredServiceDomainQueryDataSourceSchema
>;
export type DomainQueryDataSource = z.infer<typeof DomainQueryDataSourceSchema>;
export type DomainQueryDefinition = z.infer<typeof DomainQueryDefinitionSchema>;
export type QueryBinding = z.infer<typeof QueryBindingSchema>;
export type QueryResultStateBinding = z.infer<
  typeof QueryResultStateBindingSchema
>;
export type ActionBinding = z.infer<typeof ActionBindingSchema>;
export type ActionResultBindingEffect = z.infer<
  typeof ActionResultBindingEffectSchema
>;
export type Page = z.infer<typeof PageSchema>;
export type ResolvedPage = z.infer<typeof ResolvedPageSchema>;
export type PageMigrationEquivalence = z.infer<
  typeof PageMigrationEquivalenceSchema
>;
export type PageRouteStatePresentation = z.infer<
  typeof PageRouteStatePresentationSchema
>;
export type PageRelease = z.infer<typeof PageReleaseSchema>;
export type Workbench = z.infer<typeof WorkbenchSchema>;
export type WorkbenchRelease = z.infer<typeof WorkbenchReleaseSchema>;
export type NavigationNode = z.infer<typeof NavigationNodeSchema>;
export type Navigation = z.infer<typeof NavigationSchema>;
export type ResolvedNavigationTarget = z.infer<
  typeof ResolvedNavigationTargetSchema
>;
export type CompiledNavigationResolvedTarget = z.infer<
  typeof CompiledNavigationResolvedTargetSchema
>;
export type NavigationRelease = z.infer<typeof NavigationReleaseSchema>;
export type DeclarativeShellHeaderChrome = z.infer<
  typeof DeclarativeShellHeaderChromeSchema
>;
export type DeclarativeShellSurfaceChrome = z.infer<
  typeof DeclarativeShellSurfaceChromeSchema
>;
export type DeclarativeRuntimeShellDescriptor = z.infer<
  typeof DeclarativeRuntimeShellDescriptorSchema
>;
export type LegacyPageRuntimeBundle = Omit<
  PageRuntimeBundle,
  "shellDescriptor" | "ontologyBindings"
> & {
  shellDescriptor?: never;
  ontologyBindings: z.infer<typeof LegacyOntologyBindingSchema>[];
};
export type PageRuntimeBundle = z.infer<typeof PageRuntimeBundleSchema>;
export type WorkbenchRuntimeBundle = z.infer<
  typeof WorkbenchRuntimeBundleSchema
>;
export type WorkbenchRuntimeIdentity = z.infer<
  typeof WorkbenchRuntimeIdentitySchema
>;
export type NavigationRuntimeBundle = z.infer<
  typeof NavigationRuntimeBundleSchema
>;
export type LegacyRouteTakeoverAuthorization = z.infer<
  typeof LegacyRouteTakeoverAuthorizationSchema
>;
export type DeclarativeRouteOwnerIndexEntry = z.infer<
  typeof DeclarativeRouteOwnerIndexEntrySchema
>;
export type DeclarativeRouteOwnerIndex = z.infer<
  typeof DeclarativeRouteOwnerIndexSchema
>;
export type DeclarativeWorkbenchCatalogEntry = z.infer<
  typeof DeclarativeWorkbenchCatalogEntrySchema
>;
export type DeclarativeWorkbenchCatalog = z.infer<
  typeof DeclarativeWorkbenchCatalogSchema
>;
export type DeclarativeControlOntologyDefinition = z.infer<
  typeof DeclarativeControlOntologyDefinitionSchema
>;

export type ActionResultClipboardEffect = z.infer<
  typeof ActionResultClipboardEffectSchema
>;
