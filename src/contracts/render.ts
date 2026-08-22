import { z } from 'zod';
import {
  ContractIdentifierSchema,
  ContractVersionSchema,
  EntityRefSchema,
  IsoDateTimeSchema,
  JsonObjectSchema,
} from './common';

export const ProductContextSchema = z.enum(['studio', 'kernel']);

export const RenderNodeStateSchema = z.enum([
  'idle',
  'loading',
  'empty',
  'error',
  'success',
  'disabled',
  'selected',
]);

export const RenderNodeKindSchema = z.enum([
  'shell',
  'page',
  'navigation',
  'view',
  'record',
  'control',
  'detail',
  'action',
  'overlay',
  'professional-provider',
]);

export const RenderSurfaceSchema = z
  .object({
    frameOwner: z.enum(['host', 'provider', 'none']),
    tone: ContractIdentifierSchema.optional(),
    density: z.enum(['compact', 'default', 'comfortable']),
  })
  .strict();

export const RenderScrollSchema = z
  .object({
    owner: z.enum(['page', 'surface', 'provider']),
    axis: z.enum(['x', 'y', 'both', 'none']),
    restoreKey: ContractIdentifierSchema.optional(),
    virtualizationBoundary: z.boolean(),
  })
  .strict()
  .superRefine((scroll, context) => {
    if (scroll.owner === 'provider' && scroll.restoreKey) {
      context.addIssue({
        code: 'custom',
        path: ['restoreKey'],
        message: 'Provider-owned scroll state cannot declare a host restoreKey.',
      });
    }
    if (scroll.virtualizationBoundary && scroll.owner !== 'provider') {
      context.addIssue({
        code: 'custom',
        path: ['owner'],
        message: 'A virtualization boundary must keep scroll ownership in the provider.',
      });
    }
  });

export const RenderActivationSchema = z
  .object({
    activationId: ContractIdentifierSchema,
    mode: z.enum(['navigate', 'select', 'drawer', 'modal', 'fullscreen', 'inline']),
    targetPath: z.string().trim().regex(/^\/(?!\/)/, 'Expected an application-relative path.').optional(),
    history: z.enum(['push', 'replace']).optional(),
  })
  .strict()
  .superRefine((activation, context) => {
    if (activation.mode === 'navigate' && !activation.targetPath) {
      context.addIssue({ code: 'custom', path: ['targetPath'], message: 'Navigate activation requires an application-relative targetPath.' });
    }
    if (activation.mode !== 'navigate' && activation.targetPath) {
      context.addIssue({ code: 'custom', path: ['targetPath'], message: 'Only navigate activation may declare targetPath.' });
    }
  });

export const RenderLifecycleSchema = z
  .object({
    mountPolicy: z.enum(['always', 'when-visible', 'when-active']),
    queryPolicy: z.enum(['always', 'when-visible', 'when-active', 'manual']),
    retainOnDeactivate: z.boolean(),
    deepLink: z.boolean(),
    focusReturn: z.boolean(),
  })
  .strict();

export const RenderLayoutSchema = z
  .object({
    mode: z.enum(['contents', 'block', 'flex', 'grid', 'absolute']),
    direction: z.enum(['row', 'column']).optional(),
    columns: z.number().int().positive().optional(),
    align: z.enum(['start', 'center', 'end', 'stretch']).optional(),
    justify: z.enum(['start', 'center', 'end', 'between', 'around']).optional(),
    gapTokenRef: EntityRefSchema.optional(),
  })
  .strict()
  .superRefine((layout, context) => {
    if (layout.direction && layout.mode !== 'flex') {
      context.addIssue({ code: 'custom', path: ['direction'], message: 'direction is only valid for flex layout.' });
    }
    if (layout.columns && layout.mode !== 'grid') {
      context.addIssue({ code: 'custom', path: ['columns'], message: 'columns is only valid for grid layout.' });
    }
    if (layout.gapTokenRef && layout.gapTokenRef.kind !== 'design-token') {
      context.addIssue({ code: 'custom', path: ['gapTokenRef', 'kind'], message: 'gapTokenRef must reference design-token.' });
    }
  });

export const RenderResponsiveRuleSchema = z
  .object({
    minWidthPx: z.number().nonnegative().optional(),
    maxWidthPx: z.number().positive().optional(),
    layout: RenderLayoutSchema,
  })
  .strict()
  .superRefine((rule, context) => {
    if (rule.minWidthPx === undefined && rule.maxWidthPx === undefined) {
      context.addIssue({ code: 'custom', path: [], message: 'Responsive rule must declare minWidthPx or maxWidthPx.' });
    }
    if (rule.minWidthPx !== undefined && rule.maxWidthPx !== undefined && rule.minWidthPx > rule.maxWidthPx) {
      context.addIssue({ code: 'custom', path: ['maxWidthPx'], message: 'maxWidthPx must be greater than or equal to minWidthPx.' });
    }
  });

const requireRef = (
  reference: z.infer<typeof EntityRefSchema> | undefined,
  expectedKind: string,
  path: (string | number)[],
  context: z.RefinementCtx,
) => {
  if (!reference) return;
  if (reference.kind !== expectedKind) {
    context.addIssue({
      code: 'custom',
      path: [...path, 'kind'],
      message: `${path.join('.')} must reference ${expectedKind}.`,
    });
  }
};

const requirePinnedOwnedRef = (
  reference: z.infer<typeof EntityRefSchema> | undefined,
  expectedKind: string,
  path: (string | number)[],
  context: z.RefinementCtx,
) => {
  requireRef(reference, expectedKind, path, context);
  if (!reference) return;
  if (reference.version === undefined) {
    context.addIssue({
      code: 'custom',
      path: [...path, 'version'],
      message: `${path.join('.')} must pin a version.`,
    });
  }
  if (reference.ownerRepo === undefined) {
    context.addIssue({
      code: 'custom',
      path: [...path, 'ownerRepo'],
      message: `${path.join('.')} must declare its owner repository.`,
    });
  }
};

export const RenderNodeSchema = z
  .object({
    contract: z.literal('RenderNode'),
    nodeId: ContractIdentifierSchema,
    kind: RenderNodeKindSchema,
    version: ContractVersionSchema,
    ownerRepo: ContractIdentifierSchema,
    parentNodeId: ContractIdentifierSchema.optional(),
    children: z.array(ContractIdentifierSchema),
    slot: ContractIdentifierSchema.optional(),
    pageRef: EntityRefSchema,
    semanticRef: EntityRefSchema.optional(),
    dataContextRef: EntityRefSchema.optional(),
    capabilityRef: EntityRefSchema,
    providerRef: EntityRefSchema.optional(),
    stateRef: EntityRefSchema.optional(),
    surface: RenderSurfaceSchema,
    scroll: RenderScrollSchema,
    activation: RenderActivationSchema,
    lifecycle: RenderLifecycleSchema,
    layout: RenderLayoutSchema,
    responsive: z.array(RenderResponsiveRuleSchema),
    accessRef: EntityRefSchema.optional(),
    evidenceRef: EntityRefSchema.optional(),
    state: RenderNodeStateSchema,
    renderModel: JsonObjectSchema,
  })
  .strict()
  .superRefine((node, context) => {
    requireRef(node.pageRef, 'page', ['pageRef'], context);
    requirePinnedOwnedRef(node.capabilityRef, 'capability', ['capabilityRef'], context);
    requirePinnedOwnedRef(node.providerRef, 'view-provider', ['providerRef'], context);
    requireRef(node.accessRef, 'access-policy', ['accessRef'], context);
    requireRef(node.evidenceRef, 'evidence', ['evidenceRef'], context);
    if (node.parentNodeId === node.nodeId) {
      context.addIssue({
        code: 'custom',
        path: ['parentNodeId'],
        message: 'RenderNode cannot be its own parent.',
      });
    }
    if (new Set(node.children).size !== node.children.length) {
      context.addIssue({ code: 'custom', path: ['children'], message: 'RenderNode children must be unique.' });
    }
    if (node.children.includes(node.nodeId)) {
      context.addIssue({ code: 'custom', path: ['children'], message: 'RenderNode cannot be its own child.' });
    }
    if (node.surface.frameOwner === 'provider' && !node.providerRef) {
      context.addIssue({
        code: 'custom',
        path: ['providerRef'],
        message: 'Provider-owned surfaces require providerRef.',
      });
    }
  });

export const RenderTreeSchema = z
  .object({
    contract: z.literal('RenderTree'),
    treeId: ContractIdentifierSchema,
    product: ProductContextSchema,
    rootNodeId: ContractIdentifierSchema,
    nodes: z.array(RenderNodeSchema).min(1),
  })
  .strict();

export const OverlayZIndexLaneSchema = z.enum([
  'popover',
  'drawer',
  'modal',
  'fullscreen',
  'system',
]);

export const OverlayNodeSchema = z
  .object({
    contract: z.literal('OverlayNode'),
    overlayId: ContractIdentifierSchema,
    renderNode: RenderNodeSchema,
    presentation: z.enum(['drawer', 'modal', 'fullscreen']),
    zIndexLane: OverlayZIndexLaneSchema,
    url: z
      .object({
        parameter: ContractIdentifierSchema,
        value: ContractIdentifierSchema,
        openMode: z.enum(['push', 'replace']),
        closeMode: z.enum(['back', 'replace']),
      })
      .strict(),
    focus: z
      .object({
        initial: z.enum(['first-interactive', 'container', 'explicit']),
        trap: z.boolean(),
      })
      .strict(),
    close: z
      .object({
        escape: z.boolean(),
        backdrop: z.boolean(),
      })
      .strict(),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.renderNode.kind !== 'overlay') {
      context.addIssue({
        code: 'custom',
        path: ['renderNode', 'kind'],
        message: 'OverlayNode renderNode.kind must be overlay.',
      });
    }
    if (value.renderNode.activation.mode !== value.presentation) {
      context.addIssue({
        code: 'custom',
        path: ['renderNode', 'activation', 'mode'],
        message: 'OverlayNode presentation must match the RenderNode activation mode.',
      });
    }
    if (value.presentation === 'drawer' && value.zIndexLane !== 'drawer') {
      context.addIssue({
        code: 'custom',
        path: ['zIndexLane'],
        message: 'Drawer overlays must use the drawer z-index lane.',
      });
    }
    if (value.presentation === 'modal' && value.zIndexLane !== 'modal') {
      context.addIssue({
        code: 'custom',
        path: ['zIndexLane'],
        message: 'Modal overlays must use the modal z-index lane.',
      });
    }
    if (value.presentation === 'fullscreen' && value.zIndexLane !== 'fullscreen' && value.zIndexLane !== 'system') {
      context.addIssue({
        code: 'custom',
        path: ['zIndexLane'],
        message: 'Fullscreen overlays must use the fullscreen or system z-index lane.',
      });
    }
  });

const ProductPathSchema = z
  .string()
  .trim()
  .regex(/^\/(?!\/)/, 'Expected an application-relative path.');

export const ApplicationHandoffEndpointSchema = z
  .object({
    product: ProductContextSchema,
    pageId: ContractIdentifierSchema,
    viewId: ContractIdentifierSchema.optional(),
    objectRef: EntityRefSchema.optional(),
    runtimeRef: EntityRefSchema.optional(),
    activationId: ContractIdentifierSchema.optional(),
    path: ProductPathSchema,
  })
  .strict();

export const ApplicationHandoffSchema = z
  .object({
    contract: z.literal('ApplicationHandoff'),
    handoffId: ContractIdentifierSchema,
    source: ApplicationHandoffEndpointSchema,
    target: ApplicationHandoffEndpointSchema,
    returnTarget: ApplicationHandoffEndpointSchema.optional(),
    traceId: ContractIdentifierSchema.optional(),
    createdAt: IsoDateTimeSchema,
  })
  .strict()
  .superRefine((value, context) => {
    if (value.source.product === value.target.product && value.source.pageId === value.target.pageId) {
      context.addIssue({
        code: 'custom',
        path: ['target'],
        message: 'ApplicationHandoff target must identify a different product page.',
      });
    }
  });

export const ViewProviderDescriptorSchema = z
  .object({
    contract: z.literal('ViewProviderDescriptor'),
    providerId: ContractIdentifierSchema,
    providerVersion: ContractIdentifierSchema,
    ownerRepo: ContractIdentifierSchema,
    capabilityRef: EntityRefSchema,
    rendererKey: ContractIdentifierSchema,
    renderModelSchemaRef: ContractIdentifierSchema,
    intentSchemaRef: ContractIdentifierSchema.optional(),
    loading: z.enum(['eager', 'lazy', 'viewport', 'on-activation']),
    stateOwner: z.enum(['host', 'provider', 'external']),
    supportedPageTypes: z.array(ContractIdentifierSchema).min(1),
    supportedSurfaces: z
      .array(z.enum(['page', 'workspace', 'view', 'record', 'action', 'overlay', 'agent']))
      .min(1),
    frameOwner: z.enum(['host', 'provider', 'none']),
    sideEffects: z
      .array(z.enum(['network', 'storage', 'navigation', 'worker', 'websocket'])),
    sideEffectAdapterRef: EntityRefSchema.optional(),
    lifecycle: z
      .object({
        preserveMount: z.boolean(),
        preserveScroll: z.boolean(),
        focusModel: ContractIdentifierSchema,
      })
      .strict(),
    performance: z
      .object({
        lazy: z.boolean(),
        virtualized: z.boolean(),
        budgetMs: z.number().positive().optional(),
      })
      .strict(),
    accessRef: EntityRefSchema.optional(),
    evidenceRef: EntityRefSchema.optional(),
  })
  .strict()
  .superRefine((provider, context) => {
    requirePinnedOwnedRef(provider.capabilityRef, 'capability', ['capabilityRef'], context);
    requirePinnedOwnedRef(provider.sideEffectAdapterRef, 'side-effect-adapter', ['sideEffectAdapterRef'], context);
    requireRef(provider.accessRef, 'access-policy', ['accessRef'], context);
    requireRef(provider.evidenceRef, 'evidence', ['evidenceRef'], context);
    if (provider.capabilityRef.version === undefined) {
      context.addIssue({
        code: 'custom',
        path: ['capabilityRef', 'version'],
        message: 'Provider capabilityRef must pin an active capability version.',
      });
    }
    if (provider.frameOwner === 'provider' && provider.stateOwner === 'host' && !provider.lifecycle.preserveMount) {
      context.addIssue({
        code: 'custom',
        path: ['lifecycle', 'preserveMount'],
        message: 'Host-owned state on a provider-owned frame must preserve the provider mount.',
      });
    }
    if (provider.sideEffects.length > 0 && !provider.sideEffectAdapterRef) {
      context.addIssue({ code: 'custom', path: ['sideEffectAdapterRef'], message: 'Providers with side effects require a pinned side-effect adapter.' });
    }
    if (provider.sideEffects.length === 0 && provider.sideEffectAdapterRef) {
      context.addIssue({ code: 'custom', path: ['sideEffectAdapterRef'], message: 'Pure providers cannot declare a side-effect adapter.' });
    }
  });

export type ProductContext = z.infer<typeof ProductContextSchema>;
export type RenderNodeState = z.infer<typeof RenderNodeStateSchema>;
export type RenderNodeKind = z.infer<typeof RenderNodeKindSchema>;
export type RenderSurface = z.infer<typeof RenderSurfaceSchema>;
export type RenderScroll = z.infer<typeof RenderScrollSchema>;
export type RenderActivation = z.infer<typeof RenderActivationSchema>;
export type RenderLifecycle = z.infer<typeof RenderLifecycleSchema>;
export type RenderLayout = z.infer<typeof RenderLayoutSchema>;
export type RenderResponsiveRule = z.infer<typeof RenderResponsiveRuleSchema>;
export type RenderNode = z.infer<typeof RenderNodeSchema>;
export type RenderTree = z.infer<typeof RenderTreeSchema>;
export type OverlayZIndexLane = z.infer<typeof OverlayZIndexLaneSchema>;
export type OverlayNode = z.infer<typeof OverlayNodeSchema>;
export type ApplicationHandoffEndpoint = z.infer<typeof ApplicationHandoffEndpointSchema>;
export type ApplicationHandoff = z.infer<typeof ApplicationHandoffSchema>;
export type ViewProviderDescriptor = z.infer<typeof ViewProviderDescriptorSchema>;
