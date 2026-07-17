import { z } from 'zod';

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

export const JsonValueSchema: z.ZodType<JsonValue> = z.lazy(() =>
  z.union([
    z.string(),
    z.number().finite(),
    z.boolean(),
    z.null(),
    z.array(JsonValueSchema),
    z.record(z.string(), JsonValueSchema),
  ]),
);

export const JsonObjectSchema = z.record(z.string(), JsonValueSchema);
export const ContractIdentifierSchema = z.string().trim().min(1).max(256);
export const ContractVersionSchema = z.number().int().positive();
export const IsoDateTimeSchema = z.string().datetime({ offset: true });
export const Sha256Schema = z.string().regex(/^[a-f0-9]{64}$/i, 'Expected a SHA-256 hex digest.');

export const LocaleIdentifierSchema = z
  .string()
  .regex(/^[a-z]{2,3}(?:-[A-Z][a-z]{3})?(?:-[A-Z]{2}|-\d{3})?$/, 'Expected a BCP 47 locale identifier.');

export const LocalizedTextSchema = z.union([
  z.string().trim().min(1),
  z
    .record(LocaleIdentifierSchema, z.string().trim().min(1))
    .refine((value) => Object.keys(value).length > 0, 'Localized text must contain at least one locale.'),
]);

export const ContractMetadataSchema = z
  .object({
    id: ContractIdentifierSchema,
    version: ContractVersionSchema,
    name: z.string().trim().min(1).optional(),
    description: z.string().optional(),
    labels: z.record(z.string(), z.string()).optional(),
    createdAt: IsoDateTimeSchema.optional(),
    updatedAt: IsoDateTimeSchema.optional(),
  })
  .strict();

export const EntityRefSchema = z
  .object({
    kind: ContractIdentifierSchema,
    id: ContractIdentifierSchema,
    version: z.union([ContractVersionSchema, z.string().trim().min(1)]).optional(),
    ownerRepo: ContractIdentifierSchema.optional(),
  })
  .strict();

export type ContractMetadata = z.infer<typeof ContractMetadataSchema>;
export type EntityRef = z.infer<typeof EntityRefSchema>;
export type LocalizedText = z.infer<typeof LocalizedTextSchema>;
