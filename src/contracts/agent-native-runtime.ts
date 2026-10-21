import { z } from "zod";

/** Product contracts. Native JSON-RPC and process control stay in the worker. */
export const AgentNativeRuntimeBindingSchema = z.object({
  engine: z.literal("app-server"),
  cliVersion: z.string().min(1),
  workerId: z.string().min(1),
  epoch: z.number().int().positive(),
});
export const AgentArtifactDeliverySchema = z.object({
  runId: z.string().min(1),
  status: z.enum(["pending", "uploading", "ready", "failed"]),
  error: z.string().optional(),
});
export const AgentNativeRecoverySchema = z.object({
  runId: z.string().min(1),
  state: z.enum(["reconciling", "uncertain"]),
  message: z.string(),
});
export const AgentNativeInteractionSchema = z.object({
  runId: z.string().min(1),
  requestId: z.union([z.string(), z.number().int()]),
  method: z.enum([
    "item/commandExecution/requestApproval",
    "item/fileChange/requestApproval",
    "item/permissions/requestApproval",
    "item/tool/requestUserInput",
    "mcpServer/elicitation/request",
  ]),
  params: z.record(z.string(), z.unknown()),
});
export const AgentNativeInteractionResponseSchema = z.object({
  commandId: z.string().min(1).max(256),
  runId: z.string().min(1),
  requestId: z.union([z.string(), z.number().int()]),
  result: z.unknown(),
});
export const AgentQuickStartIntentSchema = z.object({
  quickStartId: z.string().min(1),
  text: z.string(),
  /** Authorized Skill IDs, never a workflow ID or hidden execution plan. */
  skillIds: z.array(z.string()).optional(),
  attachmentUris: z.array(z.string()).default([]),
});
export type AgentNativeRuntimeBinding = z.infer<
  typeof AgentNativeRuntimeBindingSchema
>;
export type AgentArtifactDelivery = z.infer<typeof AgentArtifactDeliverySchema>;
export type AgentNativeRecovery = z.infer<typeof AgentNativeRecoverySchema>;
export type AgentNativeInteraction = z.infer<
  typeof AgentNativeInteractionSchema
>;
export type AgentNativeInteractionResponse = z.infer<
  typeof AgentNativeInteractionResponseSchema
>;
