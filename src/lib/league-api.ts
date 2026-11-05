import { ApiError, get, SERVER_API_URL } from "./api";
import type {
  LeagueCompetition,
  LeagueGame,
  LeagueGameDetail,
  LeagueSeason,
  LeagueSeasonOverview,
  LeagueStandingGroup,
  LeagueTeamSeason,
  LeagueTeamSeasonView,
} from "./types";

function path(segment: string): string {
  return segment.startsWith("/") ? segment : `/${segment}`;
}

export function fetchLeagueSeasons(): Promise<LeagueSeason[]> {
  return get<LeagueSeason[]>(SERVER_API_URL, path("/seasons"));
}

export function fetchLeagueSeason(id: string): Promise<LeagueSeasonOverview> {
  return get<LeagueSeasonOverview>(SERVER_API_URL, path(`/seasons/${encodeURIComponent(id)}`));
}

export function fetchLeagueCompetitions(id: string): Promise<LeagueCompetition[]> {
  return get<LeagueCompetition[]>(
    SERVER_API_URL,
    path(`/seasons/${encodeURIComponent(id)}/competitions`),
  );
}

export function fetchLeagueTeams(competitionId: string): Promise<LeagueTeamSeason[]> {
  return get<LeagueTeamSeason[]>(
    SERVER_API_URL,
    path(`/competitions/${encodeURIComponent(competitionId)}/teams`),
  );
}

export function fetchTeamSeason(id: string): Promise<LeagueTeamSeasonView> {
  return get<LeagueTeamSeasonView>(
    SERVER_API_URL,
    path(`/team-seasons/${encodeURIComponent(id)}`),
  );
}

export function fetchLeagueGames(seasonId: string): Promise<LeagueGame[]> {
  return get<LeagueGame[]>(SERVER_API_URL, path(`/seasons/${encodeURIComponent(seasonId)}/games`));
}

export function fetchLeagueStandings(seasonId: string): Promise<LeagueStandingGroup[]> {
  return get<LeagueStandingGroup[]>(
    SERVER_API_URL,
    path(`/seasons/${encodeURIComponent(seasonId)}/standings`),
  );
}

/**
 * A detail read for one league game. A 404 or an unreachable API returns null
 * so the caller can keep the legacy `/games/:id` viewer.
 */
export async function fetchLeagueGame(id: string): Promise<LeagueGameDetail | null> {
  try {
    return await get<LeagueGameDetail>(
      SERVER_API_URL,
      path(`/league-games/${encodeURIComponent(id)}`),
    );
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null;
    if (error instanceof ApiError) return null;
    return null;
  }
}
