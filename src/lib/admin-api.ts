import {
  adminErrorMessage,
  gameDeleteErrorMessage,
  loginErrorMessage,
  type AdminIdentity,
  type AdminOrganization,
  type AdminPlayer,
  type AdminSession,
  type AdminTeam,
  type CompetitionPayload,
  type GamePayload,
  type GameReschedulePayload,
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
    /** Raw `message` from the API error body, when present. */
    readonly detail: string | null = null,
  ) {
    super(message);
    this.name = "AdminApiError";
  }
}

interface RequestOptions {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
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
    throw new AdminApiError(
      response.status,
      adminErrorMessage(response.status),
      apiMessage(payload),
    );
  }
  return payload as T;
}

function apiMessage(payload: unknown): string | null {
  if (typeof payload !== "object" || payload === null) return null;
  const message = (payload as { message?: unknown }).message;
  if (typeof message === "string") return message;
  if (Array.isArray(message) && typeof message[0] === "string") return message[0];
  return null;
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

export function updateGame(
  token: string,
  id: string,
  payload: GameReschedulePayload,
): Promise<LeagueGame> {
  return request<LeagueGame>(`/admin/games/${encodeURIComponent(id)}`, {
    method: "PATCH",
    token,
    body: payload,
  });
}

export async function deleteGame(token: string, id: string): Promise<{ deleted: true }> {
  try {
    return await request<{ deleted: true }>(`/admin/games/${encodeURIComponent(id)}`, {
      method: "DELETE",
      token,
    });
  } catch (error) {
    if (error instanceof AdminApiError && error.status === 409) {
      throw new AdminApiError(409, gameDeleteErrorMessage(error.detail), error.detail);
    }
    throw error;
  }
}
