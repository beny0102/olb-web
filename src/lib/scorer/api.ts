import type { Event } from "@olb/contract/types";
import {
  clearToken,
  getToken,
  type AuthMe,
  type AuthSession,
  type Membership,
} from "./auth";
import type { GameState, GameStatus } from "./fold";
import { DEFAULT_RULES, normalizeRules } from "./rules";
import type {
  Coverage,
  DataSource,
  LocalGame,
  RosterPlayer,
} from "./types";

/** The game record `GET /games` and `GET /games/:id` return. */
export interface ApiGame {
  id: string;
  homeTeam: string;
  awayTeam: string;
  scheduledStart: string | null;
  venue: string | null;
  createdAt: string;
  lastSeq: number;
  seasonId?: string | null;
  competitionId?: string | null;
  homeTeamSeasonId?: string | null;
  awayTeamSeasonId?: string | null;
  coverage?: Coverage;
  dataSource?: DataSource;
  status?: GameStatus;
  score?: { home: number; away: number } | null;
  rulesProfile?: unknown;
}

export interface LeagueGame extends ApiGame {
  seasonId: string | null;
  competitionId: string | null;
  homeTeamSeasonId: string | null;
  awayTeamSeasonId: string | null;
  coverage: Coverage;
  dataSource: DataSource;
  status: GameStatus;
  score: { home: number; away: number } | null;
  rulesProfile: unknown;
}

export interface Season {
  id: string;
  organizationId: string;
  name: string;
  year: number;
  status: "active" | "archived";
  startsOn: string | null;
  endsOn: string | null;
}

export interface Competition {
  id: string;
  seasonId: string;
  parentId: string | null;
  name: string;
  kind: "league" | "division";
  level: number;
  sortOrder: number;
}

export interface TeamSeason {
  id: string;
  teamId: string;
  seasonId: string;
  competitionId: string | null;
  name: string;
  abbreviation: string | null;
  teamName: string;
  competitionName: string | null;
}

export interface RosterEntry {
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
  namePublic: boolean;
  displayName: string;
}

export interface TeamSeasonView {
  teamSeason: TeamSeason;
  roster: RosterEntry[];
}

export interface LeagueGameDetail {
  game: LeagueGame;
  summary: unknown | null;
}

/** The projection `GET /games/:id/state` returns. */
export type ApiState = GameState;

export interface CreateGameInput {
  homeTeam: string;
  awayTeam: string;
  scheduledStart?: string | null;
  venue?: string | null;
}

/** What a spotter may propose: a pitch call or the outcome of a ball in play. */
export type ProposalPayload =
  | { kind: "pitch"; call: "B" | "C" | "S" | "F" | "T" }
  | { kind: "outcome"; code: "out" | "1B" | "2B" | "3B" | "HR" | "E" | "FC" };

export type ProposalStatus = "open" | "accepted" | "rejected";

/** A verifier suggestion as the proposal inbox stores it. Never game data. */
export interface Proposal {
  id: string;
  gameId: string;
  createdAt: string;
  author: string;
  status: ProposalStatus;
  payload: ProposalPayload;
}

/** A failed request with the HTTP status, or 0 when the network never answered. */
export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

/**
 * The API origin. A configured `NEXT_PUBLIC_API_URL` wins; in the browser the
 * league API sits on port 3001 of the same host, which keeps the scorer usable
 * from a phone on the local network.
 */
export function apiBase(): string {
  const configured = process.env.NEXT_PUBLIC_API_URL?.trim();
  if (configured) return configured.replace(/\/+$/, "");
  if (typeof window !== "undefined") {
    return `http://${window.location.hostname}:3001`;
  }
  return "http://localhost:3001";
}

function messageForStatus(status: number): string {
  switch (status) {
    case 400:
      return "Los datos del juego no son válidos.";
    case 401:
      return "Tu sesión venció. Inicia sesión de nuevo.";
    case 403:
      return "No tienes permiso para esta acción.";
    case 404:
      return "No encontramos ese juego.";
    case 409:
      return "Ese juego ya existe o ya tiene eventos.";
    case 500:
    case 502:
    case 503:
    case 504:
      return "El servidor tuvo un problema. Inténtalo de nuevo.";
    default:
      return `No pudimos completar la solicitud (${status}).`;
  }
}

/** Tells the auth provider that the stored token is no longer valid. */
function notifyAuthExpired(): void {
  clearToken();
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("olb-auth-expired"));
  }
}

/** JSON over `fetch` with a timeout, an `ApiError` and Spanish messages. */
export async function fetchJson<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getToken();
  let response: Response;
  try {
    response = await fetch(`${apiBase()}${path}`, {
      ...init,
      headers: {
        "content-type": "application/json",
        ...(token ? { authorization: `Bearer ${token}` } : {}),
        ...(init.headers ?? {}),
      },
      signal: AbortSignal.timeout(8000),
    });
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (error instanceof DOMException && error.name === "TimeoutError") {
      throw new ApiError(0, "El servidor tardó demasiado en responder.");
    }
    throw new ApiError(0, "No pudimos conectar con el servidor. Revisa tu conexión.");
  }

  if (!response.ok) {
    if (response.status === 401) notifyAuthExpired();
    throw new ApiError(response.status, messageForStatus(response.status));
  }

  return (await response.json()) as T;
}

export interface LoginInput {
  email: string;
  password: string;
}

/** `POST /auth/login`; a wrong password gets its own Spanish message. */
export async function login(input: LoginInput): Promise<AuthSession> {
  try {
    return await fetchJson<AuthSession>("/auth/login", {
      method: "POST",
      body: JSON.stringify(input),
    });
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      throw new ApiError(401, "Correo o contraseña incorrectos.");
    }
    throw error;
  }
}

/** `GET /auth/me` with the stored Bearer token. */
export function me(): Promise<AuthMe> {
  return fetchJson<AuthMe>("/auth/me");
}

/** `POST /auth/logout`; the API answers 200 even for an already revoked token. */
export function logout(): Promise<{ loggedOut: boolean }> {
  return fetchJson<{ loggedOut: boolean }>("/auth/logout", { method: "POST" });
}

export function listGames(): Promise<ApiGame[]> {
  return fetchJson<ApiGame[]>("/games");
}

export function getGame(id: string): Promise<ApiGame> {
  return fetchJson<ApiGame>(`/games/${encodeURIComponent(id)}`);
}

export function getGameState(id: string): Promise<ApiState> {
  return fetchJson<ApiState>(`/games/${encodeURIComponent(id)}/state`);
}

/** R, H and E are public: the box score route needs no token. */
export interface TeamBoxScore {
  runs: number;
  hits: number;
  errors: number;
  linescore: (number | null)[];
}

export interface GameBoxScore {
  gameId: string;
  status: GameStatus;
  home: TeamBoxScore;
  away: TeamBoxScore;
}

export function getBoxScore(id: string): Promise<GameBoxScore> {
  return fetchJson<GameBoxScore>(`/games/${encodeURIComponent(id)}/boxscore`);
}

/** The server log of one game, starting at `fromSeq` (inclusive). */
export function listGameEvents(gameId: string, fromSeq = 0): Promise<Event[]> {
  return fetchJson<Event[]>(
    `/games/${encodeURIComponent(gameId)}/events?fromSeq=${encodeURIComponent(String(fromSeq))}`,
  );
}

export function createGame(input: CreateGameInput): Promise<ApiGame> {
  const body: Record<string, string> = {
    homeTeam: input.homeTeam,
    awayTeam: input.awayTeam,
  };
  if (input.scheduledStart) body.scheduledStart = input.scheduledStart;
  if (input.venue?.trim()) body.venue = input.venue.trim();

  return fetchJson<ApiGame>("/games", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

/**
 * Appends one local event. The client keeps `id` and `occurredAt` so a retried
 * POST is idempotent; `seq`, `recordedAt` and `contract` belong to the server
 * and are stripped before the request.
 */
export function appendEvent(gameId: string, event: Event): Promise<Event> {
  const { seq: _seq, recordedAt: _recordedAt, contract: _contract, ...body } = event;
  return fetchJson<Event>(`/games/${encodeURIComponent(gameId)}/events`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

/** Sends a verifier suggestion. The API validates the payload vocabulary. */
export function createProposal(
  gameId: string,
  payload: ProposalPayload,
  author: string,
): Promise<Proposal> {
  return fetchJson<Proposal>(`/games/${encodeURIComponent(gameId)}/proposals`, {
    method: "POST",
    body: JSON.stringify({ author, payload }),
  });
}

/** Lists the inbox of one game; `open` is the default and `all` lifts the filter. */
export function listProposals(
  gameId: string,
  status: ProposalStatus | "all" = "open",
): Promise<Proposal[]> {
  return fetchJson<Proposal[]>(
    `/games/${encodeURIComponent(gameId)}/proposals?status=${encodeURIComponent(status)}`,
  );
}

/** Accepts or rejects a proposal. A retry after the first decision is idempotent. */
export function resolveProposal(
  gameId: string,
  id: string,
  status: "accepted" | "rejected",
): Promise<Proposal> {
  return fetchJson<Proposal>(
    `/games/${encodeURIComponent(gameId)}/proposals/${encodeURIComponent(id)}/resolve`,
    {
      method: "POST",
      body: JSON.stringify({ status }),
    },
  );
}

/** A remote game as the local store keeps it, with empty lineups. */
export function toLocalGame(game: ApiGame): LocalGame {
  return {
    id: game.id,
    homeTeam: game.homeTeam,
    awayTeam: game.awayTeam,
    scheduledStart: game.scheduledStart,
    venue: game.venue,
    createdAt: game.createdAt,
    lineups: { home: null, away: null },
    rules: structuredClone(DEFAULT_RULES),
  };
}

export function listSeasons(): Promise<Season[]> {
  return fetchJson<Season[]>("/seasons");
}

export function listCompetitions(seasonId: string): Promise<Competition[]> {
  return fetchJson<Competition[]>(
    `/seasons/${encodeURIComponent(seasonId)}/competitions`,
  );
}

export function listTeams(competitionId: string): Promise<TeamSeason[]> {
  return fetchJson<TeamSeason[]>(
    `/competitions/${encodeURIComponent(competitionId)}/teams`,
  );
}

export function getTeamSeason(id: string): Promise<TeamSeasonView> {
  return fetchJson<TeamSeasonView>(`/admin/team-seasons/${encodeURIComponent(id)}`);
}

export function listSeasonGames(seasonId: string): Promise<LeagueGame[]> {
  return fetchJson<LeagueGame[]>(
    `/seasons/${encodeURIComponent(seasonId)}/games`,
  );
}

export function getLeagueGame(id: string): Promise<LeagueGameDetail> {
  return fetchJson<LeagueGameDetail>(
    `/league-games/${encodeURIComponent(id)}`,
  );
}

/** The roster as the lineup editor and the local store keep it. */
export function toRosterPlayer(entry: RosterEntry): RosterPlayer {
  return {
    id: entry.playerId,
    name: entry.namePublic
      ? `${entry.firstName} ${entry.lastName}`.trim()
      : entry.displayName,
    position: entry.primaryPosition ?? "",
    jersey: entry.jersey ?? "",
  };
}

function activeRoster(entries: readonly RosterEntry[]): RosterPlayer[] {
  return entries
    .filter((entry) => entry.status === "active")
    .map(toRosterPlayer);
}

/** Maps a league game and both rosters into the offline record. */
export function leagueGameToLocalGame(
  game: LeagueGame,
  homeRoster: readonly RosterEntry[] = [],
  awayRoster: readonly RosterEntry[] = [],
): LocalGame {
  const teamSeasonIds =
    game.homeTeamSeasonId !== null && game.awayTeamSeasonId !== null
      ? { home: game.homeTeamSeasonId, away: game.awayTeamSeasonId }
      : undefined;

  return {
    id: game.id,
    homeTeam: game.homeTeam,
    awayTeam: game.awayTeam,
    scheduledStart: game.scheduledStart,
    venue: game.venue,
    createdAt: game.createdAt,
    lineups: { home: null, away: null },
    rules: normalizeRules(game.rulesProfile),
    seasonId: game.seasonId,
    competitionId: game.competitionId,
    homeTeamSeasonId: game.homeTeamSeasonId,
    awayTeamSeasonId: game.awayTeamSeasonId,
    coverage: game.coverage,
    dataSource: game.dataSource,
    status: game.status,
    score: game.score,
    rosters: {
      home: activeRoster(homeRoster),
      away: activeRoster(awayRoster),
    },
    ...(teamSeasonIds ? { teamSeasonIds } : {}),
  };
}

/**
 * Imports one scheduled league game with both team-season rosters. The setup
 * page fills the lineups from those rosters; nothing is invented when a roster
 * is missing.
 */
export async function prepareLeagueGame(gameId: string): Promise<LocalGame> {
  const detail = await getLeagueGame(gameId);
  const { game } = detail;
  const [home, away] = await Promise.all([
    game.homeTeamSeasonId ? getTeamSeason(game.homeTeamSeasonId) : null,
    game.awayTeamSeasonId ? getTeamSeason(game.awayTeamSeasonId) : null,
  ]);

  return leagueGameToLocalGame(game, home?.roster ?? [], away?.roster ?? []);
}

/** A membership that may see every game of its scope, not only its team. */
export function isAdminMembership(membership: Membership): boolean {
  return (
    (membership.scopeType === "organization" ||
      membership.scopeType === "competition") &&
    (membership.role === "org_admin" ||
      membership.role === "competition_admin")
  );
}

/**
 * Scheduled games visible to the signed-in user: a team-season membership on
 * either side, or an organization / competition admin scope. A verifier or a
 * viewer does not gain the admin view.
 */
export function scheduledGamesForMemberships(
  games: readonly LeagueGame[],
  memberships: readonly Membership[],
  organizationId: string | null,
): LeagueGame[] {
  const teamSeasons = new Set(
    memberships
      .filter((membership) => membership.scopeType === "team_season")
      .map((membership) => membership.scopeId),
  );
  const competitions = new Set(
    memberships
      .filter(
        (membership) =>
          membership.scopeType === "competition" && isAdminMembership(membership),
      )
      .map((membership) => membership.scopeId),
  );
  const organizations = new Set(
    memberships
      .filter(
        (membership) =>
          membership.scopeType === "organization" && isAdminMembership(membership),
      )
      .map((membership) => membership.scopeId),
  );

  return games.filter((game) => {
    if (game.status !== "scheduled") return false;
    if (
      (game.homeTeamSeasonId !== null && teamSeasons.has(game.homeTeamSeasonId)) ||
      (game.awayTeamSeasonId !== null && teamSeasons.has(game.awayTeamSeasonId))
    ) {
      return true;
    }
    if (game.competitionId !== null && competitions.has(game.competitionId)) {
      return true;
    }
    return organizationId !== null && organizations.has(organizationId);
  });
}
