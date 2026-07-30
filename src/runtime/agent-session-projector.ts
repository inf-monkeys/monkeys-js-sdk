import {
  AgentSessionEventSchema,
  AgentSessionViewModelSchema,
  type AgentSessionEvent,
  type AgentSessionSnapshot,
  type AgentSessionStatus,
  type AgentSessionViewModel,
} from "../contracts/agent";

export interface AgentSessionEventGap {
  expectedSequence: number;
  receivedSequence: number;
}

export interface AgentSessionEventProjection {
  sessionId: string;
  events: AgentSessionEvent[];
  lastSequence: number;
  status: AgentSessionStatus;
  resumable: boolean;
  gap?: AgentSessionEventGap;
}

export function createAgentSessionEventProjection(
  sessionId: string,
): AgentSessionEventProjection {
  return {
    sessionId,
    events: [],
    lastSequence: -1,
    status: "queued",
    resumable: false,
  };
}

export function projectAgentSessionEvents(
  current: AgentSessionEventProjection,
  candidates: readonly unknown[],
): AgentSessionEventProjection {
  const parsed = candidates.map((candidate) =>
    AgentSessionEventSchema.parse(candidate),
  );
  if (parsed.some((event) => event.sessionId !== current.sessionId)) {
    throw new TypeError(
      "Agent session event sessionId does not match the projection sessionId.",
    );
  }

  const eventIds = new Set(current.events.map((event) => event.eventId));
  const idempotencyKeys = new Set(
    current.events.map((event) => event.idempotencyKey),
  );
  const eventsBySequence = new Map(
    current.events.map((event) => [event.sequence, event] as const),
  );
  const acceptedCandidates: AgentSessionEvent[] = [];
  for (const event of parsed.sort(
    (left, right) => left.sequence - right.sequence,
  )) {
    if (
      eventIds.has(event.eventId) ||
      idempotencyKeys.has(event.idempotencyKey)
    )
      continue;
    const existing = eventsBySequence.get(event.sequence);
    if (existing) {
      throw new TypeError(
        `Conflicting Agent session events share sequence ${event.sequence}.`,
      );
    }
    eventsBySequence.set(event.sequence, event);
    eventIds.add(event.eventId);
    idempotencyKeys.add(event.idempotencyKey);
    acceptedCandidates.push(event);
  }

  for (const event of acceptedCandidates)
    eventsBySequence.delete(event.sequence);

  let expectedSequence = current.lastSequence + 1;
  let gap: AgentSessionEventGap | undefined;
  for (const event of acceptedCandidates) {
    if (event.sequence < expectedSequence) {
      throw new TypeError(
        `Agent session event sequence ${event.sequence} is behind the recovery cursor.`,
      );
    }
    if (event.sequence > expectedSequence) {
      gap = { expectedSequence, receivedSequence: event.sequence };
      break;
    }
    eventsBySequence.set(event.sequence, event);
    eventIds.add(event.eventId);
    idempotencyKeys.add(event.idempotencyKey);
    expectedSequence += 1;
  }

  const events = [...eventsBySequence.values()].sort(
    (left, right) => left.sequence - right.sequence,
  );
  let status: AgentSessionStatus = "queued";
  let resumable = false;
  for (const event of events) {
    if (event.eventType === "status") status = event.payload.status;
    if (event.eventType === "resume") resumable = event.payload.resumable;
  }
  return {
    sessionId: current.sessionId,
    events,
    lastSequence: events.length > 0 ? events[events.length - 1].sequence : -1,
    status,
    resumable,
    ...(gap ? { gap } : {}),
  };
}

export function toAgentSessionViewModel(
  projection: AgentSessionEventProjection,
  snapshot: AgentSessionSnapshot,
): AgentSessionViewModel {
  return AgentSessionViewModelSchema.parse({
    contract: "AgentSessionViewModel",
    sessionId: projection.sessionId,
    snapshot,
    status: projection.status,
    events: projection.events,
    lastSequence: projection.lastSequence,
    resumable: projection.resumable,
  });
}
