import { z } from 'zod';
import {
  ContractIdentifierSchema,
  EntityRefSchema,
} from './common';

export const ContractPortSchema = z
  .object({
    name: ContractIdentifierSchema,
    schemaRef: ContractIdentifierSchema,
    required: z.boolean().default(false),
    multiple: z.boolean().default(false),
    description: z.string().optional(),
  })
  .strict();

export const CapabilityManifestSchema = z
  .object({
    contract: z.literal('CapabilityManifest'),
    id: ContractIdentifierSchema,
    capabilityVersion: ContractIdentifierSchema,
    ownerRepo: ContractIdentifierSchema,
    kind: z.enum(['primitive', 'composite', 'view', 'professional-provider', 'tool', 'workflow']),
    displayName: z.string().trim().min(1),
    description: z.string().optional(),
    ports: z
      .object({
        inputs: z.array(ContractPortSchema).default([]),
        outputs: z.array(ContractPortSchema).default([]),
      })
      .strict(),
    runtime: z
      .object({
        providerRef: EntityRefSchema,
        loading: z.enum(['eager', 'lazy', 'viewport', 'on-activation']),
        fallbackCapabilityRef: EntityRefSchema.optional(),
        stateOwner: z.enum(['host', 'provider', 'external']),
        stateSchemaRef: ContractIdentifierSchema.optional(),
        sideEffects: z
          .array(z.enum(['network', 'storage', 'navigation', 'worker', 'websocket']))
          .default([]),
      })
      .strict(),
    placement: z
      .object({
        surfaces: z.array(ContractIdentifierSchema).min(1),
        slots: z.array(ContractIdentifierSchema).default([]),
        variants: z.array(ContractIdentifierSchema).default([]),
        tokenRefs: z.array(ContractIdentifierSchema).default([]),
      })
      .strict(),
    accessibility: z
      .object({
        keyboardModel: ContractIdentifierSchema,
        focusModel: ContractIdentifierSchema,
        labelContract: ContractIdentifierSchema,
      })
      .strict(),
    observability: z
      .object({
        eventNamespace: ContractIdentifierSchema,
        metrics: z.array(ContractIdentifierSchema).default([]),
        evidenceRefs: z.array(ContractIdentifierSchema).default([]),
        performanceBudgetMs: z.number().positive().optional(),
      })
      .strict(),
  })
  .strict();

export type ContractPort = z.infer<typeof ContractPortSchema>;
export type CapabilityManifest = z.infer<typeof CapabilityManifestSchema>;
