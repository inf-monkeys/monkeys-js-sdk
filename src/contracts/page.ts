import { z } from 'zod';
import {
  ContractIdentifierSchema,
  EntityRefV1Schema,
  JsonValueSchema,
} from './common';

export const PageVisibilityV1Schema = z
  .object({
    authenticated: z.boolean().default(true),
    permissionCodes: z.array(ContractIdentifierSchema).default([]),
    featureFlags: z.array(ContractIdentifierSchema).default([]),
    productContexts: z.array(z.enum(['studio', 'kernel', 'compute'])).min(1),
  })
  .catchall(JsonValueSchema);

export const PageDefinitionV1Schema = z
  .object({
    contract: z.literal('PageDefinition'),
    version: z.literal(1),
    pageId: ContractIdentifierSchema,
    ownerRepo: ContractIdentifierSchema,
    surface: z.enum(['page', 'workspace', 'view', 'record', 'action', 'overlay', 'agent']),
    routeId: ContractIdentifierSchema,
    routePath: z.string().trim().min(1),
    rendererKey: ContractIdentifierSchema,
    capabilityRef: EntityRefV1Schema.optional(),
    binding: z
      .object({
        sourceRef: ContractIdentifierSchema.optional(),
        ontologyId: ContractIdentifierSchema.optional(),
        projectionRef: ContractIdentifierSchema.optional(),
        stateRef: ContractIdentifierSchema.optional(),
      })
      .catchall(JsonValueSchema),
    navigation: z
      .object({
        label: z.string().trim().min(1),
        iconRef: ContractIdentifierSchema.optional(),
        parentPageId: ContractIdentifierSchema.optional(),
        order: z.number().int().optional(),
        hidden: z.boolean().default(false),
      })
      .catchall(JsonValueSchema),
    visibility: PageVisibilityV1Schema,
  })
  .catchall(JsonValueSchema);

export const PageRuntimeDescriptorV1Schema = z
  .object({
    contract: z.literal('PageRuntimeDescriptor'),
    version: z.literal(1),
    page: PageDefinitionV1Schema,
    nodeId: ContractIdentifierSchema,
    parentNodeId: ContractIdentifierSchema.optional(),
    slot: ContractIdentifierSchema.optional(),
    semanticRef: ContractIdentifierSchema.optional(),
    dataContextRef: ContractIdentifierSchema.optional(),
    providerRef: EntityRefV1Schema.optional(),
    surface: z
      .object({
        frameOwner: ContractIdentifierSchema,
        tone: ContractIdentifierSchema.optional(),
        density: z.enum(['compact', 'default', 'comfortable']).default('default'),
      })
      .catchall(JsonValueSchema),
    scroll: z
      .object({
        owner: z.enum(['page', 'surface', 'provider']),
        axis: z.enum(['x', 'y', 'both', 'none']),
        restoreKey: ContractIdentifierSchema.optional(),
        virtualized: z.boolean().default(false),
      })
      .catchall(JsonValueSchema),
    activation: z.enum(['navigate', 'select', 'drawer', 'modal', 'fullscreen']),
    lifecycle: z
      .object({
        mountPolicy: z.enum(['always', 'when-visible', 'when-active']),
        queryPolicy: z.enum(['always', 'when-visible', 'when-active', 'manual']),
        deepLink: z.boolean(),
        focusReturn: z.boolean(),
      })
      .catchall(JsonValueSchema),
  })
  .catchall(JsonValueSchema);

export type PageVisibilityV1 = z.infer<typeof PageVisibilityV1Schema>;
export type PageDefinitionV1 = z.infer<typeof PageDefinitionV1Schema>;
export type PageRuntimeDescriptorV1 = z.infer<typeof PageRuntimeDescriptorV1Schema>;

