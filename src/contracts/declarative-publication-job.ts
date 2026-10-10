import { z } from "zod";

import {
  DeclarativeBatchOperationIntentSchema,
  DeclarativePublicationResultSchema,
} from "./declarative-control-http";
import { DeclarativeDiagnosticSchema } from "./declarative-diagnostic";
import { ContractIdentifierSchema } from "./common";

const jobIdSchema = ContractIdentifierSchema.regex(/^job[.:][a-zA-Z0-9][a-zA-Z0-9._:-]*$/);

export const DeclarativePublicationJobOperationSchema = z
  .object({
    id: ContractIdentifierSchema,
    dependsOn: z.array(ContractIdentifierSchema).max(16),
    operation: DeclarativeBatchOperationIntentSchema,
  })
  .strict();

export const DeclarativePublicationJobManifestSchema = z
  .object({
    idempotencyKey: z.string().trim().min(1).max(256),
    expectedGeneration: z.number().int().nonnegative(),
    operations: z.array(DeclarativePublicationJobOperationSchema).min(1).max(128),
  })
  .strict();

export const DeclarativePublicationJobOperationStateSchema = z
  .object({
    id: ContractIdentifierSchema,
    status: z.enum(["queued", "running", "succeeded", "failed"]),
    attemptCount: z.number().int().nonnegative(),
    diagnostics: z.array(DeclarativeDiagnosticSchema).max(32),
    result: DeclarativePublicationResultSchema.optional(),
  })
  .strict();

export const DeclarativePublicationJobScopeSchema = z
  .object({
    tenantId: ContractIdentifierSchema,
    teamId: ContractIdentifierSchema.optional(),
    surfaces: z.array(z.enum(["kernel", "studio"])).max(2),
    environmentIds: z.array(ContractIdentifierSchema).max(128),
  })
  .strict();

export const DeclarativePublicationJobReconciliationSchema = z
  .object({
    requested: z.number().int().nonnegative(),
    succeeded: z.number().int().nonnegative(),
    failed: z.number().int().nonnegative(),
    pending: z.number().int().nonnegative(),
  })
  .strict();

export const DeclarativePublicationJobSchema = z
  .object({
    contract: z.literal("DeclarativePublicationJob"),
    schemaVersion: z.literal(1),
    jobId: jobIdSchema,
    status: z.enum(["queued", "running", "succeeded", "failed", "cancelled"]),
    manifest: DeclarativePublicationJobManifestSchema,
    operations: z.array(DeclarativePublicationJobOperationStateSchema).min(1).max(128),
    scope: DeclarativePublicationJobScopeSchema,
    generation: z.number().int().nonnegative(),
    reconciliation: DeclarativePublicationJobReconciliationSchema,
    diagnostics: z.array(DeclarativeDiagnosticSchema).max(64),
    createdAt: z.string().datetime({ offset: true }),
    updatedAt: z.string().datetime({ offset: true }),
  })
  .strict();

export type DeclarativePublicationJobOperation = z.infer<typeof DeclarativePublicationJobOperationSchema>;
export type DeclarativePublicationJobManifest = z.infer<typeof DeclarativePublicationJobManifestSchema>;
export type DeclarativePublicationJob = z.infer<typeof DeclarativePublicationJobSchema>;
