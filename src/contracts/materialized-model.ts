import { z } from 'zod';
import { PageValuePathSchema } from './page-expression';

/** Data transport limits are independent of expression execution limits. */
export const MaterializedModelBudgetSchema = z.object({
  maxRows: z.number().int().min(1).max(10000).default(1000),
  maxItems: z.number().int().min(1).max(50000).default(10000),
  maxNodes: z.number().int().min(1).max(1000000).default(200000),
  maxBytes: z.number().int().min(1024).max(16777216).default(8388608),
}).strict();

const path = PageValuePathSchema;
export const MaterializedModelProjectionSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('value'),
    path,
    budget: MaterializedModelBudgetSchema.prefault({}),
  }).strict(),
  z.object({
    kind: z.literal('chunks'),
    rowsPath: path.min(1),
    valuePath: path,
    modelPath: path,
    batchPath: path.min(1),
    indexPath: path.min(1),
    countPath: path.min(1),
    collections: z.array(z.object({
      path: path.min(1),
      totalPath: path.min(1),
      keyPath: path.min(1).optional(),
    }).strict()).min(1).max(16),
    pagination: z.object({ maxPages: z.number().int().min(1).max(100).default(32) }).strict().optional(),
    budget: MaterializedModelBudgetSchema.prefault({}),
  }).strict(),
]);
export type MaterializedModelProjection = z.infer<typeof MaterializedModelProjectionSchema>;
