import { PageStreamEventSchema, PageStreamDescriptorSchema, PAGE_STREAM_MAX_BUFFER_BYTES, PAGE_STREAM_MAX_BUFFER_EVENTS, PAGE_STREAM_MAX_FRAME_BYTES } from '../contracts/page-stream';
import type { JsonObject } from '../contracts/common';
import { canonicalContentHash } from './declarative-control-compiler';
export type PageStreamReducerErrorCode = 'PAGE_STREAM_INVALID_FRAME' | 'PAGE_STREAM_ID_MISMATCH' | 'PAGE_STREAM_SNAPSHOT_REQUIRED' | 'PAGE_STREAM_SEQUENCE_CONFLICT' | 'PAGE_STREAM_SEQUENCE_GAP' | 'PAGE_STREAM_TERMINATED' | 'PAGE_STREAM_CAPACITY_EXCEEDED';
export class PageStreamReducerError extends Error { constructor(readonly code: PageStreamReducerErrorCode) { super(code); this.name = 'PageStreamReducerError'; } }
export interface PageStreamState {
 readonly streamId: string;
 readonly status: 'awaiting-snapshot' | 'open' | 'ended' | 'error';
 readonly model: JsonObject | undefined;
 readonly events: readonly JsonObject[];
 readonly sequence: number;
 readonly cursor: string | undefined;
 readonly error: { code: string; retryable: boolean } | undefined;
 readonly seen: Readonly<Record<string, string>>;
 readonly retainedBytes: number;
}
export function createPageStreamState(streamId: string): PageStreamState {
 if (!PageStreamDescriptorSchema.shape.streamId.safeParse(streamId).success) throw new PageStreamReducerError('PAGE_STREAM_ID_MISMATCH');
 return { streamId, status: 'awaiting-snapshot', model: undefined, events: [], sequence: 0, cursor: undefined, error: undefined, seen: {}, retainedBytes: 0 };
}
const MAX_SEEN_FRAMES = 2048;
const bytes = (value: unknown) => new TextEncoder().encode(JSON.stringify(value)).byteLength;
/** Verified snapshots replace presentation state; deltas retain every event or reject atomically. */
export function applyPageStreamEvent(state: PageStreamState, input: unknown): PageStreamState {
 let frame: ReturnType<typeof PageStreamEventSchema.parse>;
 try { if (bytes(input) > PAGE_STREAM_MAX_FRAME_BYTES) throw new Error(); frame = PageStreamEventSchema.parse(input); }
 catch { throw new PageStreamReducerError('PAGE_STREAM_INVALID_FRAME'); }
 if (frame.streamId !== state.streamId) throw new PageStreamReducerError('PAGE_STREAM_ID_MISMATCH');
 const fingerprint = canonicalContentHash(frame);
 const seen = state.seen[String(frame.sequence)];
 if (seen) { if (seen === fingerprint) return state; throw new PageStreamReducerError('PAGE_STREAM_SEQUENCE_CONFLICT'); }
 if (state.status === 'ended' || state.status === 'error') throw new PageStreamReducerError('PAGE_STREAM_TERMINATED');
 if (state.status === 'awaiting-snapshot') { if (frame.type !== 'snapshot') throw new PageStreamReducerError('PAGE_STREAM_SNAPSHOT_REQUIRED'); }
 else if (frame.sequence !== state.sequence + 1) throw new PageStreamReducerError(frame.sequence <= state.sequence ? 'PAGE_STREAM_SEQUENCE_CONFLICT' : 'PAGE_STREAM_SEQUENCE_GAP');
 const model = frame.type === 'snapshot' ? frame.payload.model : state.model;
 const events = frame.type === 'snapshot' ? [] : frame.type === 'delta' ? [...state.events, ...frame.payload.events] : state.events;
 // A snapshot replaces the model and replay baseline. Deltas retain a bounded
 // fingerprint window; replay older than that window still fails sequence checks.
 const nextSeen = frame.type === 'snapshot' ? { [String(frame.sequence)]: fingerprint } : {
  ...Object.fromEntries(Object.entries(state.seen).filter(([sequence]) => Number(sequence) > frame.sequence - MAX_SEEN_FRAMES)),
  [String(frame.sequence)]: fingerprint,
 };
 const retainedBytes = bytes({ model, events, seen: nextSeen });
 if (events.length > PAGE_STREAM_MAX_BUFFER_EVENTS || retainedBytes > PAGE_STREAM_MAX_BUFFER_BYTES) throw new PageStreamReducerError('PAGE_STREAM_CAPACITY_EXCEEDED');
 return { streamId: state.streamId, model, events, sequence: frame.sequence, cursor: frame.cursor, seen: nextSeen, retainedBytes,
 status: frame.type === 'end' ? 'ended' : frame.type === 'error' ? 'error' : 'open', error: frame.type === 'error' ? frame.payload : undefined };
}
