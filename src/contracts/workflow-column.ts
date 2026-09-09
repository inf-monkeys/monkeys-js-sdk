import { z } from 'zod';
import { ContractIdentifierSchema, JsonValueSchema, Sha256Schema } from './common';

export const WorkflowColumnFieldRefSchema = z
  .object({
    ontologyId: ContractIdentifierSchema,
    fieldKey: ContractIdentifierSchema,
  })
  .strict();

export const WorkflowColumnInputSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('default') }).strict(),
  z.object({ kind: z.literal('constant'), value: JsonValueSchema }).strict(),
  z.object({ kind: z.literal('field'), field: WorkflowColumnFieldRefSchema }).strict(),
  z
    .object({
      kind: z.literal('context'),
      field: z.enum(['assetId', 'teamId', 'ontologyId', 'columnId']),
    })
    .strict(),
]);

export const WorkflowColumnDependencySchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('field'), field: WorkflowColumnFieldRefSchema }).strict(),
  z
    .object({
      kind: z.literal('relation'),
      relation: WorkflowColumnFieldRefSchema,
      direction: z.enum(['incoming', 'outgoing']),
      fields: z.array(WorkflowColumnFieldRefSchema).max(100),
    })
    .strict(),
]);

// Paths are literal own-property segments, never executable JSONPath expressions.
export const WorkflowColumnOutputPathSchema = z.array(z.string().min(1).max(256)).max(20);
export const WorkflowColumnOutputSchema = z
  .object({
    type: z.enum(['number', 'text', 'json']),
    path: WorkflowColumnOutputPathSchema,
    nullable: z.boolean().default(false),
  })
  .strict();

export const WorkflowColumnBindingSchema = z
  .object({
    contract: z.literal('WorkflowColumnBinding'),
    version: z.literal(1),
    enabled: z.boolean(),
    paused: z.boolean().default(false),
    workflow: z
      .object({
        id: ContractIdentifierSchema,
        version: z.number().int().positive(),
        inputSchemaHash: Sha256Schema,
      })
      .strict(),
    inputs: z.record(z.string().min(1).max(128), WorkflowColumnInputSchema),
    dependencies: z.array(WorkflowColumnDependencySchema).max(100).default([]),
    output: WorkflowColumnOutputSchema,
    policy: z
      .object({
        debounceMs: z.number().int().min(0).max(30_000).default(5000),
        maxDelayMs: z.number().int().min(0).max(30_000).default(30_000),
        concurrency: z.number().int().min(1).max(32).default(2),
        // Indexed queries need visible projections of their declared sources before execution.
        requireSearchProjection: z.boolean().optional(),
      })
      .strict()
      .default({ debounceMs: 5000, maxDelayMs: 30_000, concurrency: 2 }),
    // The workflow supplies an ISO datetime with offset for one future expiry.
    // Scheduling infrastructure needs no knowledge of months or business periods.
    expiry: z.object({ path: WorkflowColumnOutputPathSchema }).strict().optional(),
  })
  .strict();

export type WorkflowColumnBinding = z.infer<typeof WorkflowColumnBindingSchema>;
export type WorkflowColumnInput = z.infer<typeof WorkflowColumnInputSchema>;
export type WorkflowColumnDependency = z.infer<typeof WorkflowColumnDependencySchema>;
export type WorkflowColumnFieldRef = z.infer<typeof WorkflowColumnFieldRefSchema>;
