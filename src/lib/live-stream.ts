import type { Event, GameState } from "./types";

/** SSE payload published by `olb-api` on `/games/:id/stream`. */
export interface GameStreamMessage {
  type: "snapshot" | "state";
  gameId: string;
  seq: number;
  lastSeq: number;
  state: GameState;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * The stream endpoint sends JSON in `event.data`. Anything malformed or of an
 * unknown type is ignored so a bad frame never replaces a good snapshot.
 */
export function parseStreamMessage(data: string): GameStreamMessage | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(data) as unknown;
  } catch {
    return null;
  }

  if (!isRecord(parsed)) return null;
  if (parsed.type !== "snapshot" && parsed.type !== "state") return null;
  if (!isRecord(parsed.state)) return null;

  const state = parsed.state;
  if (typeof state.lastSeq !== "number" || typeof state.status !== "string") return null;

  return parsed as unknown as GameStreamMessage;
}

/**
 * Merges a cursor read into the events already rendered. Identity is the event
 * id; a repeated id replaces its earlier copy instead of duplicating the feed.
 */
export function mergeEvents(previous: readonly Event[], fresh: readonly Event[]): Event[] {
  const merged = previous.slice();
  const positions = new Map<string, number>();
  merged.forEach((event, index) => positions.set(event.id, index));

  for (const event of fresh) {
    const position = positions.get(event.id);
    if (position === undefined) {
      positions.set(event.id, merged.length);
      merged.push(event);
    } else {
      merged[position] = event;
    }
  }

  return merged.sort((a, b) => a.seq - b.seq);
}
