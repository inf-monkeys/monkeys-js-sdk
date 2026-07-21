import { z } from 'zod';
import {
  ContractIdentifierSchema,
  EntityRefSchema,
} from './common';
import { ProductContextSchema } from './render';

export const ContractPortSchema = z
  .object({
    name: ContractIdentifierSchema,
    schemaRef: ContractIdentifierSchema,
    required: z.boolean().default(false),
    multiple: z.boolean().default(false),
    description: z.string().optional(),
  })
  .strict();

export const CapabilityProviderBindingSchema = z
  .object({
    providerRef: EntityRefSchema,
    productContexts: z.array(ProductContextSchema).default([]),
    priority: z.number().int().default(0),
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
        providerBindings: z.array(CapabilityProviderBindingSchema).min(1),
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
  .strict()
  .superRefine((manifest, context) => {
    const providerIds = new Set<string>();
    manifest.runtime.providerBindings.forEach((binding, index) => {
      const providerIdentity = `${binding.providerRef.kind}:${binding.providerRef.id}@${String(binding.providerRef.version)}:${binding.providerRef.ownerRepo ?? ''}`;
      if (providerIds.has(providerIdentity)) {
        context.addIssue({ code: 'custom', path: ['runtime', 'providerBindings', index], message: `Duplicate capability provider binding: ${providerIdentity}` });
      }
      providerIds.add(providerIdentity);
      if (!['view', 'professional-provider'].includes(manifest.kind)) return;
      if (binding.providerRef.kind !== 'view-provider') {
        context.addIssue({ code: 'custom', path: ['runtime', 'providerBindings', index, 'providerRef', 'kind'], message: 'View capabilities must resolve to view providers.' });
      }
      if (binding.providerRef.version === undefined) {
        context.addIssue({ code: 'custom', path: ['runtime', 'providerBindings', index, 'providerRef', 'version'], message: 'View capability providers must pin a provider version.' });
      }
      if (binding.providerRef.ownerRepo === undefined) {
        context.addIssue({ code: 'custom', path: ['runtime', 'providerBindings', index, 'providerRef', 'ownerRepo'], message: 'View capability providers must declare their owner repository.' });
      }
    });
  });

export const CapabilitySourceTypeSchema = z.enum([
  'tool-manifest',
  'plugin-manifest',
  'openapi',
  'workflow',
  'comfyui',
]);

export const CapabilityRegistrySourceSchema = z
  .object({
    sourceType: CapabilitySourceTypeSchema,
    sourceId: ContractIdentifierSchema,
    ownerRepo: ContractIdentifierSchema,
  })
  .strict();

export const CapabilityRegistryEntrySchema = z
  .object({
    manifest: CapabilityManifestSchema,
    sources: z.array(CapabilityRegistrySourceSchema).min(1),
  })
  .strict();

export const CapabilityRegistryDocumentSchema = z
  .object({
    contract: z.literal('CapabilityRegistry'),
    entries: z.array(CapabilityRegistryEntrySchema),
  })
  .strict()
  .superRefine((registry, context) => {
    const ids = new Set<string>();
    registry.entries.forEach((entry, index) => {
      if (ids.has(entry.manifest.id)) {
        context.addIssue({
          code: 'custom',
          path: ['entries', index, 'manifest', 'id'],
          message: `Duplicate capability id: ${entry.manifest.id}`,
        });
      }
      ids.add(entry.manifest.id);
    });
  });

export type ContractPort = z.infer<typeof ContractPortSchema>;
export type CapabilityProviderBinding = z.infer<typeof CapabilityProviderBindingSchema>;
export type CapabilityManifest = z.infer<typeof CapabilityManifestSchema>;
export type CapabilitySourceType = z.infer<typeof CapabilitySourceTypeSchema>;
export type CapabilityRegistrySource = z.infer<typeof CapabilityRegistrySourceSchema>;
export type CapabilityRegistryEntry = z.infer<typeof CapabilityRegistryEntrySchema>;
export type CapabilityRegistryDocument = z.infer<typeof CapabilityRegistryDocumentSchema>;
