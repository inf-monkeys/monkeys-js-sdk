import { z } from "zod";
import type {
  AskForApproval,
  SandboxMode,
  UserInput,
} from "../codex-app-server";

/**
 * Core → Worker dispatch for Work sessions.
 *
 * Core decides everything that is authorization: model, upstream key, MCP
 * servers, Skill revisions. The Worker decides only what depends on its local
 * state (start vs. resume, process restart) and maps the command onto the
 * App Server's own thread/turn methods.
 */
export const AGENT_WORK_CONTRACT_VERSION = "agent-work/1" as const;

const SAFE_NAME = /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}$/;
const SHA256 = /^[a-f0-9]{64}$/;

/** Immutable Skill revision. The Worker fetches the archive by its hash once and caches it. */
export const AgentWorkSkillRefSchema = z.object({
  id: z.string().min(1),
  name: z.string().regex(SAFE_NAME),
  description: z.string(),
  sha256: z.string().regex(SHA256),
  requiredMcpServers: z.array(z.string().regex(SAFE_NAME)).default([]),
});

export const AgentWorkCliPackageSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    package: z.record(z.string(), z.unknown()),
    authentication: z.unknown().optional(),
  })
  .passthrough();

export const AgentWorkInputFileSchema = z.object({
  path: z.string().regex(/^inputs\/[^/][^\0]*$/),
  contentBase64: z.string(),
});

export const AgentWorkCheckpointRefSchema = z
  .object({
    uri: z.string().min(1),
    checksum: z.string().regex(SHA256),
    size: z.number().int().nonnegative(),
    cliVersion: z.string().min(1),
    nativeThreadId: z.string().optional(),
    lastSequence: z.number().int(),
  })
  .passthrough();

export const AgentWorkSessionSchema = z.object({
  sessionId: z.string().min(1),
  teamId: z.string().min(1),
  epoch: z.number().int().positive(),
  /** Run capability for ② events and ④ MCP. Never used for the model. */
  token: z.string().min(1),
  /** Selected model's upstream key. Lives only in the session process environment. */
  modelKey: z.string().min(1),
  skills: z.array(AgentWorkSkillRefSchema).default([]),
  files: z.array(AgentWorkInputFileSchema).default([]),
  cliPackages: z.array(AgentWorkCliPackageSchema).default([]),
  cliAuthorization: z.string().optional(),
  fileCapability: z.string().optional(),
  fileControlPlaneUrl: z.string().optional(),
  nativeThreadId: z.string().nullish(),
  checkpoint: AgentWorkCheckpointRefSchema.nullish(),
  requireExisting: z.boolean().optional(),
});

export const AgentWorkTurnCommandSchema = z.object({
  sessionId: z.string().min(1),
  teamId: z.string().min(1),
  epoch: z.number().int().positive(),
  commandId: z.string().min(1).max(256),
  runId: z.string().min(1),
  sourceMessageId: z.string().min(1),
  initialSessionSequence: z.number().int().nonnegative(),
  userMessage: z.record(z.string(), z.unknown()).optional(),
  historyReconstruction: z.boolean().optional(),
  replaySourceMessageId: z.string().optional(),
  input: z.array(z.custom<UserInput>((value) => !!value && typeof value === "object")),
  model: z.string().min(1),
  effort: z.string().optional(),
  developerInstructions: z.string(),
  approvalPolicy: z.custom<AskForApproval>((value) => value !== undefined),
  sandbox: z.custom<SandboxMode>((value) => typeof value === "string"),
  /** App Server config overrides (endpoints and env-var names only, never keys). */
  config: z.record(z.string(), z.unknown()),
  configRevision: z.string().min(1),
});

export const AgentWorkDispatchSchema = z.object({
  contractVersion: z.literal(AGENT_WORK_CONTRACT_VERSION),
  session: AgentWorkSessionSchema,
  command: AgentWorkTurnCommandSchema,
});

/** Errors the Worker returns when it refuses a dispatch. */
export const AgentWorkErrorCodeSchema = z.enum([
  "CONTRACT_UNSUPPORTED",
  "EPOCH_FENCED",
  "CAPACITY_QUEUED",
  "RUN_UNCERTAIN",
]);

export type AgentWorkSkillRef = z.infer<typeof AgentWorkSkillRefSchema>;
export type AgentWorkCliPackage = z.infer<typeof AgentWorkCliPackageSchema>;
export type AgentWorkInputFile = z.infer<typeof AgentWorkInputFileSchema>;
export type AgentWorkCheckpointRef = z.infer<typeof AgentWorkCheckpointRefSchema>;
export type AgentWorkSession = z.infer<typeof AgentWorkSessionSchema>;
export type AgentWorkTurnCommand = z.infer<typeof AgentWorkTurnCommandSchema>;
export type AgentWorkDispatch = z.infer<typeof AgentWorkDispatchSchema>;
export type AgentWorkErrorCode = z.infer<typeof AgentWorkErrorCodeSchema>;
