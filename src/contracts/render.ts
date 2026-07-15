import { z } from 'zod';
import {
  ContractIdentifierSchema,
  EntityRefSchema,
  IsoDateTimeSchema,
  JsonObjectSchema,
} from './common';

export const ProductContextSchema = z.enum(['studio', 'kernel', 'compute']);

export const RenderNodeStateSchema = z.enum([
  'idle',
  'loading',
  'empty',
  'error',
  'success',
  'disabled',
  'selected',
]);

export const RenderNodeSchema = z
  .object({
    contract: z.literal('RenderNode'),
    nodeId: ContractIdentifierSchema,
    kind: z.enum([
      'page',
      'view',
      'record',
      'control',
      'detail',
      'overlay',
      'professional-provider',
    ]),
    ownerRepo: ContractIdentifierSchema,
    parentNodeId: ContractIdentifierSchema.optional(),
    pageRef: EntityRefSchema,
    capabilityRef: EntityRefSchema,
    providerRef: EntityRefSchema.optional(),
    surfaceOwner: ContractIdentifierSchema,
    scroll: z
      .object({
        owner: z.enum(['page', 'surface', 'provider']),
        axis: z.enum(['x', 'y', 'both', 'none']),
        restoreKey: ContractIdentifierSchema.optional(),
        virtualized: z.boolean().default(false),
      })
      .strict(),
    activation: z
      .object({
        activationId: ContractIdentifierSchema,
        mode: z.enum(['navigate', 'select', 'drawer', 'modal', 'fullscreen', 'inline']),
      })
      .strict(),
    lifecycle: z
      .object({
        mountPolicy: z.enum(['always', 'when-visible', 'when-active']),
        queryPolicy: z.enum(['always', 'when-visible', 'when-active', 'manual']),
        retainOnDeactivate: z.boolean().default(false),
      })
      .strict(),
    state: RenderNodeStateSchema.default('idle'),
    renderModel: JsonObjectSchema.default({}),
  })
  .strict();

export const OverlayNodeSchema = z
  .object({
    contract: z.literal('OverlayNode'),
    overlayId: ContractIdentifierSchema,
    renderNode: RenderNodeSchema,
    presentation: z.enum(['drawer', 'modal', 'fullscreen']),
    url: z
      .object({
        parameter: ContractIdentifierSchema,
        value: ContractIdentifierSchema,
        closeOnBack: z.boolean().default(true),
      })
      .strict(),
    focus: z
      .object({
        initial: z.enum(['first-interactive', 'container', 'explicit']),
        trap: z.boolean().default(true),
        restore: z.boolean().default(true),
      })
      .strict(),
    close: z
      .object({
        escape: z.boolean().default(true),
        backdrop: z.boolean().default(true),
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
    ownerRepo: ContractIdentifierSchema,
    capabilityRef: EntityRefSchema,
    rendererKey: ContractIdentifierSchema,
    loading: z.enum(['eager', 'lazy', 'viewport', 'on-activation']),
    stateOwner: z.enum(['host', 'provider', 'external']),
    supportedPageTypes: z.array(ContractIdentifierSchema).min(1),
    sideEffects: z
      .array(z.enum(['network', 'storage', 'navigation', 'worker', 'websocket']))
      .default([]),
    lifecycle: z
      .object({
        preserveMount: z.boolean().default(false),
        preserveScroll: z.boolean().default(false),
        focusModel: ContractIdentifierSchema,
      })
      .strict(),
    performance: z
      .object({
        lazy: z.boolean(),
        virtualized: z.boolean().default(false),
        budgetMs: z.number().positive().optional(),
      })
      .strict(),
  })
  .strict();

export type ProductContext = z.infer<typeof ProductContextSchema>;
export type RenderNodeState = z.infer<typeof RenderNodeStateSchema>;
export type RenderNode = z.infer<typeof RenderNodeSchema>;
export type OverlayNode = z.infer<typeof OverlayNodeSchema>;
export type ApplicationHandoffEndpoint = z.infer<typeof ApplicationHandoffEndpointSchema>;
export type ApplicationHandoff = z.infer<typeof ApplicationHandoffSchema>;
export type ViewProviderDescriptor = z.infer<typeof ViewProviderDescriptorSchema>;
