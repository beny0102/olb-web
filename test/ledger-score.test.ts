import { describe, expect, it } from "vitest";
import { ledgerScore, type PortalGame } from "@/lib/league";
import type { GameRecord, GameState } from "@/lib/types";

function game(status: GameState["status"]): PortalGame {
  const state: GameState = {
    status,
    inning: 2,
    half: "top",
    outs: 1,
    count: { balls: 0, strikes: 0 },
    bases: { first: null, second: null, third: null },
    score: { home: 1, away: 2 },
    battingTeam: "away",
    lastSeq: 0,
  };
  const record: GameRecord = {
    id: "game-ledger-score",
    homeTeam: "Marlins",
    awayTeam: "Tiburones",
    scheduledStart: null,
    venue: null,
    createdAt: "2026-11-03T20:00:00Z",
    lastSeq: 0,
  };
  return { game: record, state, events: [] };
}

describe("ledgerScore", () => {
  it("shows a dash before a scheduled game has a score", () => {
    expect(ledgerScore(game("scheduled"))).toBe("—");
  });

  it("shows the score label once the game is live or final", () => {
    expect(ledgerScore(game("live"))).toBe("TIB 2, MAR 1");
    expect(ledgerScore(game("final"))).toBe("TIB 2, MAR 1");
  });
});
