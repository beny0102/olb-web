import type { Event, GameRecord, GameState } from "./types";

const GAME_ID = "0192f3a0-5b11-7a02-8f3c-1c9d2e3f4a50";
const BATTER = "0192f3a2-0001-7000-8000-000000000001";
const PITCHER = "0192f3a2-0001-7000-8000-000000000002";
const RUNNER = "0192f3a2-0001-7000-8000-000000000003";
const BASE = Date.parse("2026-04-11T23:41:00.000Z");

function demoEvent(seq: number, type: Event["type"], payload: unknown): Event {
  const at = new Date(BASE + seq * 1000).toISOString();
  return {
    contract: "olb.event/1",
    id: `0192f401-0000-7000-8000-${seq.toString(16).padStart(12, "0")}`,
    gameId: GAME_ID,
    seq,
    occurredAt: at,
    recordedAt: at,
    type,
    source: "human",
    actor: { kind: "user", id: "demo-scorer" },
    payload,
  } as Event;
}

const pitch = (seq: number, call: string, balls: number, strikes: number) =>
  demoEvent(seq, "pitch", {
    pitchNo: seq,
    batter: BATTER,
    pitcher: PITCHER,
    count: { balls, strikes },
    call,
  });

export const demoGame: GameRecord = {
  id: GAME_ID,
  homeTeam: "Marlins",
  awayTeam: "Tiburones",
  scheduledStart: null,
  venue: null,
  createdAt: new Date(BASE).toISOString(),
  lastSeq: 11,
};

export const demoEvents: Event[] = [
  demoEvent(0, "game.start", { venue: "Campo Norte", startedAt: new Date(BASE).toISOString() }),
  pitch(1, "B", 0, 0),
  pitch(2, "S", 0, 0),
  pitch(3, "F", 0, 1),
  pitch(4, "B", 0, 2),
  demoEvent(5, "ball_in_play", {
    batter: BATTER,
    code: "D7/L",
    description: "Línea al jardín izquierdo",
    runsBattedIn: 1,
  }),
  demoEvent(6, "inning.end", { inning: 1, half: "top", runsScored: 1, outs: 3 }),
  pitch(7, "B", 0, 0),
  pitch(8, "S", 1, 0),
  demoEvent(9, "ball_in_play", { batter: BATTER, code: "8/F", runsBattedIn: 0 }),
  demoEvent(10, "runner", {
    player: RUNNER,
    from: "1",
    to: "2",
    kind: "caught_stealing",
    out: true,
  }),
  demoEvent(11, "note", { text: "Transmisión de demostración, sin cámaras." }),
];

const cleanCount = { balls: 0, strikes: 0 };
const emptyBases = { first: null, second: null, third: null } as const;

/**
 * Demo-only fold. The API owns the real projection; this copy exists so the
 * static demo page can replay a recorded log without a backend.
 */
export function foldDemo(events: readonly Event[]): GameState {
  let state: GameState = {
    status: "scheduled",
    inning: 1,
    half: "top",
    outs: 0,
    count: { ...cleanCount },
    bases: { ...emptyBases },
    score: { home: 0, away: 0 },
    battingTeam: "away",
    lastSeq: 0,
  };

  for (const event of events) {
    const base: GameState = { ...state, lastSeq: event.seq };

    switch (event.type) {
      case "game.start":
        state = {
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
        break;
      case "pitch": {
        const count = { ...state.count };
        if (event.payload.call === "B") count.balls = Math.min(count.balls + 1, 3);
        else if (["C", "S", "T", "F"].includes(event.payload.call)) {
          count.strikes = Math.min(count.strikes + 1, 2);
        }
        state = { ...base, count };
        break;
      }
      case "ball_in_play": {
        const side = state.battingTeam;
        state = {
          ...base,
          count: { ...cleanCount },
          score: { ...state.score, [side]: state.score[side] + event.payload.runsBattedIn },
        };
        break;
      }
      case "runner": {
        const outs = event.payload.out ? Math.min(state.outs + 1, 2) : state.outs;
        state = { ...base, outs };
        break;
      }
      case "inning.end": {
        const half = state.half === "top" ? "bottom" : "top";
        const inning = state.half === "bottom" ? state.inning + 1 : state.inning;
        state = {
          ...base,
          inning,
          half,
          outs: 0,
          count: { ...cleanCount },
          bases: { ...emptyBases },
          battingTeam: half === "top" ? "away" : "home",
        };
        break;
      }
      case "game.end":
        state = { ...base, status: event.payload.reason === "completed" ? "final" : "suspended" };
        break;
      default:
        state = base;
    }
  }

  return state;
}

export const demoState = foldDemo(demoEvents);
export const demoBundle = {
  game: demoGame,
  state: demoState,
  events: demoEvents,
};
