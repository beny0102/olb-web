import type { Event } from "@olb/contract/types";

export type { Event };

export interface GameRecord {
  id: string;
  homeTeam: string;
  awayTeam: string;
  createdAt: string;
  lastSeq: number;
}

export type GameStatus = "scheduled" | "live" | "final" | "suspended" | "forfeit";

export interface GameState {
  status: GameStatus;
  inning: number;
  half: "top" | "bottom";
  outs: number;
  count: { balls: number; strikes: number };
  bases: { first: string | null; second: string | null; third: string | null };
  score: { home: number; away: number };
  battingTeam: "home" | "away";
  lastSeq: number;
}
