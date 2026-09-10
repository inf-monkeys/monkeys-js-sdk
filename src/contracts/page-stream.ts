import { z } from 'zod';
import { IsoDateTimeSchema, JsonObjectSchema } from './common';
import { DECLARATIVE_CONTROL_API_PREFIX } from './declarative-control-http';

/** Draft: no shared exports until server/client fixed-route support is integrated. */
export const PAGE_STREAM_MAX_FRAME_BYTES = 256 * 1024;
export const PAGE_STREAM_MAX_BUFFER_BYTES = 2 * 1024 * 1024;
export const PAGE_STREAM_MAX_BUFFER_EVENTS = 2048;
export const PAGE_STREAM_MAX_CURSOR_LENGTH = 2048;
export const PAGE_STREAM_MAX_INPUT_BYTES = 8192;
export const PAGE_STREAM_MAX_EVENT_ITEMS = 256;
const StreamIdSchema = z.string().min(1).max(256).regex(/^[^\u0000-\u001f\u007f]+$/);
const CursorSchema = z.string().min(1).max(PAGE_STREAM_MAX_CURSOR_LENGTH).regex(/^[^\u0000-\u001f\u007f]+$/);
const SequenceSchema = z.number().int().min(1).max(Number.MAX_SAFE_INTEGER);

/** Opaque handle, never authorization. Server binds principal/team/release/page/binding/scope
 * and reauthorizes each connect/control. Neither URLs nor caller-authored scope are accepted. */
export const PageStreamDescriptorSchema = z.object({
  contract: z.literal('PageStreamDescriptor'), schemaVersion: z.literal(1),
  streamId: StreamIdSchema, expiresAt: IsoDateTimeSchema,
  channel: z.enum(['terminal', 'events']), cursor: CursorSchema.optional(),
}).strict();
export const PageStreamConnectSchema = z.object({ cursor: CursorSchema.optional() }).strict();
const base = {
  contract: z.literal('PageStreamEvent'), schemaVersion: z.literal(1),
  streamId: StreamIdSchema, sequence: SequenceSchema, cursor: CursorSchema,
};
/** First accepted frame must be snapshot. Exact duplicates compare cursor+payload;
 * conflicting duplicates/gaps reconnect using only last verified cursor. Transport rejects
 * oversized SSE frames before parsing and bounds retained bytes/events to constants above. */
export const PageStreamEventSchema = z.discriminatedUnion('type', [
  z.object({ ...base, type: z.literal('snapshot'), payload: z.object({ model: JsonObjectSchema }).strict() }).strict(),
  z.object({ ...base, type: z.literal('delta'), payload: z.object({ events: z.array(JsonObjectSchema).max(PAGE_STREAM_MAX_EVENT_ITEMS) }).strict() }).strict(),
  z.object({ ...base, type: z.literal('end'), payload: z.object({}).strict() }).strict(),
  z.object({ ...base, type: z.literal('error'), payload: z.object({ code: z.string().min(1).max(128), retryable: z.boolean() }).strict() }).strict(),
]).superRefine((value, context) => {
  if (new TextEncoder().encode(JSON.stringify(value)).byteLength > PAGE_STREAM_MAX_FRAME_BYTES)
    context.addIssue({ code: 'custom', message: 'Page stream frame exceeds the UTF-8 byte limit.' });
});
/** Reuse requestId on retries. Server deduplicates before PTY mutation; credentials never
 * travel in payload. stream.disconnect closes this descriptor lease, not the backing workload. */
export const PageStreamControlSchema = z.discriminatedUnion('port', [
  z.object({ requestId: z.string().uuid(), port: z.literal('terminal.input'), payload: z.object({ data: z.string().min(1).max(PAGE_STREAM_MAX_INPUT_BYTES) }).strict() }).strict(),
  z.object({ requestId: z.string().uuid(), port: z.literal('terminal.resize'), payload: z.object({ columns: z.number().int().min(1).max(1000), rows: z.number().int().min(1).max(1000) }).strict() }).strict(),
  z.object({ requestId: z.string().uuid(), port: z.literal('stream.disconnect'), payload: z.object({}).strict() }).strict(),
]).superRefine((value, context) => {
  if (value.port === 'terminal.input' && new TextEncoder().encode(value.payload.data).byteLength > PAGE_STREAM_MAX_INPUT_BYTES)
    context.addIssue({ code: 'custom', path: ['payload', 'data'], message: 'Terminal input exceeds the UTF-8 byte limit.' });
});
const route = (releaseSlotId: string, bindingId: string, streamId: string) => {
  StreamIdSchema.parse(streamId);
  if (streamId === '.' || streamId === '..') throw new TypeError('Invalid stream route identifier');
  for (const segment of [releaseSlotId, bindingId]) if (!segment || segment.length > 256 || /[\u0000-\u001f\u007f]/.test(segment) || segment === '.' || segment === '..') throw new TypeError('Invalid stream route identifier');
  return `${DECLARATIVE_CONTROL_API_PREFIX}/runtime/pages/${encodeURIComponent(releaseSlotId)}/bindings/${encodeURIComponent(bindingId)}/streams/${encodeURIComponent(streamId)}`;
};
export const pageStreamRoutes = {
  events: (releaseSlotId: string, bindingId: string, streamId: string) => `${route(releaseSlotId, bindingId, streamId)}/events`,
  terminal: (releaseSlotId: string, bindingId: string, streamId: string) => `${route(releaseSlotId, bindingId, streamId)}/terminal`,
  control: (releaseSlotId: string, bindingId: string, streamId: string) => `${route(releaseSlotId, bindingId, streamId)}/control`,
} as const;
export const PageStreamControlResultSchema = z.object({ requestId: z.string().uuid(), accepted: z.literal(true) }).strict();
export type PageStreamControlResult = z.infer<typeof PageStreamControlResultSchema>;
export type PageStreamDescriptor = z.infer<typeof PageStreamDescriptorSchema>;
export type PageStreamEvent = z.infer<typeof PageStreamEventSchema>;
export type PageStreamControl = z.infer<typeof PageStreamControlSchema>;
