import {
  fetchEvents,
  fetchGames,
  fetchHealth,
  fetchStandings,
  fetchState,
  type HealthRecord,
} from "./api";
import type {
  Event,
  GameRecord,
  GameState,
  GameStatus,
  Standings,
  StandingsTeam,
} from "./types";

export const CONTRACT_VERSION = "0.1.0";

export interface PortalGame {
  game: GameRecord;
  state: GameState | null;
  events: Event[];
}

export interface PortalData {
  games: PortalGame[];
  health: HealthRecord | null;
  standings: Standings | null;
  fetchedAt: string;
}

export interface InningLine {
  inning: number;
  away: number | null;
  home: number | null;
}

export interface Linescore {
  innings: InningLine[];
  awayTotal: number;
  homeTotal: number;
  hasData: boolean;
}

/**
 * Loads everything the portal renders. If the games endpoint is unreachable we
 * return null so the page can show an offline band instead of inventing a
 * schedule or a score. Per-game failures stay local to that game.
 */
export async function fetchPortalData(): Promise<PortalData | null> {
  try {
    const [games, health, standings] = await Promise.all([
      fetchGames(),
      fetchHealth().catch(() => null),
      fetchStandings().catch(() => null),
    ]);

    const bundles = await Promise.all(
      games.map(async (game): Promise<PortalGame> => {
        const [state, events] = await Promise.all([
          fetchState(game.id).catch(() => null),
          fetchEvents(game.id).catch(() => []),
        ]);
        return { game, state, events };
      }),
    );

    return { games: bundles, health, standings, fetchedAt: new Date().toISOString() };
  } catch {
    return null;
  }
}

export function gameStatus(entry: PortalGame): GameStatus {
  return entry.state?.status ?? "scheduled";
}

export const STATUS_LABEL: Record<GameStatus, string> = {
  scheduled: "PRÓXIMO",
  live: "EN VIVO",
  final: "FINAL",
  suspended: "SUSPENDIDO",
  forfeit: "FORFAIT",
};

function byCreatedDesc(a: PortalGame, b: PortalGame): number {
  return b.game.createdAt.localeCompare(a.game.createdAt);
}

/** Live games lead; everything else follows by creation time, newest first. */
export function orderGames(games: readonly PortalGame[]): PortalGame[] {
  const live = games.filter((entry) => gameStatus(entry) === "live").sort(byCreatedDesc);
  const rest = games.filter((entry) => gameStatus(entry) !== "live").sort(byCreatedDesc);
  return [...live, ...rest];
}

export function topGames(games: readonly PortalGame[], limit = 4): PortalGame[] {
  return orderGames(games).slice(0, limit);
}

function scheduledStartTime(entry: PortalGame): number {
  const raw = entry.game.scheduledStart;
  if (!raw) return Number.POSITIVE_INFINITY;
  const parsed = Date.parse(raw);
  return Number.isNaN(parsed) ? Number.POSITIVE_INFINITY : parsed;
}

function byScheduledStart(a: PortalGame, b: PortalGame): number {
  return (
    scheduledStartTime(a) - scheduledStartTime(b) || a.game.createdAt.localeCompare(b.game.createdAt)
  );
}

/**
 * Slate order: live first, then scheduled games soonest first, then the most
 * recent finals. A missing or malformed start time sorts after every known
 * one instead of being treated as today. Suspended and forfeit records trail.
 */
export function orderSlate(games: readonly PortalGame[]): PortalGame[] {
  const live = games.filter((entry) => gameStatus(entry) === "live").sort(byCreatedDesc);
  const scheduled = games
    .filter((entry) => gameStatus(entry) === "scheduled")
    .sort(byScheduledStart);
  const final = games.filter((entry) => gameStatus(entry) === "final").sort(byCreatedDesc);
  const rest = games
    .filter((entry) => !["live", "scheduled", "final"].includes(gameStatus(entry)))
    .sort(byCreatedDesc);
  return [...live, ...scheduled, ...final, ...rest];
}

export function selectFeatured(games: readonly PortalGame[]): PortalGame | null {
  const ordered = orderGames(games);
  const live = ordered.find((entry) => gameStatus(entry) === "live");
  if (live) return live;
  const final = ordered.find((entry) => gameStatus(entry) === "final");
  return final ?? ordered[0] ?? null;
}

export function selectSlate(games: readonly PortalGame[], limit = 4): PortalGame[] {
  const scheduled = games
    .filter((entry) => gameStatus(entry) === "scheduled")
    .sort(byCreatedDesc);
  if (scheduled.length > 0) return scheduled.slice(0, limit);
  return orderGames(games).slice(0, limit);
}

export function ledgerGames(games: readonly PortalGame[]): PortalGame[] {
  return orderGames(games);
}

export function lastEvent(entry: PortalGame): Event | null {
  let latest: Event | null = null;
  for (const event of entry.events) {
    if (!latest || event.seq > latest.seq) latest = event;
  }
  return latest;
}

export function lastPitch(entry: PortalGame): Event | null {
  for (let index = entry.events.length - 1; index >= 0; index -= 1) {
    const event = entry.events[index];
    if (event?.type === "pitch") return event;
  }
  return null;
}

export function lastBallInPlay(entry: PortalGame): Event | null {
  for (let index = entry.events.length - 1; index >= 0; index -= 1) {
    const event = entry.events[index];
    if (event?.type === "ball_in_play") return event;
  }
  return null;
}

/** Three-letter club mark derived from the name in the API, never invented. */
export function teamAbbr(name: string): string {
  const cleaned = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ")
    .trim();

  if (cleaned.length === 0) return "OLB";
  const words = cleaned.split(/\s+/);
  if (words.length >= 3) {
    return words
      .slice(0, 3)
      .map((word) => word[0] ?? "")
      .join("");
  }
  if (words.length === 2) {
    return `${words[0]?.slice(0, 2) ?? ""}${words[1]?.[0] ?? ""}`;
  }
  return words[0]?.slice(0, 3) ?? "OLB";
}

export function shortGameId(id: string): string {
  return id.replace(/-/g, "").slice(-8).toUpperCase();
}

/** Highest inning closed in the log, used instead of the projection's next inning. */
export function lastClosedInning(events: readonly Event[]): number | null {
  let last: number | null = null;
  for (const event of events) {
    if (event.type !== "inning.end") continue;
    if (last === null || event.payload.inning > last) last = event.payload.inning;
  }
  return last;
}

export function formatTime(value: string | Date): string {
  return new Intl.DateTimeFormat("es-MX", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(typeof value === "string" ? new Date(value) : value);
}

/** A standings band needs at least two clubs; otherwise it is omitted. */
export function visibleStandings(standings: Standings | null): StandingsTeam[] {
  if (!standings || standings.teams.length < 2) return [];
  return standings.teams;
}

export function scoreLabel(entry: PortalGame): string {
  const away = teamAbbr(entry.game.awayTeam);
  const home = teamAbbr(entry.game.homeTeam);
  if (!entry.state || entry.state.status === "scheduled") return `${away} @ ${home}`;
  return `${away} ${entry.state.score.away}, ${home} ${entry.state.score.home}`;
}

/** A score column shows a dash before first pitch; the matchup belongs in the slate. */
export function ledgerScore(entry: PortalGame): string {
  return gameStatus(entry) === "scheduled" ? "—" : scoreLabel(entry);
}

/**
 * Builds the linescore exclusively from closed half-innings. Runs still in
 * progress are not guessed; the official R column comes from `GameState`.
 */
export function deriveLinescore(events: readonly Event[]): Linescore {
  const rows = new Map<number, { away: number | null; home: number | null }>();
  let awayTotal = 0;
  let homeTotal = 0;

  for (const event of events) {
    if (event.type !== "inning.end") continue;
    const row = rows.get(event.payload.inning) ?? { away: null, home: null };
    if (event.payload.half === "top") {
      row.away = event.payload.runsScored;
      awayTotal += event.payload.runsScored;
    } else {
      row.home = event.payload.runsScored;
      homeTotal += event.payload.runsScored;
    }
    rows.set(event.payload.inning, row);
  }

  const lastInning = rows.size === 0 ? 0 : Math.max(...rows.keys());
  const innings: InningLine[] = [];
  for (let inning = 1; inning <= lastInning; inning += 1) {
    const row = rows.get(inning);
    innings.push({
      inning,
      away: row?.away ?? null,
      home: row?.home ?? null,
    });
  }

  return { innings, awayTotal, homeTotal, hasData: rows.size > 0 };
}
