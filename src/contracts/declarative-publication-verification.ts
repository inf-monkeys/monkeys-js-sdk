import { z } from "zod";
import { ContractIdentifierSchema } from "./common";
import { RevisionRefSchema } from "./declarative-control";
import { DeclarativeDiagnosticSchema } from "./declarative-diagnostic";

/** Authoring target selection is independent of the authenticated business Team. */
export const DECLARATIVE_PUBLICATION_SCOPE_HEADER = "x-monkeys-declarative-scope";
export const DECLARATIVE_PUBLICATION_SURFACE_HEADER = "x-monkeys-declarative-surface";
export const DeclarativePublicationScopeSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("global") }).strict(),
  z.object({
    kind: z.literal("team"),
    teamId: ContractIdentifierSchema.refine((value) => value !== "0", "Use global scope for the reserved namespace."),
  }).strict(),
]);
export type DeclarativePublicationScope = z.infer<typeof DeclarativePublicationScopeSchema>;

export const DeclarativePublicationVerificationRequestSchema = z.object({
  resourceKind: z.enum(["page", "navigation", "workbench"]),
  resourceId: ContractIdentifierSchema,
  releaseSlotId: ContractIdentifierSchema,
  releaseVersion: z.number().int().positive().optional(),
  expectedReleaseRevisionRef: RevisionRefSchema.optional(),
  expectedDefinitionRevisionRef: RevisionRefSchema.optional(),
  idempotencyKey: z.string().trim().min(1).max(256).optional(),
  audience: z.object({
    teamId: ContractIdentifierSchema.optional(),
    path: z.string().trim().min(1).max(4096).optional(),
  }).strict().optional(),
}).strict();
export type DeclarativePublicationVerificationRequest = z.infer<typeof DeclarativePublicationVerificationRequestSchema>;

export const DeclarativePublicationVerificationSchema = z.object({
  contract: z.literal("DeclarativePublicationVerification"),
  schemaVersion: z.literal(1),
  resourceKind: z.enum(["page", "navigation", "workbench"]),
  resourceId: ContractIdentifierSchema,
  scope: DeclarativePublicationScopeSchema,
  publication: z.enum(["committed", "unknown"]),
  activation: z.enum(["active", "superseded", "deactivated", "unavailable"]),
  integrity: z.enum(["verified", "unverified", "failed"]),
  runtime: z.enum(["not-requested", "verified", "context-required", "forbidden", "failed"]),
  retryable: z.boolean().default(false),
  releaseRevisionRef: RevisionRefSchema.optional(),
  definitionRevisionRef: RevisionRefSchema.optional(),
  runtimeContentHash: z.string().regex(/^[a-f0-9]{64}$/).optional(),
  requestId: z.string().max(256).optional(),
  diagnostics: z.array(DeclarativeDiagnosticSchema).max(32),
}).strict().superRefine((value, context) => {
  if ((value.integrity === "verified" || value.runtime === "verified") &&
      (value.publication !== "committed" || value.activation !== "active" || !value.releaseRevisionRef || !value.definitionRevisionRef)) {
    context.addIssue({ code: "custom", path: ["integrity"], message: "Verification requires an exact committed active Release and definition." });
  }
  if (value.runtime === "verified" && value.integrity !== "verified") {
    context.addIssue({ code: "custom", path: ["runtime"], message: "Audience verification requires publication integrity." });
  }
});
export type DeclarativePublicationVerification = z.infer<typeof DeclarativePublicationVerificationSchema>;
