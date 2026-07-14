import { z } from 'zod';
import {
  ContractIdentifierSchema,
  EntityRefSchema,
  JsonValueSchema,
} from './common';

export const PageVisibilitySchema = z
  .object({
    authenticated: z.boolean().default(true),
    permissionCodes: z.array(ContractIdentifierSchema).default([]),
    featureFlags: z.array(ContractIdentifierSchema).default([]),
    productContexts: z.array(z.enum(['studio', 'kernel', 'compute'])).min(1),
  })
  .strict();

export const PageDefinitionSchema = z
  .object({
    contract: z.literal('PageDefinition'),
    pageId: ContractIdentifierSchema,
    ownerRepo: ContractIdentifierSchema,
    surface: z.enum(['page', 'workspace', 'view', 'record', 'action', 'overlay', 'agent']),
    routeId: ContractIdentifierSchema,
    routePath: z.string().trim().min(1),
    rendererKey: ContractIdentifierSchema,
    capabilityRef: EntityRefSchema.optional(),
    binding: z
      .object({
        sourceRef: ContractIdentifierSchema.optional(),
        ontologyId: ContractIdentifierSchema.optional(),
        projectionRef: ContractIdentifierSchema.optional(),
        stateRef: ContractIdentifierSchema.optional(),
      })
      .strict(),
    navigation: z
      .object({
        label: z.string().trim().min(1),
        iconRef: ContractIdentifierSchema.optional(),
        parentPageId: ContractIdentifierSchema.optional(),
        order: z.number().int().optional(),
        hidden: z.boolean().default(false),
      })
      .strict(),
    visibility: PageVisibilitySchema,
  })
  .strict();

export const PageRuntimeDescriptorSchema = z
  .object({
    contract: z.literal('PageRuntimeDescriptor'),
    page: PageDefinitionSchema,
    nodeId: ContractIdentifierSchema,
    parentNodeId: ContractIdentifierSchema.optional(),
    slot: ContractIdentifierSchema.optional(),
    semanticRef: ContractIdentifierSchema.optional(),
    dataContextRef: ContractIdentifierSchema.optional(),
    providerRef: EntityRefSchema.optional(),
    surface: z
      .object({
        frameOwner: ContractIdentifierSchema,
        tone: ContractIdentifierSchema.optional(),
        density: z.enum(['compact', 'default', 'comfortable']).default('default'),
      })
      .strict(),
    scroll: z
      .object({
        owner: z.enum(['page', 'surface', 'provider']),
        axis: z.enum(['x', 'y', 'both', 'none']),
        restoreKey: ContractIdentifierSchema.optional(),
        virtualized: z.boolean().default(false),
      })
      .strict(),
    activation: z.enum(['navigate', 'select', 'drawer', 'modal', 'fullscreen']),
    lifecycle: z
      .object({
        mountPolicy: z.enum(['always', 'when-visible', 'when-active']),
        queryPolicy: z.enum(['always', 'when-visible', 'when-active', 'manual']),
        deepLink: z.boolean(),
        focusReturn: z.boolean(),
      })
      .strict(),
  })
  .strict();

export type PageVisibility = z.infer<typeof PageVisibilitySchema>;
export type PageDefinition = z.infer<typeof PageDefinitionSchema>;
export type PageRuntimeDescriptor = z.infer<typeof PageRuntimeDescriptorSchema>;
