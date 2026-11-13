import type { Event } from "@olb/contract/types";
import { appliedEvents, type GameState } from "./fold";
import type { Lineup, Player } from "./types";

export interface MercyRule {
  enabled: boolean;
  runs: number;
  afterInning: number;
}

export interface ExtraInningsRule {
  enabled: boolean;
  placedRunner: boolean;
}

export interface RulesProfile {
  innings: number;
  mercy: MercyRule;
  inningLimit: number | null;
  dh: boolean;
  courtesyRunner: boolean;
  pitchLimit: number | null;
  extraInnings: ExtraInningsRule;
}

export const DEFAULT_RULES: RulesProfile = {
  innings: 9,
  mercy: { enabled: false, runs: 10, afterInning: 5 },
  inningLimit: null,
  dh: true,
  courtesyRunner: false,
  pitchLimit: null,
  extraInnings: { enabled: true, placedRunner: false },
};

function finiteNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function optionalNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function boolean(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

/**
 * Fills a stored profile with the defaults it is missing. Local games written
 * before C2 have no `rules` at all; a partial object is merged field by field
 * so a reload never loses a setting that was saved.
 */
export function normalizeRules(input: unknown): RulesProfile {
  if (input === null || typeof input !== "object") return structuredClone(DEFAULT_RULES);

  const raw = input as Partial<RulesProfile>;
  const mercy = (raw.mercy ?? {}) as Partial<MercyRule>;
  const extraInnings = (raw.extraInnings ?? {}) as Partial<ExtraInningsRule>;

  return {
    innings: finiteNumber(raw.innings, DEFAULT_RULES.innings),
    mercy: {
      enabled: boolean(mercy.enabled, DEFAULT_RULES.mercy.enabled),
      runs: finiteNumber(mercy.runs, DEFAULT_RULES.mercy.runs),
      afterInning: finiteNumber(mercy.afterInning, DEFAULT_RULES.mercy.afterInning),
    },
    inningLimit: optionalNumber(raw.inningLimit),
    dh: boolean(raw.dh, DEFAULT_RULES.dh),
    courtesyRunner: boolean(raw.courtesyRunner, DEFAULT_RULES.courtesyRunner),
    pitchLimit: optionalNumber(raw.pitchLimit),
    extraInnings: {
      enabled: boolean(extraInnings.enabled, DEFAULT_RULES.extraInnings.enabled),
      placedRunner: boolean(
        extraInnings.placedRunner,
        DEFAULT_RULES.extraInnings.placedRunner,
      ),
    },
  };
}

/** Human-readable rule validation in Spanish. Empty means the profile is valid. */
export function validateRules(rules: RulesProfile): string[] {
  const errors: string[] = [];

  if (!Number.isInteger(rules.innings) || rules.innings < 1 || rules.innings > 12) {
    errors.push("Las entradas deben ser un número entero entre 1 y 12.");
  }

  if (!Number.isInteger(rules.mercy.runs) || rules.mercy.runs < 1 || rules.mercy.runs > 30) {
    errors.push("La diferencia de misericordia debe ser un número entero entre 1 y 30.");
  }

  if (
    !Number.isInteger(rules.mercy.afterInning) ||
    rules.mercy.afterInning < 1 ||
    rules.mercy.afterInning > 12
  ) {
    errors.push("La misericordia debe empezar en una entrada entre 1 y 12.");
  }

  if (
    rules.inningLimit !== null &&
    (!Number.isInteger(rules.inningLimit) ||
      rules.inningLimit < 1 ||
      rules.inningLimit > 12)
  ) {
    errors.push("El límite de entradas debe ser nulo o un entero entre 1 y 12.");
  }

  if (
    rules.pitchLimit !== null &&
    (!Number.isInteger(rules.pitchLimit) ||
      rules.pitchLimit < 1 ||
      rules.pitchLimit > 300)
  ) {
    errors.push("El límite de lanzamientos debe ser nulo o un entero entre 1 y 300.");
  }

  return errors;
}

/**
 * Pitches charged to one pitcher. Only applied events count, so an undone pitch
 * stops counting as soon as the amendment supersedes it.
 */
export function pitchCount(events: readonly Event[], pitcherId: string): number {
  if (pitcherId === "") return 0;
  return appliedEvents(events).filter(
    (event) => event.type === "pitch" && event.payload.pitcher === pitcherId,
  ).length;
}

/** The inning whose bottom (or top) has just been completed, from the next state. */
function completedInning(state: GameState): number {
  return state.half === "top" ? state.inning - 1 : state.inning;
}

/**
 * The mercy rule after an inning end: the configured inning has been completed
 * and the score difference reaches the configured runs.
 */
export function mercyReached(state: GameState, rules: RulesProfile): boolean {
  if (!rules.mercy.enabled) return false;
  if (completedInning(state) < rules.mercy.afterInning) return false;
  return Math.abs(state.score.home - state.score.away) >= rules.mercy.runs;
}

/**
 * Whether the game has reached an ending under the rule profile. A tie after
 * regulation only ends when extra innings are disabled; with them enabled the
 * game continues. A walk-off after the top of the last inning also ends it.
 */
export function regulationComplete(state: GameState, rules: RulesProfile): boolean {
  const lastInning = rules.inningLimit ?? rules.innings;

  if (
    state.inning === lastInning &&
    state.half === "bottom" &&
    state.score.home > state.score.away
  ) {
    return true;
  }

  if (state.inning <= lastInning) return false;

  if (rules.inningLimit !== null) return true;
  if (state.score.home === state.score.away && rules.extraInnings.enabled) return false;
  return true;
}

/**
 * Whether the automatic runner for extra innings can be placed now: a tie
 * after regulation, the rule is on, second base is empty and the half has not
 * seen a pitch yet.
 */
export function placedRunnerEligible(
  state: GameState,
  rules: RulesProfile,
  events: readonly Event[] = [],
): boolean {
  if (!rules.extraInnings.enabled || !rules.extraInnings.placedRunner) return false;
  if (state.inning <= rules.innings) return false;
  if (state.score.home !== state.score.away) return false;
  if (state.bases.second !== null) return false;

  const applied = appliedEvents(events);
  let lastInningEnd = -1;
  for (let index = 0; index < applied.length; index += 1) {
    if (applied[index]?.type === "inning.end") lastInningEnd = index;
  }

  const sinceInningEnd = lastInningEnd === -1 ? applied : applied.slice(lastInningEnd + 1);
  return !sinceInningEnd.some(
    (event) => event.type === "pitch" || event.type === "ball_in_play",
  );
}

export interface CourtesyRunnerBase {
  from: "1" | "2" | "3";
  runnerId: string;
  replacements: Player[];
}

/**
 * The occupied bases and the players who may run for them. A courtesy runner
 * cannot be a player already on base nor the current batter.
 */
export function courtesyRunnerOptions(
  state: GameState,
  lineup: Lineup,
  batterId: string | null = null,
): CourtesyRunnerBase[] {
  const occupied: Array<{ from: "1" | "2" | "3"; runnerId: string }> = [];
  if (state.bases.first) occupied.push({ from: "1", runnerId: state.bases.first });
  if (state.bases.second) occupied.push({ from: "2", runnerId: state.bases.second });
  if (state.bases.third) occupied.push({ from: "3", runnerId: state.bases.third });

  const onBase = new Set(occupied.map((entry) => entry.runnerId));

  return occupied.map((entry) => ({
    ...entry,
    replacements: lineup.players.filter(
      (player) => !onBase.has(player.id) && player.id !== batterId,
    ),
  }));
}
