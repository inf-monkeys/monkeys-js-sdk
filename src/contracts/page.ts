import { z } from 'zod';
import {
  ContractIdentifierSchema,
  EntityRefSchema,
  JsonObjectSchema,
  LocalizedTextSchema,
} from './common';

export const PageTypeSchema = z.enum([
  'page',
  'workspace',
  'view',
  'record',
  'action',
  'overlay',
  'agent',
  'process',
  'log',
  'chat',
  'preview',
  'api',
  'enhanced',
  'agent-chat',
  'agent-config',
  'agent-log',
  'design-board',
  'global-design-board',
  'iframe',
]);

export const PageVisibilitySchema = z
  .object({
    authenticated: z.boolean().default(true),
    permissionAllOf: z.array(ContractIdentifierSchema).default([]),
    permissionAnyOf: z.array(ContractIdentifierSchema).default([]),
    featureFlags: z.array(ContractIdentifierSchema).default([]),
    productContexts: z.array(z.enum(['studio', 'kernel', 'compute'])).min(1),
  })
  .strict();

export const PageRoutePathSchema = z
  .string()
  .trim()
  .regex(/^\/(?!\/)/, 'Expected an application-relative route path.');

const requireCapabilityReference = (
  reference: z.infer<typeof EntityRefSchema>,
  path: (string | number)[],
  context: z.RefinementCtx,
) => {
  if (reference.kind !== 'capability') {
    context.addIssue({
      code: 'custom',
      path: [...path, 'kind'],
      message: 'Page capability references must use kind capability.',
    });
  }
  if (reference.version === undefined) {
    context.addIssue({
      code: 'custom',
      path: [...path, 'version'],
      message: 'Page capability references must pin an active capability version.',
    });
  }
  if (reference.ownerRepo === undefined) {
    context.addIssue({
      code: 'custom',
      path: [...path, 'ownerRepo'],
      message: 'Page capability references must declare their owner repository.',
    });
  }
};

export const PageDefinitionSchema = z
  .object({
    contract: z.literal('PageDefinition'),
    pageId: ContractIdentifierSchema,
    ownerRepo: ContractIdentifierSchema,
    title: LocalizedTextSchema,
    pageType: PageTypeSchema,
    ownership: z.object({
      teamId: ContractIdentifierSchema.optional(),
      creatorRef: EntityRefSchema.optional(),
      studioId: ContractIdentifierSchema.optional(),
      builtIn: z.boolean(),
    }).strict(),
    record: z.object({
      createdTimestamp: z.number().int().nonnegative().optional(),
      updatedTimestamp: z.number().int().nonnegative().optional(),
      deleted: z.boolean().default(false),
    }).strict(),
    surface: z.enum(['page', 'workspace', 'view', 'record', 'action', 'overlay', 'agent']),
    routeId: ContractIdentifierSchema,
    routePath: PageRoutePathSchema,
    rendererKey: ContractIdentifierSchema,
    capabilityRef: EntityRefSchema,
    capabilityRefs: z.array(EntityRefSchema).default([]),
    workflowRef: EntityRefSchema.optional(),
    binding: z
      .object({
        sourceRef: ContractIdentifierSchema.optional(),
        ontologyId: ContractIdentifierSchema.optional(),
        projectionRef: ContractIdentifierSchema.optional(),
        stateRef: ContractIdentifierSchema.optional(),
      })
      .strict(),
    access: z.object({
      actions: z.array(z.enum(['read', 'write', 'execute', 'manage-permissions'])).default([]),
    }).strict(),
    rendererConfig: z.object({
      schemaRef: ContractIdentifierSchema,
      value: JsonObjectSchema,
    }).strict(),
    navigation: z
      .object({
        label: LocalizedTextSchema,
        iconRef: ContractIdentifierSchema.optional(),
        parentPageId: ContractIdentifierSchema.optional(),
        order: z.number().int().optional(),
        hidden: z.boolean().default(false),
        pinned: z.boolean().default(false),
      })
      .strict(),
    visibility: PageVisibilitySchema,
  })
  .strict()
  .superRefine((page, context) => {
    const capabilities = [page.capabilityRef, ...page.capabilityRefs];
    const capabilityIdentities = new Set<string>();
    capabilities.forEach((reference, index) => {
      const path = index === 0 ? ['capabilityRef'] : ['capabilityRefs', index - 1];
      requireCapabilityReference(reference, path, context);
      const identity = `${reference.id}@${String(reference.version)}:${reference.ownerRepo ?? ''}`;
      if (capabilityIdentities.has(identity)) {
        context.addIssue({
          code: 'custom',
          path,
          message: `Duplicate page capability reference: ${identity}`,
        });
      }
      capabilityIdentities.add(identity);
    });
    if (page.workflowRef && page.workflowRef.kind !== 'workflow') context.addIssue({ code: 'custom', path: ['workflowRef', 'kind'], message: 'workflowRef must reference a workflow.' });
  });

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

export const PageRouteProjectionSchema = z.object({
  pageId: ContractIdentifierSchema,
  routeId: ContractIdentifierSchema,
  path: PageRoutePathSchema,
}).strict();

export const PageNavigationProjectionSchema = z.object({
  pageId: ContractIdentifierSchema,
  routeId: ContractIdentifierSchema,
  path: PageRoutePathSchema,
  label: LocalizedTextSchema,
  iconRef: ContractIdentifierSchema.optional(),
  parentPageId: ContractIdentifierSchema.optional(),
  order: z.number().int().optional(),
  pinned: z.boolean(),
}).strict();

export const PageGuardProjectionSchema = z.object({
  pageId: ContractIdentifierSchema,
  authenticated: z.boolean(),
  permissionAllOf: z.array(ContractIdentifierSchema),
  permissionAnyOf: z.array(ContractIdentifierSchema),
  featureFlags: z.array(ContractIdentifierSchema),
  actions: z.array(z.enum(['read', 'write', 'execute', 'manage-permissions'])),
}).strict();

export const PageRendererProjectionSchema = z
  .object({
    pageId: ContractIdentifierSchema,
    surface: z.enum(['page', 'workspace', 'view', 'record', 'action', 'overlay', 'agent']),
    rendererKey: ContractIdentifierSchema,
    capabilityRef: EntityRefSchema,
    capabilityRefs: z.array(EntityRefSchema),
    providerRef: EntityRefSchema,
    binding: PageDefinitionSchema.shape.binding,
    rendererConfig: PageDefinitionSchema.shape.rendererConfig,
    workflowRef: EntityRefSchema.optional(),
  })
  .strict()
  .superRefine((renderer, context) => {
    requireCapabilityReference(renderer.capabilityRef, ['capabilityRef'], context);
    renderer.capabilityRefs.forEach((reference, index) => {
      requireCapabilityReference(reference, ['capabilityRefs', index], context);
    });
    if (renderer.providerRef.kind !== 'view-provider') {
      context.addIssue({
        code: 'custom',
        path: ['providerRef', 'kind'],
        message: 'Renderer providerRef must use kind view-provider.',
      });
    }
    if (renderer.providerRef.version === undefined) {
      context.addIssue({
        code: 'custom',
        path: ['providerRef', 'version'],
        message: 'Renderer providerRef must pin a provider version.',
      });
    }
    if (renderer.providerRef.ownerRepo === undefined) {
      context.addIssue({
        code: 'custom',
        path: ['providerRef', 'ownerRepo'],
        message: 'Renderer providerRef must declare its owner repository.',
      });
    }
  });

const duplicateProjectionIdentity = <T>(
  values: readonly T[],
  identity: (value: T) => string,
): string | undefined => {
  const seen = new Set<string>();
  for (const value of values) {
    const key = identity(value);
    if (seen.has(key)) return key;
    seen.add(key);
  }
  return undefined;
};

export const PageRuntimeProjectionSchema = z
  .object({
    contract: z.literal('PageRuntimeProjection'),
    product: z.enum(['studio', 'kernel', 'compute']),
    routes: z.array(PageRouteProjectionSchema),
    navigation: z.array(PageNavigationProjectionSchema),
    guards: z.array(PageGuardProjectionSchema),
    renderers: z.array(PageRendererProjectionSchema),
  })
  .strict()
  .superRefine((projection, context) => {
    const tables = [
      ['routes', projection.routes.map((value) => value.pageId)],
      ['navigation', projection.navigation.map((value) => value.pageId)],
      ['guards', projection.guards.map((value) => value.pageId)],
      ['renderers', projection.renderers.map((value) => value.pageId)],
    ] as const;
    for (const [table, values] of tables) {
      const duplicate = duplicateProjectionIdentity(values, (value) => value);
      if (duplicate) {
        context.addIssue({ code: 'custom', path: [table], message: `Duplicate ${table} pageId: ${duplicate}` });
      }
    }

    for (const identity of [
      ['routeId', duplicateProjectionIdentity(projection.routes, (route) => route.routeId)],
      ['path', duplicateProjectionIdentity(projection.routes, (route) => route.path)],
    ] as const) {
      if (identity[1]) {
        context.addIssue({ code: 'custom', path: ['routes'], message: `Duplicate route ${identity[0]}: ${identity[1]}` });
      }
    }

    const routesByPageId = new Map(projection.routes.map((route) => [route.pageId, route]));
    const guardPageIds = new Set(projection.guards.map((guard) => guard.pageId));
    const rendererPageIds = new Set(projection.renderers.map((renderer) => renderer.pageId));
    for (const route of projection.routes) {
      if (!guardPageIds.has(route.pageId)) {
        context.addIssue({ code: 'custom', path: ['guards'], message: `Missing guard projection for ${route.pageId}.` });
      }
      if (!rendererPageIds.has(route.pageId)) {
        context.addIssue({ code: 'custom', path: ['renderers'], message: `Missing renderer projection for ${route.pageId}.` });
      }
    }
    for (const guard of projection.guards) {
      if (!routesByPageId.has(guard.pageId)) {
        context.addIssue({ code: 'custom', path: ['guards'], message: `Guard references unknown page ${guard.pageId}.` });
      }
    }
    for (const renderer of projection.renderers) {
      if (!routesByPageId.has(renderer.pageId)) {
        context.addIssue({ code: 'custom', path: ['renderers'], message: `Renderer references unknown page ${renderer.pageId}.` });
      }
    }
    for (const navigation of projection.navigation) {
      const route = routesByPageId.get(navigation.pageId);
      if (!route || route.routeId !== navigation.routeId || route.path !== navigation.path) {
        context.addIssue({
          code: 'custom',
          path: ['navigation'],
          message: `Navigation route projection for ${navigation.pageId} does not match its route table entry.`,
        });
      }
    }
  });

export type PageVisibility = z.infer<typeof PageVisibilitySchema>;
export type PageType = z.infer<typeof PageTypeSchema>;
export type PageDefinition = z.infer<typeof PageDefinitionSchema>;
export type PageRuntimeDescriptor = z.infer<typeof PageRuntimeDescriptorSchema>;
export type PageRouteProjection = z.infer<typeof PageRouteProjectionSchema>;
export type PageNavigationProjection = z.infer<typeof PageNavigationProjectionSchema>;
export type PageGuardProjection = z.infer<typeof PageGuardProjectionSchema>;
export type PageRendererProjection = z.infer<typeof PageRendererProjectionSchema>;
export type PageRuntimeProjection = z.infer<typeof PageRuntimeProjectionSchema>;
