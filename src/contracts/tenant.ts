import { z } from 'zod';
import {
  ContractIdentifierSchema,
  JsonValueSchema,
} from './common';

export const TenantProductConfigSchema = z
  .object({
    contract: z.literal('TenantProductConfig'),
    tenantId: ContractIdentifierSchema,
    appId: ContractIdentifierSchema,
    environment: ContractIdentifierSchema,
    themeRef: ContractIdentifierSchema,
    moduleRefs: z.array(ContractIdentifierSchema).default([]),
    pageRefs: z.array(ContractIdentifierSchema).default([]),
    featureFlags: z.record(z.string(), z.boolean()).default({}),
    authBinding: z.record(z.string(), JsonValueSchema),
    dataBinding: z.record(z.string(), JsonValueSchema),
    sourceMap: z.record(z.string(), ContractIdentifierSchema),
    warnings: z.array(z.string()).default([]),
  })
  .strict();

export type TenantProductConfig = z.infer<typeof TenantProductConfigSchema>;
