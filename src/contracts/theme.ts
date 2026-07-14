import { z } from 'zod';
import {
  ContractIdentifierSchema,
  ContractMetadataSchema,
  JsonValueSchema,
} from './common';

export const ThemeTokenTypeV1Schema = z.enum([
  'color',
  'dimension',
  'fontFamily',
  'fontWeight',
  'duration',
  'cubicBezier',
  'number',
  'shadow',
  'string',
]);

export const ThemeTokenV1Schema = z
  .object({
    $type: ThemeTokenTypeV1Schema,
    $value: JsonValueSchema,
    $description: z.string().optional(),
  })
  .catchall(JsonValueSchema);

export const ThemeTokenGroupV1Schema = z.record(z.string(), ThemeTokenV1Schema);

export const ThemeTokensV1Schema = z
  .object({
    contract: z.literal('ThemeTokens'),
    version: z.literal(1),
    metadata: ContractMetadataSchema.extend({
      packageName: z.literal('@inf-monkeys-tech/monkeys-design'),
    }).catchall(JsonValueSchema),
    seed: ThemeTokenGroupV1Schema,
    semantic: ThemeTokenGroupV1Schema,
    component: z.record(z.string(), ThemeTokenGroupV1Schema).default({}),
    assets: z
      .object({
        logo: z.string().optional(),
        logoDark: z.string().optional(),
        favicon: z.string().optional(),
        fontFamilies: z.array(z.string()).default([]),
        icons: z.record(z.string(), z.string()).default({}),
      })
      .catchall(JsonValueSchema),
    modes: z
      .object({
        color: z.array(ContractIdentifierSchema).default(['light', 'dark']),
        density: z.array(z.enum(['compact', 'default', 'comfortable'])).default([
          'compact',
          'default',
          'comfortable',
        ]),
      })
      .catchall(JsonValueSchema),
    compatibility: z
      .object({
        cssVariableAliases: z.record(z.string(), z.string()).default({}),
        deprecatedTokenKeys: z.array(ContractIdentifierSchema).default([]),
      })
      .catchall(JsonValueSchema),
  })
  .catchall(JsonValueSchema);

export type ThemeTokenTypeV1 = z.infer<typeof ThemeTokenTypeV1Schema>;
export type ThemeTokenV1 = z.infer<typeof ThemeTokenV1Schema>;
export type ThemeTokenGroupV1 = z.infer<typeof ThemeTokenGroupV1Schema>;
export type ThemeTokensV1 = z.infer<typeof ThemeTokensV1Schema>;

