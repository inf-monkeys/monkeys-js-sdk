import { I18nTextSchema } from './declarative-control';
import { z } from 'zod';
import { ContractIdentifierSchema, JsonObjectSchema } from './common';

const member = z.string().min(1).max(256).refine(
  (value) => !['__proto__', 'prototype', 'constructor'].includes(value),
  'Unsafe component member.',
);

/** A bounded projection of callback arguments, never executable source. */
export const ComponentEventArgumentSchema = z.object({
  argument: z.number().int().min(0).max(31),
  path: z.array(member).max(16).default([]),
}).strict();

export const ComponentEventBindingSchema = z.object({
  port: ContractIdentifierSchema,
  arguments: z.array(ComponentEventArgumentSchema).max(32).default([]),
  preventDefault: z.boolean().default(false),
  stopPropagation: z.boolean().default(false),
}).strict();

export const ComponentMessageSchema = z.union([
  ContractIdentifierSchema,
  z.object({ textI18n: I18nTextSchema }).strict(),
  z.object({ key: ContractIdentifierSchema, values: z.record(member, z.union([z.string(), z.number().finite(), z.boolean()])).default({}) }).strict(),
]);

/** An explicit text location inside existing JSON props, never executable source. */
export const ComponentMessageBindingSchema = z.object({
  path: z.array(z.union([
    member.refine(value => !/[\u0000-\u001f\u007f-\u009f]/.test(value), 'Invalid component path member.'),
    z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
  ])).min(1).max(16),
  message: ComponentMessageSchema,
}).strict();

/** Optional adaptation of original React props on an existing RenderNode. */
export const ComponentAssemblySchema = z.object({
  contract: z.literal('ComponentAssembly'),
  schemaVersion: z.literal(1),
  props: JsonObjectSchema.default({}),
  events: z.record(member, ComponentEventBindingSchema).default({}),
  // Each name remains an explicit RenderTree slot; array order controls composition.
  slots: z.record(member, z.union([ContractIdentifierSchema, z.array(ContractIdentifierSchema).min(1).max(256).refine(names => new Set(names).size === names.length, 'Component slot names must be unique.')])).default({}),
  renderers: z.record(member, ContractIdentifierSchema).default({}),
  hosts: z.record(member, ContractIdentifierSchema).default({}),
  messages: z.record(member, ComponentMessageSchema).default({}),
  messageBindings: z.array(ComponentMessageBindingSchema).max(256).optional(),
}).strict().superRefine((value, context) => {
  const paths = value.messageBindings?.map(binding => binding.path) ?? [];
  for (const [index, path] of paths.entries()) {
    if (typeof path[0] !== 'string' || Object.prototype.hasOwnProperty.call(value.messages, path[0]) || paths.slice(0, index).some(previous => previous.every((part, offset) => path[offset] === part) || path.every((part, offset) => previous[offset] === part))) {
      context.addIssue({ code: 'custom', path: ['messageBindings', index, 'path'], message: 'Localized paths need a named root and unique, non-overlapping ownership.' });
    }
  }
  const seen = new Set<string>();
  for (const group of ['props', 'events', 'slots', 'renderers', 'hosts', 'messages'] as const) {
    for (const key of Object.keys(value[group])) {
      if (!member.safeParse(key).success || seen.has(key)) {
        context.addIssue({ code: 'custom', path: [group, key], message: 'Component prop has an unsafe or duplicate owner.' });
      }
      seen.add(key);
    }
  }
});

export type ComponentMessage = z.infer<typeof ComponentMessageSchema>;
export type ComponentMessageBinding = z.infer<typeof ComponentMessageBindingSchema>;
export type ComponentEventArgument = z.infer<typeof ComponentEventArgumentSchema>;
export type ComponentEventBinding = z.infer<typeof ComponentEventBindingSchema>;
export type ComponentAssembly = z.infer<typeof ComponentAssemblySchema>;

export interface ComponentPropDescriptor {
  name: string;
  type: string;
  required: boolean;
  kind: 'property' | 'slot' | 'event' | 'renderer' | 'host';
  accepts?: readonly ('property' | 'slot' | 'event' | 'renderer' | 'host')[];
  defaultValue?: unknown;
  schema?: Record<string, unknown> | boolean;
  parameters?: readonly { name: string; type: string }[];
  result?: string;
}

export interface ComponentAssemblyDescriptor {
  id: string;
  version: 1;
  source: string;
  exports: readonly { entrypoint: string; export: string }[];
  props: readonly ComponentPropDescriptor[];
  variants?: readonly { required: readonly string[]; allowed: readonly string[]; properties: Record<string, Record<string, unknown> | boolean> }[];
  stateBindings?: readonly { prop: string; defaultProp?: string; event: string; argument: number; path: readonly string[] }[];
}
