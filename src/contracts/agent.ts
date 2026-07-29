import { z } from 'zod';

export const AgentExecutionModeSchema = z.enum(['chatbot', 'agent']);

export const AgentSessionCapabilitiesSchema = z
  .object({
    text: z.boolean().default(true),
    tools: z.boolean().default(false),
    mcp: z.boolean().default(false),
    shell: z.boolean().default(false),
    fileChange: z.boolean().default(false),
    approval: z.boolean().default(false),
    skills: z.boolean().default(false),
    artifacts: z.boolean().default(false),
  })
  .strict();

export const AgentSessionSnapshotSchema = z
  .object({
    mode: AgentExecutionModeSchema,
    modelId: z.string().trim().min(1),
    capabilities: AgentSessionCapabilitiesSchema,
  })
  .strict();

export type AgentExecutionMode = z.infer<typeof AgentExecutionModeSchema>;
export type AgentSessionCapabilities = z.infer<typeof AgentSessionCapabilitiesSchema>;
export type AgentSessionSnapshot = z.infer<typeof AgentSessionSnapshotSchema>;

export function normalizeAgentExecutionMode(value: unknown): AgentExecutionMode | undefined {
  const normalized = String(value ?? '')
    .trim()
    .toLowerCase();
  if (normalized === 'agent' || normalized === 'codex') return 'agent';
  if (normalized === 'chatbot' || normalized === 'vercel-ai' || normalized === 'vercel' || normalized === 'ai-sdk') {
    return 'chatbot';
  }
  return undefined;
}
