import { z } from 'zod';
import {
  ContractIdentifierSchema,
  ContractMetadataSchema,
  JsonValueSchema,
} from './common';

export const ThemeTokenTypeSchema = z.enum([
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

export const ThemeTokenSchema = z
  .object({
    $type: ThemeTokenTypeSchema,
    $value: JsonValueSchema,
    $description: z.string().optional(),
  })
  .strict();

export const ThemeTokenGroupSchema = z.record(z.string(), ThemeTokenSchema);

export const ThemeTokensSchema = z
  .object({
    contract: z.literal('ThemeTokens'),
    metadata: ContractMetadataSchema.extend({
      packageName: z.literal('@inf-monkeys-tech/monkeys-design'),
    }).strict(),
    seed: ThemeTokenGroupSchema,
    semantic: ThemeTokenGroupSchema,
    component: z.record(z.string(), ThemeTokenGroupSchema).default({}),
    assets: z
      .object({
        logo: z.string().optional(),
        logoDark: z.string().optional(),
        favicon: z.string().optional(),
        fontFamilies: z.array(z.string()).default([]),
        icons: z.record(z.string(), z.string()).default({}),
      })
      .strict(),
    modes: z
      .object({
        color: z.array(ContractIdentifierSchema).default(['light', 'dark']),
        density: z.array(z.enum(['compact', 'default', 'comfortable'])).default([
          'compact',
          'default',
          'comfortable',
        ]),
      })
      .strict(),
  })
  .strict();

export type ThemeTokenType = z.infer<typeof ThemeTokenTypeSchema>;
export type ThemeToken = z.infer<typeof ThemeTokenSchema>;
export type ThemeTokenGroup = z.infer<typeof ThemeTokenGroupSchema>;
export type ThemeTokens = z.infer<typeof ThemeTokensSchema>;
