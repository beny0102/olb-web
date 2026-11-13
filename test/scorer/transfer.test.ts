import { describe, expect, it } from "vitest";
import type { Event } from "@olb/contract/types";
import { MemoryGameStore } from "../../src/lib/scorer/db";
import { gameStart, pitch } from "../../src/lib/scorer/events";
import { DEFAULT_RULES } from "../../src/lib/scorer/rules";
import {
  exportLocalBundle,
  importLocalBundle,
  LOCAL_BUNDLE_FORMAT,
  readLocalBundle,
} from "../../src/lib/scorer/transfer";
import type { LocalGame } from "../../src/lib/scorer/types";
import { uuid7 } from "../../src/lib/scorer/uuid7";

const gameId = uuid7();

function localGame(overrides: Partial<LocalGame> = {}): LocalGame {
  return {
    id: gameId,
    homeTeam: "Locales",
    awayTeam: "Visitantes",
    scheduledStart: null,
    venue: null,
    createdAt: "2026-04-11T23:00:00.000Z",
    lineups: { home: null, away: null },
    rules: DEFAULT_RULES,
    ...overrides,
  };
}

function pitchEvent(seq: number): Event {
  return pitch(gameId, seq, {
    pitchNo: seq,
    batter: uuid7(),
    pitcher: uuid7(),
    count: { balls: 0, strikes: 0 },
    call: "B",
  });
}

describe("local bundle export", () => {
  it("writes the versioned envelope with games and their full log", async () => {
    const store = new MemoryGameStore();
    await store.putGame(localGame({ rosters: { home: [], away: [] } }));
    await store.appendEvent(gameId, gameStart(gameId, 0));
    await store.appendEvent(gameId, pitchEvent(1));

    const bundle = await exportLocalBundle(store);

    expect(bundle.format).toBe(LOCAL_BUNDLE_FORMAT);
    expect(Number.isNaN(Date.parse(bundle.exportedAt))).toBe(false);
    expect(bundle.games).toHaveLength(1);
    expect(bundle.games[0]?.game).toMatchObject({
      id: gameId,
      homeTeam: "Locales",
      awayTeam: "Visitantes",
      rules: DEFAULT_RULES,
      rosters: { home: [], away: [] },
    });
    expect(bundle.games[0]?.events.map((entry) => entry.event.type)).toEqual([
      "game.start",
      "pitch",
    ]);
    expect(bundle.games[0]?.events.every((entry) => entry.status === "pending")).toBe(true);
    expect(readLocalBundle(JSON.parse(JSON.stringify(bundle)))).toEqual(bundle);
  });

  it("exports an empty bundle when the device has no games", async () => {
    const bundle = await exportLocalBundle(new MemoryGameStore());

    expect(bundle).toMatchObject({
      format: LOCAL_BUNDLE_FORMAT,
      games: [],
    });
  });
});

describe("local bundle import", () => {
  it("restores a game and its events on a clean store", async () => {
    const source = new MemoryGameStore();
    await source.putGame(localGame());
    await source.appendEvent(gameId, gameStart(gameId, 0));
    await source.appendEvent(gameId, pitchEvent(1));
    const bundle = await exportLocalBundle(source);

    const target = new MemoryGameStore();
    const summary = await importLocalBundle(JSON.parse(JSON.stringify(bundle)), target);

    expect(summary).toEqual({ games: 1, events: 2, skipped: 0 });
    expect(await target.getGame(gameId)).toMatchObject({ id: gameId, homeTeam: "Locales" });
    const events = await target.listEvents(gameId);
    expect(events.map((entry) => entry.localSeq)).toEqual([0, 1]);
    expect(events.map((entry) => entry.status)).toEqual(["pending", "pending"]);
    expect(events.map((entry) => entry.event.type)).toEqual(["game.start", "pitch"]);
  });

  it("keeps an existing game and skips events already present by id", async () => {
    const source = new MemoryGameStore();
    await source.putGame(localGame());
    const start = gameStart(gameId, 0);
    await source.appendEvent(gameId, start);
    await source.appendEvent(gameId, pitchEvent(1));
    const bundle = await exportLocalBundle(source);

    const target = new MemoryGameStore();
    await target.putGame(localGame({ homeTeam: "Editado en este dispositivo" }));
    await target.appendEvent(gameId, start);

    const summary = await importLocalBundle(bundle, target);

    expect(summary).toEqual({ games: 0, events: 1, skipped: 2 });
    expect((await target.getGame(gameId))?.homeTeam).toBe("Editado en este dispositivo");
    const events = await target.listEvents(gameId);
    expect(events).toHaveLength(2);
    expect(events[1]?.localSeq).toBe(1);
    expect(events[1]?.event.type).toBe("pitch");
  });

  it("rejects a malformed bundle", async () => {
    const target = new MemoryGameStore();
    const invalid = [
      null,
      {},
      { format: "olb.local-games/2", exportedAt: new Date().toISOString(), games: [] },
      { format: LOCAL_BUNDLE_FORMAT, games: [] },
      {
        format: LOCAL_BUNDLE_FORMAT,
        exportedAt: new Date().toISOString(),
        games: [{ game: { id: "" }, events: [] }],
      },
      {
        format: LOCAL_BUNDLE_FORMAT,
        exportedAt: new Date().toISOString(),
        games: [{ game: localGame(), events: [{ event: { id: "x" } }] }],
      },
    ];

    for (const value of invalid) {
      await expect(importLocalBundle(value, target)).rejects.toThrow(
        "El archivo no es un paquete de partidas locales válido.",
      );
    }
    expect(await target.listGames()).toEqual([]);
  });

  it("imports an empty bundle without touching the store", async () => {
    const store = new MemoryGameStore();
    const summary = await importLocalBundle(
      {
        format: LOCAL_BUNDLE_FORMAT,
        exportedAt: new Date().toISOString(),
        games: [],
      },
      store,
    );

    expect(summary).toEqual({ games: 0, events: 0, skipped: 0 });
    expect(await store.listGames()).toEqual([]);
  });
});
