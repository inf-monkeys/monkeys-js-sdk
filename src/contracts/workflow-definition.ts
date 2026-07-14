import { z } from 'zod';
import { ContractPortV1Schema } from './capability';
import {
  ContractIdentifierSchema,
  ContractMetadataSchema,
  JsonValueSchema,
} from './common';

export const WorkflowNodeV2Schema = z
  .object({
    id: ContractIdentifierSchema,
    referenceName: ContractIdentifierSchema,
    capabilityRef: ContractIdentifierSchema,
    capabilityVersion: ContractIdentifierSchema.optional(),
    inputBindings: z.record(z.string(), JsonValueSchema).default({}),
    configuration: z.record(z.string(), JsonValueSchema).default({}),
  })
  .catchall(JsonValueSchema);

export const WorkflowEdgeV2Schema = z
  .object({
    from: ContractIdentifierSchema,
    to: ContractIdentifierSchema,
    outputPort: ContractIdentifierSchema.optional(),
    inputPort: ContractIdentifierSchema.optional(),
    condition: z.string().optional(),
  })
  .catchall(JsonValueSchema);

export const WorkflowDefinitionV2Schema = z
  .object({
    contract: z.literal('WorkflowDefinition'),
    version: z.literal(2),
    metadata: ContractMetadataSchema.extend({
      role: z.enum(['workflow', 'template']),
      teamId: ContractIdentifierSchema.optional(),
      creatorRef: ContractIdentifierSchema.optional(),
      tags: z.array(ContractIdentifierSchema).default([]),
    }).catchall(JsonValueSchema),
    ports: z
      .object({
        inputs: z.array(ContractPortV1Schema).default([]),
        outputs: z.array(ContractPortV1Schema).default([]),
      })
      .catchall(JsonValueSchema),
    graph: z
      .object({
        nodes: z.array(WorkflowNodeV2Schema),
        edges: z.array(WorkflowEdgeV2Schema).default([]),
      })
      .catchall(JsonValueSchema),
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
      .catchall(JsonValueSchema),
    triggers: z
      .array(
        z
          .object({
            id: ContractIdentifierSchema,
            type: z.enum(['manual', 'schedule', 'webhook', 'event']),
            configuration: z.record(z.string(), JsonValueSchema).default({}),
          })
          .catchall(JsonValueSchema),
      )
      .default([]),
    views: z
      .array(
        z
          .object({
            pageRef: ContractIdentifierSchema,
            placement: ContractIdentifierSchema.optional(),
          })
          .catchall(JsonValueSchema),
      )
      .default([]),
    dataContracts: z
      .object({
        reads: z.array(ContractIdentifierSchema).default([]),
        writes: z.array(ContractIdentifierSchema).default([]),
        emits: z.array(ContractIdentifierSchema).default([]),
      })
      .catchall(JsonValueSchema),
  })
  .catchall(JsonValueSchema)
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

export type WorkflowNodeV2 = z.infer<typeof WorkflowNodeV2Schema>;
export type WorkflowEdgeV2 = z.infer<typeof WorkflowEdgeV2Schema>;
export type WorkflowDefinitionV2 = z.infer<typeof WorkflowDefinitionV2Schema>;

