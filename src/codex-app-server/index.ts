/**
 * Codex App Server protocol types for the pinned CLI.
 *
 * `protocol/` is the unmodified output of `codex app-server generate-ts` for
 * codex-cli 0.160.1. Regenerate it with `node scripts/generate-codex-app-server.cjs`
 * when the Worker's CLI version changes; never edit the generated files.
 */
export const CODEX_APP_SERVER_CLI_VERSION = "0.160.1" as const;

export * from "./protocol";
export type {
  AskForApproval,
  CommandExecutionOutputDeltaNotification,
  AgentMessageDeltaNotification,
  ItemCompletedNotification,
  ItemStartedNotification,
  SandboxMode,
  ThreadItem,
  ThreadResumeParams,
  ThreadStartParams,
  TurnInterruptParams,
  TurnStartParams,
  TurnSteerParams,
  UserInput,
} from "./protocol/v2";
