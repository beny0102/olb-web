import { describe, expect, it } from "vitest";
import type { Event } from "@olb/contract/types";
import { initialState, type GameState } from "../../src/lib/scorer/fold";
import { validateLineup } from "../../src/lib/scorer/lineup";
import {
  courtesyRunnerOptions,
  DEFAULT_RULES,
  mercyReached,
  normalizeRules,
  pitchCount,
  placedRunnerEligible,
  regulationComplete,
  validateRules,
  type RulesProfile,
} from "../../src/lib/scorer/rules";
import type { Lineup, Player } from "../../src/lib/scorer/types";
import { uuid7 } from "../../src/lib/scorer/uuid7";

const gameId = uuid7();
const pitcherA = uuid7();
const pitcherB = uuid7();
const batter = uuid7();

function state(overrides: Partial<GameState> = {}): GameState {
  return {
    ...initialState,
    status: "live",
    ...overrides,
    count: overrides.count ?? { balls: 0, strikes: 0 },
    bases: overrides.bases ?? { first: null, second: null, third: null },
    score: overrides.score ?? { home: 0, away: 0 },
  };
}

function rules(overrides: Partial<RulesProfile> = {}): RulesProfile {
  return {
    ...DEFAULT_RULES,
    ...overrides,
    mercy: { ...DEFAULT_RULES.mercy, ...(overrides.mercy ?? {}) },
    extraInnings: { ...DEFAULT_RULES.extraInnings, ...(overrides.extraInnings ?? {}) },
  };
}

function pitchEvent(seq: number, pitcher: string): Event {
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
      batter,
      pitcher,
      count: { balls: 0, strikes: 0 },
      call: "B",
    },
  } as Event;
}

function inningEndEvent(seq: number): Event {
  return {
    contract: "olb.event/1",
    id: uuid7(),
    gameId,
    seq,
    occurredAt: "2026-04-11T23:41:07.412Z",
    recordedAt: "2026-04-11T23:41:07.412Z",
    type: "inning.end",
    source: "human",
    actor: { kind: "user", id: "test" },
    payload: { inning: 9, half: "bottom", runsScored: 0, outs: 3 },
  } as Event;
}

function player(id: string, slot: number, position: Player["position"]): Player {
  return { id, name: `Jugador ${slot}`, position, battingSlot: slot };
}

function lineup(): Lineup {
  const players = ["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((position, index) =>
    player(uuid7(), index + 1, position as Player["position"]),
  );
  return { team: "away", players, pitcherId: players[0]!.id };
}

describe("DEFAULT_RULES and normalizeRules", () => {
  it("uses nine innings, no mercy and the DH", () => {
    expect(DEFAULT_RULES).toEqual({
      innings: 9,
      mercy: { enabled: false, runs: 10, afterInning: 5 },
      inningLimit: null,
      dh: true,
      courtesyRunner: false,
      pitchLimit: null,
      extraInnings: { enabled: true, placedRunner: false },
    });
  });

  it("fills a missing profile with the defaults", () => {
    expect(normalizeRules(undefined)).toEqual(DEFAULT_RULES);
    expect(normalizeRules(null)).toEqual(DEFAULT_RULES);
  });

  it("merges a partial profile without losing the defaults", () => {
    expect(
      normalizeRules({
        innings: 3,
        mercy: { enabled: true, runs: 2, afterInning: 2 },
        extraInnings: { placedRunner: true },
      }),
    ).toEqual({
      ...DEFAULT_RULES,
      innings: 3,
      mercy: { enabled: true, runs: 2, afterInning: 2 },
      extraInnings: { enabled: true, placedRunner: true },
    });
  });
});

describe("validateRules", () => {
  it("accepts the defaults and null limits", () => {
    expect(validateRules(DEFAULT_RULES)).toEqual([]);
    expect(validateRules(rules({ inningLimit: 7, pitchLimit: 80 }))).toEqual([]);
  });

  it("reports every out-of-range field in Spanish", () => {
    const errors = validateRules({
      innings: 13,
      mercy: { enabled: true, runs: 31, afterInning: 0 },
      inningLimit: 0,
      dh: true,
      courtesyRunner: true,
      pitchLimit: 301,
      extraInnings: { enabled: true, placedRunner: true },
    });

    expect(errors).toContain("Las entradas deben ser un número entero entre 1 y 12.");
    expect(errors).toContain(
      "La diferencia de misericordia debe ser un número entero entre 1 y 30.",
    );
    expect(errors).toContain("La misericordia debe empezar en una entrada entre 1 y 12.");
    expect(errors).toContain(
      "El límite de entradas debe ser nulo o un entero entre 1 y 12.",
    );
    expect(errors).toContain(
      "El límite de lanzamientos debe ser nulo o un entero entre 1 y 300.",
    );
  });
});

describe("pitchCount", () => {
  it("counts only applied pitches by the given pitcher", () => {
    const events = [pitchEvent(0, pitcherA), pitchEvent(1, pitcherB), pitchEvent(2, pitcherA)];

    expect(pitchCount(events, pitcherA)).toBe(2);
    expect(pitchCount(events, pitcherB)).toBe(1);
    expect(pitchCount(events, uuid7())).toBe(0);
    expect(pitchCount(events, "")).toBe(0);
  });

  it("stops counting a voided pitch", () => {
    const first = pitchEvent(0, pitcherA);
    const voided = {
      ...first,
      id: uuid7(),
      seq: 1,
      type: "amendment",
      revisionOf: first.id,
      payload: { targetSeq: 0, reason: "data_entry", replacement: null },
    } as Event;

    expect(pitchCount([first, voided], pitcherA)).toBe(0);
  });
});

describe("mercyReached", () => {
  const mercy = rules({
    mercy: { enabled: true, runs: 10, afterInning: 5 },
  });

  it("is reached after the configured inning with enough difference", () => {
    expect(mercyReached(state({ inning: 6, half: "top", score: { home: 0, away: 10 } }), mercy)).toBe(
      true,
    );
    expect(mercyReached(state({ inning: 5, half: "bottom", score: { home: 10, away: 0 } }), mercy)).toBe(
      true,
    );
  });

  it("does not trigger before the inning or below the difference", () => {
    expect(mercyReached(state({ inning: 5, half: "top", score: { home: 0, away: 10 } }), mercy)).toBe(
      false,
    );
    expect(mercyReached(state({ inning: 6, half: "top", score: { home: 0, away: 9 } }), mercy)).toBe(
      false,
    );
  });

  it("stays off when the rule is disabled", () => {
    expect(
      mercyReached(
        state({ inning: 6, half: "top", score: { home: 0, away: 20 } }),
        rules({ mercy: { enabled: false, runs: 10, afterInning: 5 } }),
      ),
    ).toBe(false);
  });
});

describe("regulationComplete", () => {
  it("ends after the ninth inning when the score is not tied", () => {
    expect(
      regulationComplete(state({ inning: 10, half: "top", score: { home: 1, away: 2 } }), rules()),
    ).toBe(true);
  });

  it("ends a tie after regulation when extra innings are disabled", () => {
    expect(
      regulationComplete(
        state({ inning: 10, half: "top", score: { home: 2, away: 2 } }),
        rules({ extraInnings: { enabled: false, placedRunner: false } }),
      ),
    ).toBe(true);
  });

  it("continues a tie after regulation when extra innings are enabled", () => {
    expect(
      regulationComplete(state({ inning: 10, half: "top", score: { home: 2, away: 2 } }), rules()),
    ).toBe(false);
  });

  it("ends after the top of the last inning when the home team leads", () => {
    expect(
      regulationComplete(state({ inning: 9, half: "bottom", score: { home: 3, away: 2 } }), rules()),
    ).toBe(true);
  });

  it("ends at the inning limit even when tied", () => {
    expect(
      regulationComplete(
        state({ inning: 8, half: "top", score: { home: 2, away: 2 } }),
        rules({ inningLimit: 7 }),
      ),
    ).toBe(true);
    expect(
      regulationComplete(
        state({ inning: 7, half: "bottom", score: { home: 2, away: 2 } }),
        rules({ inningLimit: 7 }),
      ),
    ).toBe(false);
  });
});

describe("placedRunnerEligible", () => {
  const placed = rules({ extraInnings: { enabled: true, placedRunner: true } });

  it("is eligible at the start of a tied extra inning", () => {
    expect(
      placedRunnerEligible(
        state({ inning: 10, half: "top", score: { home: 2, away: 2 } }),
        placed,
        [inningEndEvent(0)],
      ),
    ).toBe(true);
  });

  it("is not eligible once the half has a pitch", () => {
    expect(
      placedRunnerEligible(
        state({ inning: 10, half: "top", score: { home: 2, away: 2 } }),
        placed,
        [inningEndEvent(0), pitchEvent(1, pitcherA)],
      ),
    ).toBe(false);
  });

  it("requires an empty second base and a tie", () => {
    expect(
      placedRunnerEligible(
        state({
          inning: 10,
          half: "top",
          score: { home: 2, away: 2 },
          bases: { first: null, second: uuid7(), third: null },
        }),
        placed,
      ),
    ).toBe(false);
    expect(
      placedRunnerEligible(
        state({ inning: 10, half: "top", score: { home: 3, away: 2 } }),
        placed,
      ),
    ).toBe(false);
  });

  it("requires the rule and an extra inning", () => {
    expect(
      placedRunnerEligible(
        state({ inning: 10, half: "top", score: { home: 2, away: 2 } }),
        rules(),
      ),
    ).toBe(false);
    expect(
      placedRunnerEligible(
        state({ inning: 9, half: "top", score: { home: 2, away: 2 } }),
        placed,
      ),
    ).toBe(false);
  });
});

describe("courtesyRunnerOptions", () => {
  it("lists occupied bases and excludes runners on base and the batter", () => {
    const team = lineup();
    const onFirst = team.players[0]!;
    const onThird = team.players[1]!;
    const currentBatter = team.players[2]!;

    const options = courtesyRunnerOptions(
      state({
        bases: { first: onFirst.id, second: null, third: onThird.id },
      }),
      team,
      currentBatter.id,
    );

    expect(options.map((option) => option.from)).toEqual(["1", "3"]);
    const eligible = options[0]!.replacements.map((entry) => entry.id);
    expect(eligible).not.toContain(onFirst.id);
    expect(eligible).not.toContain(onThird.id);
    expect(eligible).not.toContain(currentBatter.id);
    expect(eligible).toHaveLength(6);
  });

  it("returns no bases when the bases are empty", () => {
    expect(courtesyRunnerOptions(state(), lineup())).toEqual([]);
  });
});

describe("validateLineup with rules", () => {
  it("rejects a DH when the profile disables it", () => {
    const team = lineup();
    const withDh: Lineup = {
      ...team,
      players: [
        ...team.players.slice(0, 8),
        player(uuid7(), 9, "DH"),
      ],
      pitcherId: uuid7(),
    };

    expect(validateLineup(withDh, { ...DEFAULT_RULES, dh: false })).toContain(
      "El bateador designado no está permitido con las reglas actuales.",
    );
    expect(validateLineup(withDh, DEFAULT_RULES)).toEqual([]);
  });
});
