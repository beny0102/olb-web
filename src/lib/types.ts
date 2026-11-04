import type { Event } from "@olb/contract/types";

export type { Event };

export interface GameRecord {
  id: string;
  homeTeam: string;
  awayTeam: string;
  scheduledStart: string | null;
  venue: string | null;
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

export interface TeamBoxScore {
  runs: number;
  hits: number;
  errors: number;
  /** One entry per inning; null means that half was never closed. */
  linescore: (number | null)[];
}

export interface BoxScore {
  gameId: string;
  status: GameStatus;
  home: TeamBoxScore;
  away: TeamBoxScore;
}

export interface StandingsTeam {
  team: string;
  w: number;
  l: number;
  runsFor: number;
  runsAgainst: number;
  pct: number;
}

export interface Standings {
  games: number;
  teams: StandingsTeam[];
}
