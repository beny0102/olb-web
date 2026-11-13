import { describe, expect, it } from "vitest";
import {
  canComplete,
  canShorten,
  finishExplanation,
  finishMode,
  finishTitle,
} from "../../src/lib/scorer/finish";
import { initialState, type GameState } from "../../src/lib/scorer/fold";

function state(overrides: Partial<GameState> = {}): GameState {
  return { ...initialState, status: "live", ...overrides };
}

describe("canComplete", () => {
  it("allows completing after nine full innings with a winner", () => {
    expect(canComplete(state({ inning: 10, half: "top", score: { home: 5, away: 3 } }))).toBe(
      true,
    );
  });

  it("allows completing after 8.5 innings when the home team is ahead", () => {
    expect(
      canComplete(state({ inning: 9, half: "bottom", score: { home: 4, away: 2 } })),
    ).toBe(true);
  });

  it("allows a walk-off in the bottom of the ninth", () => {
    expect(
      canComplete(state({ inning: 9, half: "bottom", score: { home: 3, away: 2 } })),
    ).toBe(true);
  });

  it("blocks a tie after nine innings", () => {
    expect(
      canComplete(state({ inning: 10, half: "top", score: { home: 3, away: 3 } })),
    ).toBe(false);
  });

  it("blocks the bottom of the ninth while the home team is behind", () => {
    expect(
      canComplete(state({ inning: 9, half: "bottom", score: { home: 1, away: 2 } })),
    ).toBe(false);
  });

  it("blocks the top of the ninth, before the half is complete", () => {
    expect(
      canComplete(state({ inning: 9, half: "top", score: { home: 3, away: 2 } })),
    ).toBe(false);
  });
});

describe("canShorten", () => {
  it("allows shortening after six full innings", () => {
    expect(canShorten(state({ inning: 6, half: "top" }))).toBe(true);
  });

  it("allows shortening after 4.5 innings when the home team is ahead", () => {
    expect(
      canShorten(state({ inning: 5, half: "bottom", score: { home: 2, away: 1 } })),
    ).toBe(true);
  });

  it("blocks shortening in the top of the fifth", () => {
    expect(canShorten(state({ inning: 5, half: "top" }))).toBe(false);
  });

  it("blocks shortening in the bottom of the fifth with a tie", () => {
    expect(
      canShorten(state({ inning: 5, half: "bottom", score: { home: 2, away: 2 } })),
    ).toBe(false);
  });

  it("blocks shortening after 4.5 innings with the home team behind", () => {
    expect(
      canShorten(state({ inning: 5, half: "bottom", score: { home: 1, away: 2 } })),
    ).toBe(false);
  });

  it("blocks shortening in the first inning of a scoreless game", () => {
    const opening = state({ inning: 1, half: "top", score: { home: 0, away: 0 } });
    expect(canShorten(opening)).toBe(false);
    expect(canComplete(opening)).toBe(false);
    expect(finishMode(opening)).toBe("blocked");
  });
});

describe("finishMode", () => {
  it("prefers completed when both endings are possible", () => {
    expect(
      finishMode(state({ inning: 9, half: "bottom", score: { home: 5, away: 1 } })),
    ).toBe("completed");
  });

  it("returns shortened after six innings without a regulation ending", () => {
    expect(finishMode(state({ inning: 6, half: "top", score: { home: 1, away: 3 } }))).toBe(
      "shortened",
    );
  });

  it("returns blocked before five innings", () => {
    expect(finishMode(state({ inning: 5, half: "top", score: { home: 1, away: 0 } }))).toBe(
      "blocked",
    );
  });
});

describe("finish copy", () => {
  const current = state({ inning: 6, half: "top", score: { home: 3, away: 1 } });

  it("titles each ending", () => {
    expect(finishTitle("completed")).toBe("Finalizar juego");
    expect(finishTitle("shortened")).toBe("Finalizar como juego corto");
    expect(finishTitle("blocked")).toBe("Todavía no se puede finalizar");
  });

  it("states the inning, half and score in every explanation", () => {
    for (const mode of ["completed", "shortened", "blocked"] as const) {
      const text = finishExplanation(current, mode);
      expect(text).toContain("Entrada 6 · alta");
      expect(text).toContain("visitante 1 — local 3");
    }
  });

  it("explains the shortened ending and the minimum distance", () => {
    expect(finishExplanation(current, "shortened")).toContain("nueve entradas");
    expect(finishExplanation(current, "shortened")).toContain("juego corto");
    expect(finishExplanation(current, "blocked")).toContain("cinco entradas");
    expect(finishExplanation(current, "blocked")).toContain("4.5");
  });
});
