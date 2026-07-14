import { z } from 'zod';
import {
  ContractIdentifierSchema,
  EntityRefV1Schema,
  JsonValueSchema,
} from './common';

export const ContractPortV1Schema = z
  .object({
    name: ContractIdentifierSchema,
    schemaRef: ContractIdentifierSchema,
    required: z.boolean().default(false),
    multiple: z.boolean().default(false),
    description: z.string().optional(),
  })
  .catchall(JsonValueSchema);

export const CapabilityManifestV1Schema = z
  .object({
    contract: z.literal('CapabilityManifest'),
    version: z.literal(1),
    id: ContractIdentifierSchema,
    capabilityVersion: ContractIdentifierSchema,
    ownerRepo: ContractIdentifierSchema,
    kind: z.enum(['primitive', 'composite', 'view', 'professional-provider', 'tool', 'workflow']),
    displayName: z.string().trim().min(1),
    description: z.string().optional(),
    ports: z
      .object({
        inputs: z.array(ContractPortV1Schema).default([]),
        outputs: z.array(ContractPortV1Schema).default([]),
      })
      .catchall(JsonValueSchema),
    runtime: z
      .object({
        providerRef: EntityRefV1Schema,
        loading: z.enum(['eager', 'lazy', 'viewport', 'on-activation']),
        fallbackCapabilityRef: EntityRefV1Schema.optional(),
        stateOwner: z.enum(['host', 'provider', 'external']),
        stateSchemaRef: ContractIdentifierSchema.optional(),
        sideEffects: z
          .array(z.enum(['network', 'storage', 'navigation', 'worker', 'websocket']))
          .default([]),
      })
      .catchall(JsonValueSchema),
    placement: z
      .object({
        surfaces: z.array(ContractIdentifierSchema).min(1),
        slots: z.array(ContractIdentifierSchema).default([]),
        variants: z.array(ContractIdentifierSchema).default([]),
        tokenRefs: z.array(ContractIdentifierSchema).default([]),
      })
      .catchall(JsonValueSchema),
    accessibility: z
      .object({
        keyboardModel: ContractIdentifierSchema,
        focusModel: ContractIdentifierSchema,
        labelContract: ContractIdentifierSchema,
      })
      .catchall(JsonValueSchema),
    observability: z
      .object({
        eventNamespace: ContractIdentifierSchema,
        metrics: z.array(ContractIdentifierSchema).default([]),
        evidenceRefs: z.array(ContractIdentifierSchema).default([]),
        performanceBudgetMs: z.number().positive().optional(),
      })
      .catchall(JsonValueSchema),
    compatibility: z
      .object({
        aliases: z.array(ContractIdentifierSchema).default([]),
        sourceKinds: z.array(ContractIdentifierSchema).default([]),
        minHostContractVersion: z.number().int().positive(),
      })
      .catchall(JsonValueSchema),
  })
  .catchall(JsonValueSchema);

export type ContractPortV1 = z.infer<typeof ContractPortV1Schema>;
export type CapabilityManifestV1 = z.infer<typeof CapabilityManifestV1Schema>;

