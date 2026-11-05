import { describe, expect, it } from "vitest";
import { mergeEvents, parseStreamMessage } from "@/lib/live-stream";
import type { Event, GameState } from "@/lib/types";

const STATE: GameState = {
  status: "live",
  inning: 3,
  half: "bottom",
  outs: 1,
  count: { balls: 2, strikes: 1 },
  bases: { first: "a", second: null, third: "c" },
  score: { home: 4, away: 2 },
  battingTeam: "home",
  lastSeq: 7,
};

function message(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    type: "state",
    gameId: "game-1",
    seq: 7,
    lastSeq: 7,
    state: STATE,
    ...overrides,
  });
}

function note(id: string, seq: number): Event {
  return {
    contract: "olb.event/1",
    id,
    gameId: "game-1",
    seq,
    occurredAt: "2026-03-14T18:00:00.000Z",
    recordedAt: "2026-03-14T18:00:00.000Z",
    source: "human",
    actor: { kind: "service", id: "test" },
    type: "note",
    payload: { text: id },
  } as Event;
}

describe("parseStreamMessage", () => {
  it("accepts snapshot and state frames", () => {
    expect(parseStreamMessage(message({ type: "snapshot" }))?.type).toBe("snapshot");
    expect(parseStreamMessage(message())?.state).toEqual(STATE);
  });

  it("ignores malformed JSON, unknown types and states without a cursor", () => {
    expect(parseStreamMessage("not json")).toBeNull();
    expect(parseStreamMessage(message({ type: "ping" }))).toBeNull();
    expect(parseStreamMessage(message({ state: { status: "live" } }))).toBeNull();
    expect(parseStreamMessage("[]")).toBeNull();
  });
});

describe("mergeEvents", () => {
  it("appends unseen events and keeps the cursor order", () => {
    const merged = mergeEvents([note("b", 2)], [note("c", 3), note("a", 1)]);

    expect(merged.map((event) => event.id)).toEqual(["a", "b", "c"]);
  });

  it("replaces a repeated id instead of duplicating it", () => {
    const original = note("a", 1);
    const corrected = { ...note("a", 1), payload: { text: "corrected" } } as Event;
    const merged = mergeEvents([original], [corrected]);

    expect(merged).toHaveLength(1);
    expect(merged[0]).toEqual(corrected);
  });
});
