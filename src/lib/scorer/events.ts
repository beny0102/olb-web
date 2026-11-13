import type {
  AmendmentPayload,
  EjectionPayload,
  Event,
  GameResumePayload,
  GameStartPayload,
  GameSuspendPayload,
  InterferencePayload,
  LineupSetPayload,
  NotePayload,
  PitchPayload,
  SubstitutionPayload,
} from "@olb/contract/types";
import type { FieldingPosition, Lineup, TeamSide } from "./types";
import { battingOrder } from "./lineup";
import { uuid7 } from "./uuid7";

export const DEFAULT_ACTOR_ID = "local-scorer";

export interface EventContext {
  contract: "olb.event/1";
  id: string;
  gameId: string;
  seq: number;
  occurredAt: string;
  recordedAt: string;
  source: "human";
  actor: { kind: "user"; id: string };
  revisionOf?: string | null;
}

/**
 * Shared envelope for every event the scorer appends. The id is a UUIDv7
 * because the contract rejects v4 identifiers.
 */
export function context(
  gameId: string,
  seq: number,
  actorId: string = DEFAULT_ACTOR_ID,
  revisionOf?: string | null,
): EventContext {
  const now = new Date().toISOString();
  return {
    contract: "olb.event/1",
    id: uuid7(),
    gameId,
    seq,
    occurredAt: now,
    recordedAt: now,
    source: "human",
    actor: { kind: "user", id: actorId },
    ...(revisionOf === undefined ? {} : { revisionOf }),
  };
}

export function gameStart(
  gameId: string,
  seq: number,
  payload: GameStartPayload = {},
): Event {
  return { ...context(gameId, seq), type: "game.start", payload } as Event;
}

export function lineupSet(gameId: string, seq: number, lineup: Lineup): Event {
  const payload: LineupSetPayload = {
    team: lineup.team,
    battingOrder: battingOrder(lineup).map((player) => ({
      player: player.id,
      position: player.position,
    })) as LineupSetPayload["battingOrder"],
    pitcher: lineup.pitcherId,
  };
  return { ...context(gameId, seq), type: "lineup.set", payload } as Event;
}

export interface PitchInput {
  pitchNo: number;
  batter: string;
  pitcher: string;
  count: { balls: number; strikes: number };
  call: PitchPayload["call"];
  pitchType?: string;
}

export function pitch(gameId: string, seq: number, input: PitchInput): Event {
  assertCount(input.count);
  return { ...context(gameId, seq), type: "pitch", payload: input } as Event;
}

export interface FielderCredit {
  player: string;
  position?: FieldingPosition;
  role: "assist" | "putout" | "error";
}

export interface RunnerAdvance {
  player: string;
  from: "1" | "2" | "3" | "B";
  to: "1" | "2" | "3" | "B" | "H";
  on?:
    | "hit"
    | "error"
    | "walk"
    | "sacrifice"
    | "steal"
    | "wild_pitch"
    | "passed_ball"
    | "balk"
    | "other";
}

export interface BallInPlayInput {
  batter: string;
  code: string;
  runsBattedIn: number;
  fielders?: FielderCredit[];
  runnersAdvanced?: RunnerAdvance[];
  description?: string;
}

export function ballInPlay(
  gameId: string,
  seq: number,
  input: BallInPlayInput,
): Event {
  if (!Number.isInteger(input.runsBattedIn) || input.runsBattedIn < 0 || input.runsBattedIn > 4) {
    throw new RangeError("Las carreras impulsadas deben ser un entero entre 0 y 4.");
  }
  return {
    ...context(gameId, seq),
    type: "ball_in_play",
    payload: input,
  } as Event;
}

export interface RunnerInput {
  player: string;
  from: "1" | "2" | "3" | "bench";
  to: "1" | "2" | "3" | "H";
  kind:
    | "steal"
    | "caught_stealing"
    | "pickoff"
    | "wild_pitch"
    | "passed_ball"
    | "balk"
    | "placed"
    | "other";
  out: boolean;
}

export function runner(gameId: string, seq: number, input: RunnerInput): Event {
  if (input.kind === "placed" && (input.from !== "bench" || input.out || input.to === "H")) {
    throw new RangeError(
      "Un corredor colocado entra desde la banca a una base, sin out ni carrera.",
    );
  }
  return { ...context(gameId, seq), type: "runner", payload: input } as Event;
}

export interface SubstitutionInput {
  team: TeamSide;
  playerIn: string;
  playerOut: string;
  position: FieldingPosition;
  battingSlot: number;
  reason?: SubstitutionPayload["reason"];
  reentry?: boolean;
}

export function substitution(
  gameId: string,
  seq: number,
  input: SubstitutionInput,
): Event {
  const payload: SubstitutionPayload = {
    team: input.team,
    playerIn: input.playerIn,
    playerOut: input.playerOut,
    position: input.position,
    battingSlot: input.battingSlot,
    ...(input.reason === undefined ? {} : { reason: input.reason }),
    ...(input.reentry === undefined ? {} : { reentry: input.reentry }),
  };
  return { ...context(gameId, seq), type: "substitution", payload } as Event;
}

export interface InterferenceInput {
  batter: string;
  kind?: InterferencePayload["kind"];
  fielder?: string;
  description?: string;
}

export function interference(
  gameId: string,
  seq: number,
  input: InterferenceInput,
): Event {
  const payload: InterferencePayload = {
    batter: input.batter,
    kind: input.kind ?? "catcher",
    ...(input.fielder === undefined ? {} : { fielder: input.fielder }),
    ...(input.description === undefined ? {} : { description: input.description }),
  };
  return { ...context(gameId, seq), type: "interference", payload } as Event;
}

export interface EjectionInput {
  person: string;
  role: EjectionPayload["role"];
  reason: string;
}

export function ejection(gameId: string, seq: number, input: EjectionInput): Event {
  if (input.reason.trim() === "") {
    throw new RangeError("La expulsión necesita un motivo.");
  }
  return { ...context(gameId, seq), type: "ejection", payload: input } as Event;
}

export function gameSuspend(
  gameId: string,
  seq: number,
  payload: GameSuspendPayload,
): Event {
  if (payload.reason.trim() === "") {
    throw new RangeError("La suspensión necesita un motivo.");
  }
  return { ...context(gameId, seq), type: "game.suspend", payload } as Event;
}

export function gameResume(
  gameId: string,
  seq: number,
  payload: GameResumePayload = {},
): Event {
  return { ...context(gameId, seq), type: "game.resume", payload } as Event;
}

/** A free-text note: the automatic runner and the courtesy runner leave one. */
export function note(gameId: string, seq: number, payload: NotePayload): Event {
  if (payload.text.trim() === "") {
    throw new RangeError("La nota necesita un texto.");
  }
  return { ...context(gameId, seq), type: "note", payload } as Event;
}

export interface InningEndInput {
  inning: number;
  half: "top" | "bottom";
  runsScored: number;
  outs: number;
}

export function inningEnd(gameId: string, seq: number, input: InningEndInput): Event {
  if (!Number.isInteger(input.outs) || input.outs < 1 || input.outs > 3) {
    throw new RangeError("El fin de entrada debe registrar entre 1 y 3 outs.");
  }
  if (!Number.isInteger(input.runsScored) || input.runsScored < 0) {
    throw new RangeError("Las carreras de la entrada no pueden ser negativas.");
  }
  return { ...context(gameId, seq), type: "inning.end", payload: input } as Event;
}

export interface GameEndInput {
  reason:
    | "completed"
    | "shortened"
    | "forfeit"
    | "suspended"
    | "rain"
    | "darkness"
    | "other";
  finalScore: { home: number; away: number };
}

export function gameEnd(gameId: string, seq: number, input: GameEndInput): Event {
  return { ...context(gameId, seq), type: "game.end", payload: input } as Event;
}

export type AmendmentReason = AmendmentPayload["reason"];

/**
 * Append-only undo. The original event stays in the log and the fold skips it
 * because this amendment names it in `revisionOf` and in `targetSeq`.
 */
export function voidEvent(
  gameId: string,
  seq: number,
  target: Pick<Event, "id" | "seq">,
  reason: AmendmentReason,
  note?: string,
): Event {
  const payload: AmendmentPayload = {
    targetSeq: target.seq,
    reason,
    ...(note === undefined ? {} : { note }),
    replacement: null,
  };
  return {
    ...context(gameId, seq, DEFAULT_ACTOR_ID, target.id),
    type: "amendment",
    payload,
  } as Event;
}

/**
 * A correction that replaces an earlier event without mutating it. The
 * corrected event keeps its own fresh id and points at the original.
 */
export function revision(
  _context: EventContext,
  original: Pick<Event, "id">,
  corrected: Event,
): Event {
  return { ...corrected, revisionOf: original.id } as Event;
}

function assertCount(count: { balls: number; strikes: number }): void {
  if (
    !Number.isInteger(count.balls) ||
    !Number.isInteger(count.strikes) ||
    count.balls < 0 ||
    count.balls > 3 ||
    count.strikes < 0 ||
    count.strikes > 2
  ) {
    throw new RangeError("El conteo debe ser 0–3 bolas y 0–2 strikes.");
  }
}
