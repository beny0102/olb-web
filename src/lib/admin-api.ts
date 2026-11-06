import {
  adminErrorMessage,
  loginErrorMessage,
  type AdminIdentity,
  type AdminOrganization,
  type AdminPlayer,
  type AdminSession,
  type AdminTeam,
  type CompetitionPayload,
  type GamePayload,
  type PlayerPayload,
  type RosterPayload,
  type SeasonPayload,
  type TeamPayload,
  type TeamSeasonPayload,
} from "./admin";
import type {
  LeagueCompetition,
  LeagueGame,
  LeagueRosterEntry,
  LeagueSeason,
  LeagueTeamSeason,
} from "./types";

/**
 * Browser-only client for the public reads and the scoped `/admin` writes.
 * `NEXT_PUBLIC_API_URL` is inlined at build time; no server-only imports.
 */
const BASE = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001").replace(/\/$/, "");
const TIMEOUT_MS = 8000;

export function adminApiBase(): string {
  return BASE;
}

export class AdminApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "AdminApiError";
  }
}

interface RequestOptions {
  method?: "GET" | "POST";
  token?: string;
  body?: unknown;
  timeoutMs?: number;
}

function readJson(text: string): unknown {
  if (text.length === 0) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = { Accept: "application/json" };
  if (options.body !== undefined) headers["Content-Type"] = "application/json";
  if (options.token) headers.Authorization = `Bearer ${options.token}`;

  let response: Response;
  try {
    response = await fetch(`${BASE}${path}`, {
      method: options.method ?? "GET",
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      cache: "no-store",
      signal: AbortSignal.timeout(options.timeoutMs ?? TIMEOUT_MS),
    });
  } catch (error) {
    const timedOut =
      typeof DOMException !== "undefined" &&
      error instanceof DOMException &&
      error.name === "TimeoutError";
    throw new AdminApiError(
      0,
      timedOut
        ? "La API tardó demasiado en responder. Inténtalo de nuevo."
        : adminErrorMessage(0),
    );
  }

  const payload = readJson(await response.text());
  if (!response.ok) {
    throw new AdminApiError(response.status, adminErrorMessage(response.status));
  }
  return payload as T;
}

export function login(email: string, password: string): Promise<AdminSession> {
  return request<AdminSession>("/auth/login", {
    method: "POST",
    body: { email, password },
  }).catch((error: unknown) => {
    if (error instanceof AdminApiError && error.status === 401) {
      throw new AdminApiError(401, loginErrorMessage(401));
    }
    throw error;
  });
}

export function me(token: string): Promise<AdminIdentity> {
  return request<AdminIdentity>("/auth/me", { token });
}

export function logout(token: string): Promise<{ loggedOut: boolean }> {
  return request<{ loggedOut: boolean }>("/auth/logout", { method: "POST", token });
}

export function listOrganizations(): Promise<AdminOrganization[]> {
  return request<AdminOrganization[]>("/organizations");
}

export function listSeasons(organizationId: string): Promise<LeagueSeason[]> {
  return request<LeagueSeason[]>(
    `/seasons?organizationId=${encodeURIComponent(organizationId)}`,
  );
}

export function listCompetitions(seasonId: string): Promise<LeagueCompetition[]> {
  return request<LeagueCompetition[]>(`/seasons/${encodeURIComponent(seasonId)}/competitions`);
}

export function listTeamSeasons(competitionId: string): Promise<LeagueTeamSeason[]> {
  return request<LeagueTeamSeason[]>(
    `/competitions/${encodeURIComponent(competitionId)}/teams`,
  );
}

export function listGames(seasonId: string): Promise<LeagueGame[]> {
  return request<LeagueGame[]>(`/seasons/${encodeURIComponent(seasonId)}/games`);
}

export function createSeason(token: string, payload: SeasonPayload): Promise<LeagueSeason> {
  return request<LeagueSeason>("/admin/seasons", { method: "POST", token, body: payload });
}

export function createCompetition(
  token: string,
  payload: CompetitionPayload,
): Promise<LeagueCompetition> {
  return request<LeagueCompetition>("/admin/competitions", {
    method: "POST",
    token,
    body: payload,
  });
}

export function createTeam(token: string, payload: TeamPayload): Promise<AdminTeam> {
  return request<AdminTeam>("/admin/teams", { method: "POST", token, body: payload });
}

export function createTeamSeason(
  token: string,
  payload: TeamSeasonPayload,
): Promise<LeagueTeamSeason> {
  return request<LeagueTeamSeason>("/admin/team-seasons", {
    method: "POST",
    token,
    body: payload,
  });
}

export function createPlayer(token: string, payload: PlayerPayload): Promise<AdminPlayer> {
  return request<AdminPlayer>("/admin/players", { method: "POST", token, body: payload });
}

export function createRosterEntry(
  token: string,
  payload: RosterPayload,
): Promise<LeagueRosterEntry> {
  return request<LeagueRosterEntry>("/admin/roster-entries", {
    method: "POST",
    token,
    body: payload,
  });
}

export function createGame(token: string, payload: GamePayload): Promise<LeagueGame> {
  return request<LeagueGame>("/admin/games", { method: "POST", token, body: payload });
}
