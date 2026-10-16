import { z } from "zod";
import {
  ActionProgramArtifactSchema,
  RevisionRefSchema,
} from "./declarative-control";
import { ContractIdentifierSchema, Sha256Schema } from "./common";

export const PrepareActionProgramRequestSchema = z
  .object({
    artifact: ActionProgramArtifactSchema,
    expectedVersion: z.number().int().min(0),
  })
  .strict();
export const RegisterActionProgramRequestSchema =
  PrepareActionProgramRequestSchema.extend({
    planHash: Sha256Schema,
    idempotencyKey: ContractIdentifierSchema,
  }).strict();
export const ReadActionProgramRequestSchema = z
  .object({ revisionRef: RevisionRefSchema })
  .strict();
export type PrepareActionProgramRequest = z.infer<
  typeof PrepareActionProgramRequestSchema
>;
export type RegisterActionProgramRequest = z.infer<
  typeof RegisterActionProgramRequestSchema
>;
