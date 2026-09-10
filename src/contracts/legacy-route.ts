import { z } from 'zod';

export const LegacyRoutePolicySchema = z
  .object({
    contract: z.literal('LegacyRoutePolicy'),
    schemaVersion: z.literal(1),
    fallback: z.enum(['allowed', 'forbidden']),
    restoration: z.enum(['allowed', 'forbidden']),
  })
  .strict();

export type LegacyRoutePolicy = z.infer<typeof LegacyRoutePolicySchema>;
