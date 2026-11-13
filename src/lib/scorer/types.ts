import type { Event } from "@olb/contract/types";
import type { GameStatus, TeamSide } from "./fold";
import type { RulesProfile } from "./rules";

export type { TeamSide };

export type Coverage = "full" | "summary" | "external";
export type DataSource = "official" | "team_report" | "import" | "external";

/** One player as the league roster exposes them; `id` is the player UUID. */
export interface RosterPlayer {
  id: string;
  name: string;
  position: string;
  jersey: string;
}

export type FieldingPosition =
  | "1"
  | "2"
  | "3"
  | "4"
  | "5"
  | "6"
  | "7"
  | "8"
  | "9"
  | "DH"
  | "PH"
  | "PR";

export interface Player {
  id: string;
  name: string;
  position: FieldingPosition;
  battingSlot: number;
}

export interface Lineup {
  team: TeamSide;
  players: Player[];
  pitcherId: string;
}

export interface LocalGame {
  id: string;
  homeTeam: string;
  awayTeam: string;
  scheduledStart: string | null;
  venue: string | null;
  createdAt: string;
  lineups: { home: Lineup | null; away: Lineup | null };
  rules: RulesProfile;
  seasonId?: string | null;
  competitionId?: string | null;
  homeTeamSeasonId?: string | null;
  awayTeamSeasonId?: string | null;
  coverage?: Coverage;
  dataSource?: DataSource;
  status?: GameStatus;
  score?: { home: number; away: number } | null;
  rosters?: { home: RosterPlayer[]; away: RosterPlayer[] };
  teamSeasonIds?: { home: string; away: string };
}

export interface StoredEvent {
  gameId: string;
  localSeq: number;
  status: "pending" | "synced";
  event: Event;
}
