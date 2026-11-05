import { fetchLeagueSeasons, fetchSeasonStats } from "./league-api";
import type { LeagueSeason, LeagueSeasonStats } from "./types";

/** Requested season, else the active one, else the newest listed season. */
export function selectSeason(
  seasons: readonly LeagueSeason[],
  seasonId?: string | null,
): LeagueSeason | null {
  if (seasonId) {
    const requested = seasons.find((season) => season.id === seasonId);
    if (requested) return requested;
  }
  return seasons.find((season) => season.status === "active") ?? seasons[0] ?? null;
}

export interface SeasonStatsPageData {
  seasons: LeagueSeason[];
  season: LeagueSeason | null;
  /** Null when the season has no stats endpoint or the API did not answer. */
  stats: LeagueSeasonStats | null;
}

/**
 * One request for seasons and one for the selected season's stats. A failed
 * stats read keeps the page up with an explicit unavailable state instead of
 * inventing empty leaders.
 */
export async function fetchSeasonStatsPage(seasonId?: string | null): Promise<SeasonStatsPageData> {
  let seasons: LeagueSeason[];
  try {
    seasons = await fetchLeagueSeasons();
  } catch {
    return { seasons: [], season: null, stats: null };
  }

  const season = selectSeason(seasons, seasonId);
  if (!season) return { seasons, season: null, stats: null };

  try {
    const stats = await fetchSeasonStats(season.id);
    return { seasons, season, stats };
  } catch {
    return { seasons, season, stats: null };
  }
}
