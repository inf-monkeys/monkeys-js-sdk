import { z } from "zod";
import { ContractIdentifierSchema, Sha256Schema } from "./common";
import {
  NavigationSchema,
  PageSchema,
  ProductSurfaceSchema,
  RevisionRefSchema,
  TenantScopeSchema,
} from "./declarative-control";

const sameScope = (
  left: z.infer<typeof TenantScopeSchema>,
  right: z.infer<typeof TenantScopeSchema>,
): boolean =>
  (["tenantRef", "dataSpaceRef", "teamRef"] as const).every(
    (key) =>
      left[key]?.kind === right[key]?.kind &&
      left[key]?.id === right[key]?.id &&
      left[key]?.ownerRepo === right[key]?.ownerRepo,
  );

export const DeclarativeImportDocumentSchema = z.union([
  PageSchema,
  NavigationSchema,
]);

const requestShape = {
  document: DeclarativeImportDocumentSchema,
  surface: ProductSurfaceSchema,
  environmentId: ContractIdentifierSchema.optional(),
};

function supportsSurface(value: {
  document: z.infer<typeof DeclarativeImportDocumentSchema>;
  surface: "kernel" | "studio";
}): boolean {
  return value.document.contract === "Page"
    ? value.document.surface === value.surface
    : value.document.supportedSurfaces.includes(value.surface);
}

export const DeclarativeDocumentImportRequestSchema = z
  .object(requestShape)
  .strict()
  .refine(supportsSurface, {
    path: ["surface"],
    message: "The document does not support the selected surface.",
  });

export const DeclarativeDocumentImportIntentSchema = z
  .object({
    ...requestShape,
    expectedVersion: z.number().int().nonnegative(),
    expectedPlanHash: Sha256Schema,
    idempotencyKey: z.string().trim().min(1).max(256),
  })
  .strict()
  .refine(supportsSurface, {
    path: ["surface"],
    message: "The document does not support the selected surface.",
  });

export const DeclarativeDocumentImportPlanSchema = z
  .object({
    contract: z.literal("DeclarativeDocumentImportPlan"),
    schemaVersion: z.literal(1),
    resourceKind: z.enum(["page", "navigation"]),
    resourceId: ContractIdentifierSchema,
    surface: ProductSurfaceSchema,
    sourceContentHash: Sha256Schema,
    environmentRevisionRef: RevisionRefSchema,
    document: DeclarativeImportDocumentSchema,
    tenantScope: TenantScopeSchema.nullable(),
    requiresInitialization: z.boolean(),
    expectedVersion: z.number().int().nonnegative(),
    currentContentHash: Sha256Schema.nullable(),
    changed: z.boolean(),
    diagnostics: z.array(
      z
        .object({
          code: z.string().min(1),
          path: z.string(),
          message: z.string(),
          blocking: z.boolean(),
        })
        .strict(),
    ),
    dependencyContentHash: Sha256Schema,
    planHash: Sha256Schema,
  })
  .strict()
  .superRefine((value, context) => {
    const kind = value.document.contract === "Page" ? "page" : "navigation";
    const id =
      value.document.contract === "Page"
        ? value.document.pageId
        : value.document.navigationId;
    if (
      kind !== value.resourceKind ||
      id !== value.resourceId ||
      !supportsSurface(value)
    )
      context.addIssue({
        code: "custom",
        path: ["document"],
        message: "The plan must identify its document and supported surface.",
      });
    if (value.requiresInitialization !== (value.tenantScope === null))
      context.addIssue({
        code: "custom",
        path: ["requiresInitialization"],
        message: "Only an uninitialized target may omit tenantScope.",
      });
    if (value.environmentRevisionRef.kind !== "environment")
      context.addIssue({
        code: "custom",
        path: ["environmentRevisionRef"],
        message: "The import plan must pin an environment revision.",
      });
    if (
      value.tenantScope &&
      !sameScope(value.tenantScope, value.document.tenantScope)
    )
      context.addIssue({
        code: "custom",
        path: ["tenantScope"],
        message: "The plan and bound document must belong to the same scope.",
      });
  });

export const DeclarativeDocumentImportResultSchema = z
  .object({
    action: z.literal("import"),
    changed: z.boolean(),
    plan: DeclarativeDocumentImportPlanSchema,
    revisionRef: RevisionRefSchema,
  })
  .strict()
  .superRefine((value, context) => {
    if (
      value.changed !== value.plan.changed ||
      value.revisionRef.kind !== value.plan.resourceKind ||
      value.revisionRef.id !== value.plan.resourceId ||
      value.revisionRef.revision !==
        value.plan.expectedVersion + Number(value.changed) ||
      !value.revisionRef.tenantScope ||
      !sameScope(value.revisionRef.tenantScope, value.plan.document.tenantScope)
    ) {
      context.addIssue({
        code: "custom",
        path: ["revisionRef"],
        message:
          "The import result must identify the exact saved or unchanged draft revision.",
      });
    }
  });

export type DeclarativeImportDocument = z.infer<
  typeof DeclarativeImportDocumentSchema
>;
export type DeclarativeDocumentImportRequest = z.infer<
  typeof DeclarativeDocumentImportRequestSchema
>;
export type DeclarativeDocumentImportIntent = z.infer<
  typeof DeclarativeDocumentImportIntentSchema
>;
export type DeclarativeDocumentImportPlan = z.infer<
  typeof DeclarativeDocumentImportPlanSchema
>;
export type DeclarativeDocumentImportResult = z.infer<
  typeof DeclarativeDocumentImportResultSchema
>;
