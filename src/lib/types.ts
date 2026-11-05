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

export interface LeagueSeason {
  id: string;
  organizationId: string;
  name: string;
  year: number;
  status: "active" | "archived";
  startsOn: string | null;
  endsOn: string | null;
}

export interface LeagueCompetition {
  id: string;
  seasonId: string;
  parentId: string | null;
  name: string;
  kind: "league" | "division";
  level: number;
  sortOrder: number;
}

export interface LeagueTeamSeason {
  id: string;
  teamId: string;
  seasonId: string;
  competitionId: string | null;
  name: string;
  abbreviation: string | null;
  teamName: string;
  competitionName: string | null;
}

export interface LeagueRosterEntry {
  id: string;
  teamSeasonId: string;
  playerId: string;
  jersey: string | null;
  primaryPosition: string | null;
  eligibilityStart: string | null;
  eligibilityEnd: string | null;
  status: "active" | "inactive";
  firstName: string;
  lastName: string;
}

export type GameCoverage = "full" | "summary" | "external";
export type GameDataSource = "official" | "team_report" | "import" | "external";

export interface LeagueGame extends GameRecord {
  seasonId: string | null;
  competitionId: string | null;
  homeTeamSeasonId: string | null;
  awayTeamSeasonId: string | null;
  coverage: GameCoverage;
  dataSource: GameDataSource;
  rulesProfile: unknown;
  status: GameStatus;
  score: { home: number; away: number } | null;
}

export interface LeagueStandingRow {
  teamSeasonId: string;
  team: string;
  w: number;
  l: number;
  runsFor: number;
  runsAgainst: number;
  pct: number;
  gamesPlayed: number;
}

export interface LeagueStandingGroup {
  competitionId: string;
  competitionName: string;
  teams: LeagueStandingRow[];
}

export interface GameSummary {
  gameId: string;
  homeScore: number | null;
  awayScore: number | null;
  linescore: unknown;
  teamBox: unknown;
  source: string | null;
  updatedAt: string;
}

export interface LeagueGameDetail {
  game: LeagueGame;
  summary: GameSummary | null;
}

export interface LeagueSeasonOverview {
  season: LeagueSeason;
  competitions: LeagueCompetition[];
}

export interface LeagueTeamSeasonView {
  teamSeason: LeagueTeamSeason;
  roster: LeagueRosterEntry[];
}
