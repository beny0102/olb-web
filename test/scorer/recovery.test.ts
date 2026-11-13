import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Event } from "@olb/contract/types";
import {
  ApiError,
  listGameEvents,
  prepareLeagueGame,
} from "../../src/lib/scorer/api";
import { MemoryGameStore } from "../../src/lib/scorer/db";
import { gameStart, pitch } from "../../src/lib/scorer/events";
import { buildStartEvents } from "../../src/lib/scorer/setup";
import { recoverGame } from "../../src/lib/scorer/recovery";
import {
  canStartGame,
  lineupStartErrors,
  rosterStartErrors,
} from "../../src/lib/scorer/start";
import { rosterToLineup } from "../../src/lib/scorer/roster";
import { DEFAULT_RULES } from "../../src/lib/scorer/rules";
import { uuid7 } from "../../src/lib/scorer/uuid7";
import type { LocalGame, RosterPlayer, TeamSide } from "../../src/lib/scorer/types";

vi.mock("../../src/lib/scorer/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../src/lib/scorer/api")>();
  return {
    ...actual,
    prepareLeagueGame: vi.fn(),
    listGameEvents: vi.fn(),
  };
});

const prepareMock = vi.mocked(prepareLeagueGame);
const eventsMock = vi.mocked(listGameEvents);

const gameId = uuid7();

function roster(): RosterPlayer[] {
  const positions = ["C", "1B", "2B", "3B", "SS", "LF", "CF", "RF", "DH", "P"];
  return positions.map((position, index) => ({
    id: uuid7(),
    name: `${position} ${index + 1}`,
    position,
    jersey: String(index + 1),
  }));
}

const homeRoster = roster();
const awayRoster = roster();

function localGame(overrides: Partial<LocalGame> = {}): LocalGame {
  return {
    id: gameId,
    homeTeam: "Tiburones",
    awayTeam: "Marlins",
    scheduledStart: "2027-04-10T23:00:00.000Z",
    venue: "Estadio Centenario",
    createdAt: "2026-11-04T15:11:58.892Z",
    lineups: { home: null, away: null },
    rules: DEFAULT_RULES,
    rosters: { home: homeRoster, away: awayRoster },
    teamSeasonIds: { home: uuid7(), away: uuid7() },
    ...overrides,
  };
}

function lineups(): { home: ReturnType<typeof rosterToLineup>["lineup"]; away: ReturnType<typeof rosterToLineup>["lineup"] } {
  return {
    home: rosterToLineup(homeRoster, "home", DEFAULT_RULES).lineup,
    away: rosterToLineup(awayRoster, "away", DEFAULT_RULES).lineup,
  };
}

function serverEvents(): Event[] {
  const sides = lineups();
  const start = buildStartEvents(
    localGame(),
    { home: sides.home!, away: sides.away! },
    0,
  );
  return [
    ...start,
    pitch(gameId, 3, {
      pitchNo: 1,
      batter: sides.away!.players[0]!.id,
      pitcher: sides.home!.pitcherId,
      count: { balls: 0, strikes: 0 },
      call: "B",
    }),
  ];
}

function serverEventAt(seq: number, call: "B" | "S"): Event {
  return pitch(gameId, seq, {
    pitchNo: seq,
    batter: uuid7(),
    pitcher: uuid7(),
    count: { balls: 0, strikes: 0 },
    call,
  });
}

beforeEach(() => {
  prepareMock.mockReset();
  eventsMock.mockReset();
});

describe("importSyncedEvents", () => {
  it("imports after the current max, keeps order, dedupes and leaves pending intact", async () => {
    const store = new MemoryGameStore();
    await store.putGame(localGame());
    await store.appendEvent(gameId, gameStart(gameId, 0));

    const first = serverEventAt(1, "B");
    const second = serverEventAt(2, "S");
    const imported = await store.importSyncedEvents(gameId, [
      first,
      second,
      first,
    ]);

    expect(imported).toBe(2);
    const listed = await store.listEvents(gameId);
    expect(listed.map((entry) => entry.localSeq)).toEqual([0, 1, 2]);
    expect(listed.map((entry) => entry.status)).toEqual([
      "pending",
      "synced",
      "synced",
    ]);
    expect(listed.slice(1).map((entry) => entry.event.id)).toEqual([
      first.id,
      second.id,
    ]);
    expect(await store.pendingEvents(gameId)).toHaveLength(1);

    expect(await store.importSyncedEvents(gameId, [first, second])).toBe(0);
    expect(await store.listEvents(gameId)).toHaveLength(3);
  });
});

describe("recoverGame", () => {
  it("saves a game with no local record and imports every server event", async () => {
    const store = new MemoryGameStore();
    const prepared = localGame();
    const events = serverEvents();
    prepareMock.mockResolvedValue(prepared);
    eventsMock.mockResolvedValue(events);

    const result = await recoverGame(gameId, store);

    expect(result.imported).toBe(events.length);
    expect(result.game.id).toBe(gameId);
    const stored = await store.getGame(gameId);
    expect(stored?.rosters?.home).toHaveLength(10);
    expect(await store.listEvents(gameId)).toHaveLength(events.length);
    expect((await store.listEvents(gameId)).every((entry) => entry.status === "synced")).toBe(
      true,
    );

    // The fold ignores lineup.set, so recovery rebuilds the lineups from it.
    expect(result.game.lineups.away).not.toBeNull();
    expect(result.game.lineups.home?.players[0]?.name).toBe(homeRoster[0]!.name);
  });

  it("is idempotent: a second recovery imports zero and keeps the order", async () => {
    const store = new MemoryGameStore();
    const events = serverEvents();
    prepareMock.mockResolvedValue(localGame());
    eventsMock.mockResolvedValue(events);

    const first = await recoverGame(gameId, store);
    const second = await recoverGame(gameId, store);

    expect(first.imported).toBe(events.length);
    expect(second.imported).toBe(0);
    expect((await store.listEvents(gameId)).map((entry) => entry.localSeq)).toEqual(
      events.map((_, index) => index),
    );
  });

  it("imports only missing events when the local log already has synced entries", async () => {
    const store = new MemoryGameStore();
    const events = serverEvents();
    await store.putGame(localGame());
    await store.importSyncedEvents(gameId, events.slice(0, 2));
    prepareMock.mockResolvedValue(localGame());
    eventsMock.mockResolvedValue(events);

    const result = await recoverGame(gameId, store);

    expect(result.imported).toBe(2);
    expect(await store.listEvents(gameId)).toHaveLength(events.length);
  });

  it("does not reorder a local game with pending events", async () => {
    const store = new MemoryGameStore();
    const local = localGame();
    await store.putGame(local);
    const pending = serverEventAt(0, "B");
    await store.appendEvent(gameId, pending);
    prepareMock.mockResolvedValue(local);
    eventsMock.mockResolvedValue([serverEventAt(0, "S")]);

    const result = await recoverGame(gameId, store);

    expect(result.imported).toBe(0);
    expect(prepareMock).not.toHaveBeenCalled();
    expect(eventsMock).not.toHaveBeenCalled();
    expect((await store.listEvents(gameId)).map((entry) => entry.event.id)).toEqual([
      pending.id,
    ]);
  });

  it("keeps a local lineup that is already saved", async () => {
    const store = new MemoryGameStore();
    const sides = lineups();
    const local = localGame({
      lineups: { home: sides.home, away: sides.away },
    });
    await store.putGame(local);
    prepareMock.mockResolvedValue(localGame());
    eventsMock.mockResolvedValue([]);

    const result = await recoverGame(gameId, store);

    expect(result.imported).toBe(0);
    expect(result.game.lineups.home).toEqual(sides.home);
    expect(result.game.lineups.away).toEqual(sides.away);
  });

  it("maps an unexpected API failure to a Spanish message", async () => {
    const store = new MemoryGameStore();
    prepareMock.mockRejectedValue(new Error("fetch failed"));

    await expect(recoverGame(gameId, store)).rejects.toMatchObject({
      name: "ApiError",
      message: "No pudimos recuperar el juego del servidor.",
    });
  });

  it("keeps the Spanish message of an ApiError", async () => {
    const store = new MemoryGameStore();
    const error = new ApiError(500, "El servidor tuvo un problema. Inténtalo de nuevo.");
    prepareMock.mockRejectedValue(error);

    await expect(recoverGame(gameId, store)).rejects.toBe(error);
  });
});

describe("canStartGame", () => {
  const sides = lineups();
  const startable = localGame({
    lineups: { home: sides.home, away: sides.away },
  });

  it("accepts two full active rosters and their lineups", () => {
    expect(canStartGame(startable, startable.lineups, DEFAULT_RULES)).toEqual({
      ok: true,
      errors: [],
    });
  });

  it("rejects a missing roster with the team name", () => {
    const check = canStartGame(
      localGame({ rosters: undefined }),
      startable.lineups,
      DEFAULT_RULES,
    );

    expect(check.ok).toBe(false);
    expect(check.errors).toContain(
      "Falta la plantilla de Marlins; prepara el juego desde el calendario.",
    );
    expect(check.errors).toContain(
      "Falta la plantilla de Tiburones; prepara el juego desde el calendario.",
    );
  });

  it("rejects a roster with fewer than nine active players", () => {
    const game = localGame({
      rosters: { home: homeRoster.slice(0, 8), away: awayRoster },
    });

    expect(rosterStartErrors(game)).toEqual([
      "Falta la plantilla de Tiburones; prepara el juego desde el calendario.",
    ]);
  });

  it("rejects placeholder names and an empty lineup", () => {
    const placeholder = {
      ...startable.lineups,
      home: {
        ...sides.home!,
        players: sides.home!.players.map((player, index) =>
          index === 3 ? { ...player, name: "Jugador 4" } : player,
        ),
      },
    };

    expect(lineupStartErrors(placeholder.home, "Tiburones", DEFAULT_RULES)).toContain(
      "La alineación de Tiburones todavía tiene nombres de relleno («Jugador N»).",
    );
    expect(
      lineupStartErrors(null, "Marlins", DEFAULT_RULES),
    ).toEqual(["Falta la alineación de Marlins."]);
  });

  it("keeps validateLineup errors for an incomplete lineup", () => {
    const short = {
      ...sides.away!,
      players: sides.away!.players.slice(0, 8),
    };

    expect(
      lineupStartErrors(short, "Marlins", DEFAULT_RULES),
    ).toContain("La alineación debe tener exactamente 9 jugadores.");
  });
});
