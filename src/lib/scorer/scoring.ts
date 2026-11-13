import type { Event } from "@olb/contract/types";
import type { BallInPlayInput, FielderCredit, RunnerAdvance } from "./events";
import {
  appliedEvents,
  applyEvent,
  foldEvents,
  initialState,
  type GameState,
} from "./fold";
import type { Player, Lineup } from "./types";

export type OutcomeCode = "out" | "1B" | "2B" | "3B" | "HR" | "E" | "FC" | "DP" | "SAC";

const STRUCTURAL_TYPES = new Set([
  "game.start",
  "lineup.set",
  "game.end",
  "amendment",
]);

/**
 * Plate appearances completed by the log. A walk, a strikeout and every ball
 * in play close one; a foul or a pitch in the middle of an at-bat does not.
 */
export function countPlateAppearances(events: readonly Event[]): number {
  let state = initialState;
  let count = 0;

  for (const event of appliedEvents(events)) {
    if (event.type === "ball_in_play" || event.type === "interference") {
      count += 1;
    } else if (event.type === "pitch") {
      const { call } = event.payload;
      const walked =
        (call === "B" || call === "P" || call === "I") && state.count.balls === 3;
      const struckOut =
        (call === "C" || call === "S" || call === "Q" || call === "T") &&
        state.count.strikes === 2;
      if (walked || struckOut || call === "H") count += 1;
    }
    state = applyEvent(state, event);
  }

  return count;
}

/**
 * Outs the event adds to the half inning. A third out is still reported here;
 * the fold caps its own counter at two because the half is not over until an
 * `inning.end` says so.
 */
export function outsAdded(state: GameState, event: Event): number {
  switch (event.type) {
    case "pitch": {
      const { call } = event.payload;
      const struckOut =
        (call === "C" || call === "S" || call === "Q" || call === "T") &&
        state.count.strikes === 2;
      return struckOut ? 1 : 0;
    }
    case "ball_in_play":
      return (event.payload.fielders ?? []).filter((fielder) => fielder.role === "putout")
        .length;
    case "runner":
      return event.payload.out ? 1 : 0;
    default:
      return 0;
  }
}

/**
 * Runs scored in the current half. The most recent `inning.end` is the
 * checkpoint, so a reload folds the same prefix and gets the same number.
 */
export function runsThisHalf(events: readonly Event[], state: GameState): number {
  const applied = appliedEvents(events);
  let checkpoint = -1;

  for (let index = 0; index < applied.length; index += 1) {
    if (applied[index]?.type === "inning.end") checkpoint = index;
  }

  const before = applied
    .slice(0, checkpoint === -1 ? 0 : checkpoint)
    .reduce(applyEvent, initialState);

  return state.score[state.battingTeam] - before.score[state.battingTeam];
}

function occupiedRunners(state: GameState): Array<{ player: string; from: "1" | "2" | "3" }> {
  const runners: Array<{ player: string; from: "1" | "2" | "3" }> = [];
  if (state.bases.first) runners.push({ player: state.bases.first, from: "1" });
  if (state.bases.second) runners.push({ player: state.bases.second, from: "2" });
  if (state.bases.third) runners.push({ player: state.bases.third, from: "3" });
  return runners;
}

function destination(base: "1" | "2" | "3", gained: number): "1" | "2" | "3" | "H" {
  const value = Number(base) + gained;
  if (value >= 4) return "H";
  return String(value) as "1" | "2" | "3";
}

/**
 * Advances every runner and the batter by the same number of bases. Runners
 * that reach home are counted as runs and as RBI for a hit.
 */
function hitAdvances(
  state: GameState,
  batterId: string,
  gained: number,
): { runnersAdvanced: RunnerAdvance[]; runs: number } {
  const runnersAdvanced: RunnerAdvance[] = [
    { player: batterId, from: "B", to: destination("1", gained - 1), on: "hit" },
  ];

  for (const runner of occupiedRunners(state)) {
    runnersAdvanced.push({
      player: runner.player,
      from: runner.from,
      to: destination(runner.from, gained),
      on: "hit",
    });
  }

  const runs = runnersAdvanced.filter((advance) => advance.to === "H").length;
  return { runnersAdvanced, runs };
}

function firstAt(
  fielders: readonly Player[],
  position: Player["position"],
): Player | undefined {
  return fielders.find((fielder) => fielder.position === position);
}

function fieldersOf(fielders: readonly Player[] | Lineup): readonly Player[] {
  return "players" in fielders ? fielders.players : fielders;
}

function outFielders(fielders: readonly Player[]): FielderCredit[] {
  const shortstop = firstAt(fielders, "6") ?? fielders[0];
  const firstBase = firstAt(fielders, "3");
  const credits: FielderCredit[] = [];

  if (shortstop) {
    credits.push({ player: shortstop.id, role: "putout" });
  }
  if (firstBase && firstBase.id !== shortstop?.id) {
    credits.push({ player: firstBase.id, role: "assist" });
  }

  return credits;
}

/**
 * The payload for one tap on the outcome pad.
 *
 * `out` is a 6-3 grounder; hits use the centre-field code and move everybody
 * the same number of bases; an error or a fielder's choice keeps the batter
 * at first and moves each runner one base without an RBI.
 */
export function outcome(
  state: GameState,
  code: OutcomeCode,
  batter: Player | string,
  fielders: readonly Player[] | Lineup = [],
): BallInPlayInput {
  const batterId = typeof batter === "string" ? batter : batter.id;

  if (code === "out") {
    return {
      batter: batterId,
      code: "6-3/G",
      runsBattedIn: 0,
      fielders: outFielders(fieldersOf(fielders)),
    };
  }

  if (code === "DP") {
    const defence = fieldersOf(fielders);
    const shortstop = firstAt(defence, "6") ?? defence[0];
    const secondBase = firstAt(defence, "4");
    const firstBase = firstAt(defence, "3");
    const credits: FielderCredit[] = [];

    if (shortstop) credits.push({ player: shortstop.id, role: "putout" });
    if (firstBase && firstBase.id !== shortstop?.id) {
      credits.push({ player: firstBase.id, role: "putout" });
    }
    if (secondBase && secondBase.id !== shortstop?.id && secondBase.id !== firstBase?.id) {
      credits.push({ player: secondBase.id, role: "assist" });
    }

    // The contract has no per-runner out flag. The two putouts carry the outs,
    // and `to: "B"` clears the lead runner's base without placing him again.
    const lead = state.bases.first;
    return {
      batter: batterId,
      code: "6(1)3/GDP",
      runsBattedIn: 0,
      fielders: credits,
      ...(lead === null
        ? {}
        : {
            runnersAdvanced: [
              { player: lead, from: "1", to: "B", on: "other" } as RunnerAdvance,
            ],
          }),
    };
  }

  if (code === "SAC") {
    const defence = fieldersOf(fielders);
    const firstBase = firstAt(defence, "3") ?? defence[0];
    const pitcher = firstAt(defence, "1");
    const credits: FielderCredit[] = [];
    if (firstBase) credits.push({ player: firstBase.id, role: "putout" });
    if (pitcher && pitcher.id !== firstBase?.id) {
      credits.push({ player: pitcher.id, role: "assist" });
    }

    const runnersAdvanced: RunnerAdvance[] = occupiedRunners(state).map((runner) => ({
      player: runner.player,
      from: runner.from,
      to: destination(runner.from, 1),
      on: "sacrifice",
    }));

    return {
      batter: batterId,
      code: "1-3/SH",
      runsBattedIn: 0,
      fielders: credits,
      ...(runnersAdvanced.length === 0 ? {} : { runnersAdvanced }),
    };
  }

  if (code === "E" || code === "FC") {
    const on: RunnerAdvance["on"] = code === "E" ? "error" : "other";
    const runnersAdvanced: RunnerAdvance[] = [
      { player: batterId, from: "B", to: "1", on },
      ...occupiedRunners(state).map((runner) => ({
        player: runner.player,
        from: runner.from,
        to: destination(runner.from, 1),
        on,
      })),
    ];

    return {
      batter: batterId,
      code: code === "E" ? "E6" : "FC6",
      runsBattedIn: 0,
      runnersAdvanced,
    };
  }

  if (code === "HR") {
    const runnersAdvanced: RunnerAdvance[] = [
      { player: batterId, from: "B", to: "H", on: "hit" },
      ...occupiedRunners(state).map((runner) => ({
        player: runner.player,
        from: runner.from,
        to: "H" as const,
        on: "hit" as const,
      })),
    ];

    return {
      batter: batterId,
      code: "HR",
      runsBattedIn: runnersAdvanced.length,
      runnersAdvanced,
    };
  }

  const gained = code === "1B" ? 1 : code === "2B" ? 2 : 3;
  const prefix = code === "1B" ? "S8" : code === "2B" ? "D8" : "T8";
  const { runnersAdvanced, runs } = hitAdvances(state, batterId, gained);

  return {
    batter: batterId,
    code: prefix,
    runsBattedIn: runs,
    runnersAdvanced,
  };
}

/** The next pitch number for the log: every recorded pitch, plus this one. */
export function nextPitchNo(events: readonly Event[]): number {
  return appliedEvents(events).filter((event) => event.type === "pitch").length + 1;
}

/**
 * Whether the log has something a scorekeeper can take back. Structural
 * events and amendments are skipped so pressing Undo twice walks back two
 * real plays instead of undoing the previous undo.
 */
export function canUndo(events: readonly Event[]): boolean {
  const applied = appliedEvents(events);
  for (let index = applied.length - 1; index >= 0; index -= 1) {
    const event = applied[index];
    if (!event || STRUCTURAL_TYPES.has(event.type)) continue;
    return true;
  }
  return false;
}

/** The last event Undo may void, or null when there is none. */
export function lastUndoable(events: readonly Event[]): Event | null {
  const applied = appliedEvents(events);
  for (let index = applied.length - 1; index >= 0; index -= 1) {
    const event = applied[index];
    if (!event || STRUCTURAL_TYPES.has(event.type)) continue;
    return event;
  }
  return null;
}

function previousUndoable(applied: readonly Event[], before: number): number {
  for (let index = before - 1; index >= 0; index -= 1) {
    const event = applied[index];
    if (!event || STRUCTURAL_TYPES.has(event.type)) continue;
    return index;
  }
  return -1;
}

/**
 * The events one Undo tap takes back. Normally that is the last play. When the
 * last event is the automatic `inning.end` that follows a third out, the tap
 * also voids the out, so the half returns with two outs and the same batter
 * instead of leaving a dead third out in the log.
 */
export function undoTargets(events: readonly Event[]): Event[] {
  const applied = appliedEvents(events);
  const index = previousUndoable(applied, applied.length);
  const last = index === -1 ? null : applied[index];
  if (!last) return [];

  if (last.type !== "inning.end") return [last];

  const previousIndex = previousUndoable(applied, index);
  const previous = previousIndex === -1 ? null : applied[previousIndex];
  if (!previous) return [last];

  const before = applied.slice(0, previousIndex).reduce(applyEvent, initialState);
  return before.outs + outsAdded(before, previous) >= 3 ? [last, previous] : [last];
}

/** Convenience for tests and callers that hold a raw log. */
export function stateAfter(events: readonly Event[]): GameState {
  return foldEvents(events);
}
