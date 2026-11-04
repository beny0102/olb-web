import { describe, expect, it } from "vitest";
import { demoEvents } from "@/lib/demo";
import {
  deriveLinescore,
  gameStatus,
  orderGames,
  selectFeatured,
  selectSlate,
  teamAbbr,
  type PortalGame,
} from "@/lib/league";
import type { Event, GameRecord, GameState } from "@/lib/types";

function game(
  id: string,
  createdAt: string,
  status: GameState["status"],
  homeTeam = "Marlins",
  awayTeam = "Tiburones",
): PortalGame {
  const state: GameState = {
    status,
    inning: 1,
    half: "top",
    outs: 0,
    count: { balls: 0, strikes: 0 },
    bases: { first: null, second: null, third: null },
    score: { home: 0, away: 0 },
    battingTeam: "away",
    lastSeq: 0,
  };
  const record: GameRecord = {
    id,
    homeTeam,
    awayTeam,
    scheduledStart: null,
    venue: null,
    createdAt,
    lastSeq: 0,
  };
  return { game: record, state, events: [] };
}

describe("teamAbbr", () => {
  it("uses the first three letters of a single-word club", () => {
    expect(teamAbbr("Tiburones")).toBe("TIB");
    expect(teamAbbr("Cañeros")).toBe("CAN");
    expect(teamAbbr("Marlins")).toBe("MAR");
  });

  it("uses initials when the club has three or more words", () => {
    expect(teamAbbr("Leones del Norte")).toBe("LDN");
  });

  it("falls back instead of returning an empty mark", () => {
    expect(teamAbbr("   ")).toBe("OLB");
  });
});

describe("deriveLinescore", () => {
  it("reads runs from closed half-innings only", () => {
    const line = deriveLinescore(demoEvents);
    expect(line.hasData).toBe(true);
    expect(line.innings).toEqual([{ inning: 1, away: 1, home: null }]);
    expect(line.awayTotal).toBe(1);
    expect(line.homeTotal).toBe(0);
  });

  it("returns an empty line when there are no inning ends", () => {
    const line = deriveLinescore(demoEvents.filter((event) => event.type !== "inning.end"));
    expect(line.hasData).toBe(false);
    expect(line.innings).toEqual([]);
  });

  it("keeps both halves of the same inning in one row", () => {
    const events: Event[] = [
      ...demoEvents.filter((event) => event.type === "inning.end"),
      {
        ...demoEvents[0]!,
        seq: 99,
        type: "inning.end",
        payload: { inning: 1, half: "bottom", runsScored: 2, outs: 3 },
      } as Event,
    ];
    const line = deriveLinescore(events);
    expect(line.innings).toEqual([{ inning: 1, away: 1, home: 2 }]);
    expect(line.awayTotal).toBe(1);
    expect(line.homeTotal).toBe(2);
  });
});

describe("portal ordering", () => {
  it("puts live games first, then the most recent record", () => {
    const ordered = orderGames([
      game("final-old", "2026-01-01T00:00:00Z", "final"),
      game("live-new", "2026-01-03T00:00:00Z", "live"),
      game("final-new", "2026-01-04T00:00:00Z", "final"),
    ]);
    expect(ordered.map((entry) => entry.game.id)).toEqual(["live-new", "final-new", "final-old"]);
  });

  it("features a live game over any final", () => {
    const featured = selectFeatured([
      game("final", "2026-01-04T00:00:00Z", "final"),
      game("live", "2026-01-03T00:00:00Z", "live"),
    ]);
    expect(featured?.game.id).toBe("live");
  });

  it("falls back to recent games when nothing is scheduled", () => {
    const slate = selectSlate([
      game("final-old", "2026-01-01T00:00:00Z", "final"),
      game("final-new", "2026-01-04T00:00:00Z", "final"),
    ]);
    expect(slate.map((entry) => entry.game.id)).toEqual(["final-new", "final-old"]);
    expect(slate.every((entry) => gameStatus(entry) !== "scheduled")).toBe(true);
  });

  it("prefers scheduled games for the slate when they exist", () => {
    const slate = selectSlate([
      game("final", "2026-01-04T00:00:00Z", "final"),
      game("scheduled", "2026-01-02T00:00:00Z", "scheduled"),
    ]);
    expect(slate.map((entry) => entry.game.id)).toEqual(["scheduled"]);
  });
});
