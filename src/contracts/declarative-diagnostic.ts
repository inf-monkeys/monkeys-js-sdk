import { z } from "zod";
import { ContractIdentifierSchema } from "./common";

/**
 * A diagnostic is deliberately shared by document preflight, publication
 * preparation, and runtime verification.  The optional fields keep the
 * contract wire-compatible while older producers migrate to the complete
 * shape.
 */
export const DeclarativeDiagnosticStageSchema = z.enum([
  "document",
  "reference",
  "contract",
  "policy",
  "runtime",
]);

export const DeclarativeDiagnosticSchema = z
  .object({
    code: ContractIdentifierSchema,
    stage: DeclarativeDiagnosticStageSchema.optional(),
    severity: z.enum(["info", "warning", "error"]).optional(),
    blocking: z.boolean().optional(),
    path: z.string().trim().min(1),
    message: z.string().trim().min(1),
    recovery: z.array(z.string().trim().min(1)).max(8).optional(),
  })
  .strict();

export type DeclarativeDiagnostic = z.infer<typeof DeclarativeDiagnosticSchema>;
