import { describe, expect, it } from "vitest";
import { parseEvent } from "@olb/contract";
import { DEFAULT_RULES } from "../../src/lib/scorer/rules";
import {
  blankLineup,
  buildLineupEvents,
  buildStartEvents,
} from "../../src/lib/scorer/setup";
import type { Lineup, LocalGame, Player, TeamSide } from "../../src/lib/scorer/types";
import { uuid7 } from "../../src/lib/scorer/uuid7";

function player(slot: number, position: Player["position"]): Player {
  return {
    id: uuid7(),
    name: `Jugador ${slot}`,
    position,
    battingSlot: slot,
  };
}

function lineup(team: TeamSide): Lineup {
  const positions: Player["position"][] = ["1", "2", "3", "4", "5", "6", "7", "8", "9"];
  const players = positions.map((position, index) => player(index + 1, position));
  return { team, players, pitcherId: players[0]!.id };
}

const game: LocalGame = {
  id: uuid7(),
  homeTeam: "Tiburones",
  awayTeam: "Marlins",
  scheduledStart: "2027-04-10T23:00:00.000Z",
  venue: "Estadio Centenario",
  createdAt: "2026-11-04T15:11:58.892Z",
  lineups: { home: null, away: null },
  rules: DEFAULT_RULES,
};

const lineups = { home: lineup("home"), away: lineup("away") };

describe("buildStartEvents", () => {
  it("returns game.start, the away lineup and the home lineup in order", () => {
    const events = buildStartEvents(game, lineups, 0);

    expect(events.map((event) => event.type)).toEqual([
      "game.start",
      "lineup.set",
      "lineup.set",
    ]);
    expect(events.map((event) => event.seq)).toEqual([0, 1, 2]);
    expect(events.every((event) => event.gameId === game.id)).toBe(true);
  });

  it("validates every event with the contract", () => {
    const events = buildStartEvents(game, lineups, 7);

    for (const event of events) {
      expect(() => parseEvent(event)).not.toThrow();
    }
  });

  it("puts the visitor lineup before the home lineup", () => {
    const [, away, home] = buildStartEvents(game, lineups, 0);

    expect(away?.type === "lineup.set" && away.payload.team).toBe("away");
    expect(home?.type === "lineup.set" && home.payload.team).toBe("home");
    expect(away?.type === "lineup.set" && away.payload.battingOrder).toHaveLength(9);
  });

  it("carries the venue in the start payload", () => {
    const [start] = buildStartEvents(game, lineups, 0);
    expect(start?.type === "game.start" && start.payload.venue).toBe(
      "Estadio Centenario",
    );
  });

  it("rejects an incomplete lineup before it reaches the log", () => {
    const incomplete: Lineup = {
      ...lineups.away,
      players: lineups.away.players.slice(0, 8),
    };

    expect(() =>
      buildStartEvents(game, { ...lineups, away: incomplete }, 0),
    ).toThrow();
  });
});

describe("buildLineupEvents", () => {
  it("returns the two lineups starting at the given sequence", () => {
    const events = buildLineupEvents(game, lineups, 1);

    expect(events.map((event) => event.type)).toEqual(["lineup.set", "lineup.set"]);
    expect(events.map((event) => event.seq)).toEqual([1, 2]);
    for (const event of events) {
      expect(() => parseEvent(event)).not.toThrow();
    }
  });
});

describe("blankLineup", () => {
  it("creates nine empty slots in default positions", () => {
    const blank = blankLineup("home");

    expect(blank.team).toBe("home");
    expect(blank.players).toHaveLength(9);
    expect(blank.players.map((entry) => entry.battingSlot)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9,
    ]);
    expect(blank.players.map((entry) => entry.position)).toEqual([
      "1", "2", "3", "4", "5", "6", "7", "8", "9",
    ]);
    expect(blank.players.every((entry) => entry.name === "")).toBe(true);
    expect(blank.pitcherId).toBe("");
  });
});
