import { describe, expect, it } from "vitest";
import { scoreboardLine } from "@/lib/format";
import type { GameState } from "@/lib/types";

function state(status: GameState["status"], overrides: Partial<GameState> = {}): GameState {
  return {
    status,
    inning: 2,
    half: "top",
    outs: 1,
    count: { balls: 0, strikes: 0 },
    bases: { first: null, second: null, third: null },
    score: { home: 1, away: 2 },
    battingTeam: "away",
    lastSeq: 0,
    ...overrides,
  };
}

describe("scoreboardLine", () => {
  it("keeps inning and outs for a live game", () => {
    expect(scoreboardLine(state("live"))).toBe("2.ª alta · 1 out");
  });

  it("names the terminal state instead of showing live telemetry", () => {
    expect(scoreboardLine(state("final"))).toBe("Final");
    expect(scoreboardLine(state("suspended"))).toBe("Suspendido");
  });

  it("marks a scheduled game as programmed", () => {
    expect(scoreboardLine(state("scheduled"))).toBe("Programado");
  });
});
