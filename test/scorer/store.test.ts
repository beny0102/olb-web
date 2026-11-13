import { describe, expect, it } from "vitest";
import type { Event } from "@olb/contract/types";
import { foldStored, MemoryGameStore } from "../../src/lib/scorer/db";
import { foldEvents } from "../../src/lib/scorer/fold";
import { gameStart } from "../../src/lib/scorer/events";
import { DEFAULT_RULES } from "../../src/lib/scorer/rules";
import type { LocalGame } from "../../src/lib/scorer/types";
import { uuid7 } from "../../src/lib/scorer/uuid7";

const gameId = uuid7();

function pitch(seq: number, call: string): Event {
  return {
    contract: "olb.event/1",
    id: uuid7(),
    gameId,
    seq,
    occurredAt: "2026-04-11T23:41:07.412Z",
    recordedAt: "2026-04-11T23:41:07.412Z",
    type: "pitch",
    source: "human",
    actor: { kind: "user", id: "test" },
    payload: {
      pitchNo: seq,
      batter: uuid7(),
      pitcher: uuid7(),
      count: { balls: 0, strikes: 0 },
      call,
    },
  } as Event;
}

const localGame: LocalGame = {
  id: gameId,
  homeTeam: "Locales",
  awayTeam: "Visitantes",
  scheduledStart: null,
  venue: null,
  createdAt: "2026-04-11T23:00:00.000Z",
  lineups: { home: null, away: null },
  rules: DEFAULT_RULES,
};

describe("MemoryGameStore", () => {
  it("stores and lists games", async () => {
    const store = new MemoryGameStore();
    await store.putGame(localGame);

    expect(await store.getGame(gameId)).toEqual(localGame);
    expect(await store.listGames()).toEqual([localGame]);
    expect(await store.getGame(uuid7())).toBeNull();
  });

  it("assigns local sequence numbers 0, 1, 2 and keeps order", async () => {
    const store = new MemoryGameStore();
    const events = [gameStart(gameId, 0), pitch(1, "B"), pitch(2, "S")];

    const stored = await Promise.all(
      events.map((event) => store.appendEvent(gameId, event)),
    );

    expect(stored.map((entry) => entry.localSeq)).toEqual([0, 1, 2]);
    expect(stored.every((entry) => entry.status === "pending")).toBe(true);

    const listed = await store.listEvents(gameId);
    expect(listed.map((entry) => entry.localSeq)).toEqual([0, 1, 2]);
    expect(listed.map((entry) => entry.event.type)).toEqual([
      "game.start",
      "pitch",
      "pitch",
    ]);
    expect(await store.pendingEvents(gameId)).toHaveLength(3);
  });

  it("markSynced keeps the local order and stores the server event", async () => {
    const store = new MemoryGameStore();
    await store.appendEvent(gameId, gameStart(gameId, 0));
    await store.appendEvent(gameId, pitch(1, "B"));
    await store.appendEvent(gameId, pitch(2, "S"));

    const serverEvent: Event = { ...pitch(7, "B"), seq: 42 };
    await store.markSynced(gameId, 1, serverEvent);

    const listed = await store.listEvents(gameId);
    expect(listed.map((entry) => entry.localSeq)).toEqual([0, 1, 2]);
    expect(listed[1]?.status).toBe("synced");
    expect(listed[1]?.event.seq).toBe(42);
    expect((await store.pendingEvents(gameId)).map((entry) => entry.localSeq)).toEqual([0, 2]);
  });

  it("rejects markSynced for a missing local event", async () => {
    const store = new MemoryGameStore();
    await expect(store.markSynced(gameId, 99, pitch(1, "B"))).rejects.toThrow();
  });

  it("foldStored matches foldEvents on the renumbered log", async () => {
    const store = new MemoryGameStore();
    const events = [gameStart(gameId, 0), pitch(1, "B"), pitch(2, "S"), pitch(3, "F")];
    for (const event of events) await store.appendEvent(gameId, event);

    const stored = await store.listEvents(gameId);
    const renumbered = stored.map((entry) => ({ ...entry.event, seq: entry.localSeq }));

    expect(foldStored(stored)).toEqual(foldEvents(renumbered));
    expect(foldStored(stored)).toMatchObject({
      status: "live",
      count: { balls: 1, strikes: 2 },
      lastSeq: 3,
    });
  });
});
