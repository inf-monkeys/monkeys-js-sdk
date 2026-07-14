import { z } from 'zod';
import { ContractPortSchema } from './capability';
import {
  ContractIdentifierSchema,
  ContractMetadataSchema,
  JsonValueSchema,
} from './common';

export const WorkflowNodeSchema = z
  .object({
    id: ContractIdentifierSchema,
    referenceName: ContractIdentifierSchema,
    capabilityRef: ContractIdentifierSchema,
    capabilityVersion: ContractIdentifierSchema.optional(),
    inputBindings: z.record(z.string(), JsonValueSchema).default({}),
    configuration: z.record(z.string(), JsonValueSchema).default({}),
  })
  .strict();

export const WorkflowEdgeSchema = z
  .object({
    from: ContractIdentifierSchema,
    to: ContractIdentifierSchema,
    outputPort: ContractIdentifierSchema.optional(),
    inputPort: ContractIdentifierSchema.optional(),
    condition: z.string().optional(),
  })
  .strict();

export const WorkflowDefinitionSchema = z
  .object({
    contract: z.literal('WorkflowDefinition'),
    metadata: ContractMetadataSchema.extend({
      role: z.enum(['workflow', 'template']),
      teamId: ContractIdentifierSchema.optional(),
      creatorRef: ContractIdentifierSchema.optional(),
      tags: z.array(ContractIdentifierSchema).default([]),
    }).strict(),
    ports: z
      .object({
        inputs: z.array(ContractPortSchema).default([]),
        outputs: z.array(ContractPortSchema).default([]),
      })
      .strict(),
    graph: z
      .object({
        nodes: z.array(WorkflowNodeSchema),
        edges: z.array(WorkflowEdgeSchema).default([]),
      })
      .strict(),
    execution: z
      .object({
        timeoutMs: z.number().int().positive().optional(),
        retries: z.number().int().nonnegative().default(0),
        concurrencyLimit: z.number().int().positive().optional(),
        idempotency: z.enum(['required', 'supported', 'none']),
        rateLimit: z
          .object({
            max: z.number().int().positive(),
            windowMs: z.number().int().positive(),
          })
          .optional(),
      })
      .strict(),
    triggers: z
      .array(
        z
          .object({
            id: ContractIdentifierSchema,
            type: z.enum(['manual', 'schedule', 'webhook', 'event']),
            configuration: z.record(z.string(), JsonValueSchema).default({}),
          })
          .strict(),
      )
      .default([]),
    views: z
      .array(
        z
          .object({
            pageRef: ContractIdentifierSchema,
            placement: ContractIdentifierSchema.optional(),
          })
          .strict(),
      )
      .default([]),
    dataContracts: z
      .object({
        reads: z.array(ContractIdentifierSchema).default([]),
        writes: z.array(ContractIdentifierSchema).default([]),
        emits: z.array(ContractIdentifierSchema).default([]),
      })
      .strict(),
  })
  .strict()
  .superRefine((definition, context) => {
    const nodeIds = new Set(definition.graph.nodes.map((node) => node.id));
    if (nodeIds.size !== definition.graph.nodes.length) {
      context.addIssue({
        code: 'custom',
        path: ['graph', 'nodes'],
        message: 'Workflow node ids must be unique.',
      });
    }

    definition.graph.edges.forEach((edge, index) => {
      if (!nodeIds.has(edge.from) || !nodeIds.has(edge.to)) {
        context.addIssue({
          code: 'custom',
          path: ['graph', 'edges', index],
          message: 'Workflow edges must reference existing node ids.',
        });
      }
    });
  });

export type WorkflowNode = z.infer<typeof WorkflowNodeSchema>;
export type WorkflowEdge = z.infer<typeof WorkflowEdgeSchema>;
export type WorkflowDefinition = z.infer<typeof WorkflowDefinitionSchema>;
