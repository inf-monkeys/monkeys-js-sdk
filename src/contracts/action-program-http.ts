import { z } from "zod";
import {
  ActionProgramArtifactSchema,
  RevisionRefSchema,
} from "./declarative-control";
import { DeclarativeRuntimeActionExecuteIntentSchema, DeclarativeNativeDownloadSchema } from "./declarative-control-http";
import { ContractIdentifierSchema, Sha256Schema, JsonObjectSchema } from "./common";

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

/** No persistent run: the original event is re-authorized against the exact Page on every call. */
export const RuntimeProgramLoadRequestSchema = z.object({
  context: DeclarativeRuntimeActionExecuteIntentSchema,
}).strict();
export const RuntimeProgramCallRequestSchema = RuntimeProgramLoadRequestSchema.extend({
  kind: z.enum(["query", "command"]),
  dependencyId: ContractIdentifierSchema,
  args: JsonObjectSchema,
  stepKey: z.string().min(1).max(128),
  recoveryOnly: z.literal(true).optional(),
}).strict();
export const RuntimeProgramLoadResultSchema = z.object({
  artifact: ActionProgramArtifactSchema,
  input: JsonObjectSchema,
  schemas: z.array(z.object({ revisionRef: RevisionRefSchema, document: JsonObjectSchema }).strict()).max(512),
}).strict();
export const RuntimeProgramCallResultSchema = z.object({ value: JsonObjectSchema }).strict();
export type RuntimeProgramLoadRequest = z.infer<typeof RuntimeProgramLoadRequestSchema>;
export type RuntimeProgramCallRequest = z.infer<typeof RuntimeProgramCallRequestSchema>;
export type RuntimeProgramLoadResult = z.infer<typeof RuntimeProgramLoadResultSchema>;

export const RuntimeProgramDownloadResultSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("native"), download: DeclarativeNativeDownloadSchema }).strict(),
  z.object({ kind: z.literal("text-artifact"), fileName: z.string().min(1).max(255), mimeType: z.enum(["application/json", "text/plain", "text/csv"]), content: z.string().max(1048576) }).strict(),
]);
