import { z } from 'zod';
import { ContractIdentifierSchema, ContractVersionSchema, LocalizedTextSchema } from './common';

export const PermissionDefinitionSchema = z
  .object({
    code: ContractIdentifierSchema,
    name: LocalizedTextSchema,
    description: LocalizedTextSchema.optional(),
    resource: ContractIdentifierSchema,
    action: ContractIdentifierSchema,
    domain: ContractIdentifierSchema.optional(),
  })
  .strict();

export const PermissionBundleSchema = z
  .object({
    bundleId: ContractIdentifierSchema,
    name: LocalizedTextSchema,
    permissionCodes: z.array(ContractIdentifierSchema).default([]),
  })
  .strict();

export const SystemGroupDefinitionSchema = z
  .object({
    groupCode: ContractIdentifierSchema,
    name: LocalizedTextSchema,
    description: LocalizedTextSchema.optional(),
    permissionPolicy: z.enum(['bundles', 'studio_current', 'all_current']).default('bundles'),
    permissionBundleIds: z.array(ContractIdentifierSchema).default([]),
  })
  .strict()
  .refine((value) => value.permissionPolicy !== 'bundles' || value.permissionBundleIds.length > 0, {
    message: 'A bundles permission policy requires at least one permission bundle.',
    path: ['permissionBundleIds'],
  });

export const ProductAccessDeclarationSchema = z
  .object({
    contract: z.literal('ProductAccessDeclaration'),
    declarationId: ContractIdentifierSchema,
    version: ContractVersionSchema,
    ownerRepo: ContractIdentifierSchema,
    permissions: z.array(PermissionDefinitionSchema).default([]),
    permissionBundles: z.array(PermissionBundleSchema).default([]),
    systemGroups: z.array(SystemGroupDefinitionSchema).min(1),
  })
  .strict();

export type PermissionDefinition = z.infer<typeof PermissionDefinitionSchema>;
export type PermissionBundle = z.infer<typeof PermissionBundleSchema>;
export type SystemGroupDefinition = z.infer<typeof SystemGroupDefinitionSchema>;
export type ProductAccessDeclaration = z.infer<typeof ProductAccessDeclarationSchema>;
