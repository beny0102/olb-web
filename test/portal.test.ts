import { describe, expect, it } from "vitest";
import { formatLinescore, formatPct, formatScheduledStart } from "@/lib/format";
import { orderSlate, visibleStandings, type PortalGame } from "@/lib/league";
import type { GameRecord, GameState, Standings, StandingsTeam } from "@/lib/types";

function game(
  id: string,
  createdAt: string,
  status: GameState["status"],
  scheduledStart: string | null = null,
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
    homeTeam: "Marlins",
    awayTeam: "Tiburones",
    scheduledStart,
    venue: null,
    createdAt,
    lastSeq: 0,
  };
  return { game: record, state, events: [] };
}

function team(teamName: string, w: number, l: number): StandingsTeam {
  return { team: teamName, w, l, runsFor: w * 4, runsAgainst: l * 3, pct: w / (w + l) };
}

describe("slate ordering", () => {
  it("leads with live, then scheduled soonest, then the most recent finals", () => {
    const slate = orderSlate([
      game("final-old", "2026-11-01T10:00:00Z", "final"),
      game("sched-late", "2026-10-30T12:00:00Z", "scheduled", "2026-11-08T19:00:00Z"),
      game("live", "2026-10-29T12:00:00Z", "live"),
      game("final-new", "2026-11-02T10:00:00Z", "final"),
      game("sched-soon", "2026-10-28T12:00:00Z", "scheduled", "2026-11-06T19:00:00Z"),
    ]);

    expect(slate.map((entry) => entry.game.id)).toEqual([
      "live",
      "sched-soon",
      "sched-late",
      "final-new",
      "final-old",
    ]);
  });

  it("sorts a scheduled game without a start time after the known ones", () => {
    const slate = orderSlate([
      game("sched-unknown", "2026-10-31T12:00:00Z", "scheduled"),
      game("sched-known", "2026-10-30T12:00:00Z", "scheduled", "2026-11-06T19:00:00Z"),
    ]);

    expect(slate.map((entry) => entry.game.id)).toEqual(["sched-known", "sched-unknown"]);
  });
});

describe("scheduled start formatting", () => {
  it("accepts both ISO shapes the API returns", () => {
    const memory = formatScheduledStart("2026-11-06T19:00:00Z");
    const postgres = formatScheduledStart("2026-11-06T19:00:00.000Z");

    expect(memory).not.toBeNull();
    expect(memory).toBe(postgres);
  });

  it("treats an absent or invalid timestamp as missing", () => {
    expect(formatScheduledStart(null)).toBeNull();
    expect(formatScheduledStart("not-a-date")).toBeNull();
  });
});

describe("box score linescore", () => {
  it("pads a short line to nine innings and prints nulls as a dash", () => {
    expect(formatLinescore([1, null, 3])).toEqual([
      "1",
      "–",
      "3",
      "–",
      "–",
      "–",
      "–",
      "–",
      "–",
    ]);
  });

  it("keeps extra innings instead of truncating them", () => {
    const line = formatLinescore(Array.from({ length: 10 }, () => 0));
    expect(line).toHaveLength(10);
    expect(line.every((value) => value === "0")).toBe(true);
  });
});

describe("standings display", () => {
  it("formats the percentage in baseball convention", () => {
    expect(formatPct(2 / 3)).toBe(".667");
    expect(formatPct(0.5)).toBe(".500");
    expect(formatPct(0)).toBe(".000");
    expect(formatPct(1)).toBe("1.000");
  });

  it("omits the band below two teams", () => {
    expect(visibleStandings(null)).toEqual([]);
    expect(visibleStandings({ games: 0, teams: [] })).toEqual([]);
    expect(visibleStandings({ games: 1, teams: [team("Marlins", 1, 0)] })).toEqual([]);
  });

  it("returns the rows once two clubs are ranked", () => {
    const standings: Standings = {
      games: 1,
      teams: [team("Marlins", 1, 0), team("Tiburones", 0, 1)],
    };

    const rows = visibleStandings(standings);
    expect(rows.map((row) => row.team)).toEqual(["Marlins", "Tiburones"]);
    expect(rows.map((row) => formatPct(row.pct))).toEqual(["1.000", ".000"]);
  });
});
