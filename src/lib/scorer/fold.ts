import type { Event } from "@olb/contract/types";

export type GameStatus = "scheduled" | "live" | "final" | "suspended" | "forfeit";
export type HalfInning = "top" | "bottom";
export type TeamSide = "home" | "away";

type Bases = GameState["bases"];
type BaseKey = keyof Bases;

/**
 * The projection the scorer keeps in memory while it folds the local log.
 * It matches `gameState` in the contract's common schema.
 */
export interface GameState {
  status: GameStatus;
  inning: number;
  half: HalfInning;
  outs: number;
  count: { balls: number; strikes: number };
  bases: { first: string | null; second: string | null; third: string | null };
  score: { home: number; away: number };
  battingTeam: TeamSide;
  lastSeq: number;
}

export const initialState: GameState = {
  status: "scheduled",
  inning: 1,
  half: "top",
  outs: 0,
  count: { balls: 0, strikes: 0 },
  bases: { first: null, second: null, third: null },
  score: { home: 0, away: 0 },
  battingTeam: "away",
  lastSeq: 0,
};

const cleanCount = { balls: 0, strikes: 0 };
const emptyBases = { first: null, second: null, third: null } as const;

function baseKey(base: "1" | "2" | "3"): BaseKey {
  return base === "1" ? "first" : base === "2" ? "second" : "third";
}

function otherSide(side: TeamSide): TeamSide {
  return side === "home" ? "away" : "home";
}

/**
 * A walk moves only the runners that are forced. The batter always takes
 * first; a runner on third scores only when first and second are occupied.
 */
function forcedAdvance(bases: Bases, batter: string): { bases: Bases; runScored: boolean } {
  const next: Bases = { ...bases };

  if (next.first === null) {
    next.first = batter;
    return { bases: next, runScored: false };
  }
  if (next.second === null) {
    next.second = next.first;
    next.first = batter;
    return { bases: next, runScored: false };
  }
  if (next.third === null) {
    next.third = next.second;
    next.second = next.first;
    next.first = batter;
    return { bases: next, runScored: false };
  }

  // Bases loaded: the runner on third is forced home.
  next.third = next.second;
  next.second = next.first;
  next.first = batter;
  return { bases: next, runScored: true };
}

/**
 * Folds one event into the projection. Pure: returns a new object and never
 * mutates its input, so a caller can fold any prefix of the log to get the
 * state as of that sequence number.
 *
 * The contract caps `count` at 3-2, so the walk and the strikeout are decided
 * here from the fold's own counter before the counter is reset. A fourth ball
 * and a third strike therefore never leak a value the contract rejects.
 */
export function applyEvent(state: GameState, event: Event): GameState {
  const base: GameState = { ...state, lastSeq: event.seq };

  switch (event.type) {
    case "game.start":
      return {
        ...base,
        status: "live",
        inning: 1,
        half: "top",
        outs: 0,
        count: { ...cleanCount },
        bases: { ...emptyBases },
        score: { home: 0, away: 0 },
        battingTeam: "away",
      };

    case "pitch": {
      const { call, batter } = event.payload;
      const count = { ...state.count };
      const side = state.battingTeam;

      // B, P and I are balls; a fourth one is a walk, not a stored count of 4.
      if (call === "B" || call === "P" || call === "I") {
        count.balls += 1;
        if (count.balls >= 4) {
          const advance = forcedAdvance(state.bases, batter);
          return {
            ...base,
            count: { ...cleanCount },
            bases: advance.bases,
            score: advance.runScored
              ? { ...state.score, [side]: state.score[side] + 1 }
              : state.score,
          };
        }
        return { ...base, count };
      }

      // H is a hit by pitch: the batter is awarded first base and only the
      // runners it forces advance, exactly as on a walk. The plate appearance
      // ends and the count resets.
      if (call === "H") {
        const advance = forcedAdvance(state.bases, batter);
        return {
          ...base,
          count: { ...cleanCount },
          bases: advance.bases,
          score: advance.runScored
            ? { ...state.score, [side]: state.score[side] + 1 }
            : state.score,
        };
      }

      // C, S and Q are strikes; a third one is a strikeout.
      if (call === "C" || call === "S" || call === "Q") {
        count.strikes += 1;
        if (count.strikes >= 3) {
          return {
            ...base,
            outs: Math.min(state.outs + 1, 2),
            count: { ...cleanCount },
          };
        }
        return { ...base, count };
      }

      // A foul never produces a third strike.
      if (call === "F") {
        return { ...base, count: { balls: count.balls, strikes: Math.min(count.strikes + 1, 2) } };
      }

      // A foul tip with two strikes is a strikeout; otherwise it is a strike.
      if (call === "T") {
        if (state.count.strikes >= 2) {
          return {
            ...base,
            outs: Math.min(state.outs + 1, 2),
            count: { ...cleanCount },
          };
        }
        return { ...base, count: { balls: count.balls, strikes: count.strikes + 1 } };
      }

      // X announces a ball in play; the following `ball_in_play` resets the
      // count, so X itself only advances the sequence number.
      return base;
    }

    case "ball_in_play": {
      const { fielders, runnersAdvanced, runsBattedIn } = event.payload;
      const side = state.battingTeam;
      const bases: Bases = { ...state.bases };
      const putouts = (fielders ?? []).filter((fielder) => fielder.role === "putout").length;
      let score = state.score;

      if (runnersAdvanced && runnersAdvanced.length > 0) {
        // Collect first, then move in two phases: a later clear must not wipe a
        // runner an earlier entry already placed on that base.
        const moves = runnersAdvanced;
        for (const advance of moves) {
          if (advance.from !== "B") bases[baseKey(advance.from)] = null;
        }
        let runs = 0;
        for (const advance of moves) {
          if (advance.to === "H") {
            runs += 1;
          } else if (advance.to !== "B") {
            bases[baseKey(advance.to)] = advance.player;
          }
        }
        if (runs > 0) score = { ...score, [side]: score[side] + runs };
      } else if (runsBattedIn > 0) {
        // No baserunning detail: the official runs batted in is the only
        // number the log actually states, so it is the one used.
        score = { ...score, [side]: score[side] + runsBattedIn };
      }

      // The batter is kept in the payload for the scorekeeper; without a
      // runnersAdvanced entry there is nothing in the log that places him on
      // a base, so no base is invented for him.
      return {
        ...base,
        outs: Math.min(state.outs + putouts, 2),
        count: { ...cleanCount },
        bases,
        score,
      };
    }

    case "runner": {
      const { player, from, to, kind, out } = event.payload;
      const bases: Bases = { ...state.bases };
      const side = state.battingTeam;
      let score = state.score;
      let outs = state.outs;

      // An automatic extra-inning runner is placed directly on a base. There
      // is no runner leaving another base, no pitch and no plate appearance.
      if (kind === "placed") {
        if (to !== "H") bases[baseKey(to)] = player;
        return { ...base, bases };
      }

      // A runner entering from the bench has no base to vacate.
      if (from !== "bench") bases[baseKey(from)] = null;
      if (out) {
        outs = Math.min(outs + 1, 2);
      } else if (to === "H") {
        score = { ...score, [side]: score[side] + 1 };
      } else {
        bases[baseKey(to)] = player;
      }

      return { ...base, bases, outs, score };
    }

    case "inning.end": {
      // The human ends the half. Three outs alone never advance it.
      const half: HalfInning = state.half === "top" ? "bottom" : "top";
      const inning = state.half === "bottom" ? state.inning + 1 : state.inning;
      return {
        ...base,
        inning,
        half,
        outs: 0,
        count: { ...cleanCount },
        bases: { ...emptyBases },
        battingTeam: otherSide(state.battingTeam),
      };
    }

    case "game.end": {
      const reason = event.payload.reason;
      const status: GameStatus =
        reason === "completed" || reason === "shortened"
          ? "final"
          : reason === "forfeit"
            ? "forfeit"
            : "suspended";
      return { ...base, status, score: { ...event.payload.finalScore } };
    }

    case "interference": {
      // Batter interference awards first base and forces only the runners
      // behind the batter, exactly like a walk.
      const side = state.battingTeam;
      const advance = forcedAdvance(state.bases, event.payload.batter);
      return {
        ...base,
        count: { ...cleanCount },
        bases: advance.bases,
        score: advance.runScored
          ? { ...state.score, [side]: state.score[side] + 1 }
          : state.score,
      };
    }

    case "game.suspend":
      return { ...base, status: "suspended" };

    case "game.resume":
      return { ...base, status: "live" };

    case "ejection":
      // Audit only: the person left the game, but the projection has no
      // person registry to remove them from.
      return base;

    case "lineup.set":
    case "substitution":
    case "discrepancy":
    case "amendment":
    case "note":
      return base;

    default:
      // A newer producer can send an event type this build does not know.
      // The contract requires skipping it, not failing the stream.
      return base;
  }
}

/**
 * The events a projection actually applies. A revision supersedes the event
 * named by `revisionOf`, and a void amendment (`replacement: null`) removes
 * the event at `targetSeq`. Both replaced events stay in the log: the
 * correction is append-only, only the fold skips the originals.
 *
 * A chain A <- B <- C leaves only C, because both A and B are superseded.
 */
export function appliedEvents(events: readonly Event[]): Event[] {
  const superseded = new Set<string>();
  const voidTargets = new Set<number>();

  for (const event of events) {
    if (typeof event.revisionOf === "string") superseded.add(event.revisionOf);
    if (event.type === "amendment" && event.payload.replacement === null) {
      voidTargets.add(event.payload.targetSeq);
    }
  }

  return events.filter(
    (event) => !superseded.has(event.id) && !voidTargets.has(event.seq),
  );
}

export function foldEvents(events: readonly Event[], from: GameState = initialState): GameState {
  const state = appliedEvents(events).reduce(applyEvent, from);
  // A skipped event was still consumed by the log, so the projection's cursor
  // must include it; otherwise a resume from `lastSeq` would replay it.
  const lastSeq = events.reduce((max, event) => Math.max(max, event.seq), from.lastSeq);
  return { ...state, lastSeq };
}
