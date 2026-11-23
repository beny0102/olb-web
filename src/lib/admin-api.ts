import {
  adminErrorMessage,
  catalogDeleteErrorMessage,
  gameDeleteErrorMessage,
  loginErrorMessage,
  type AdminIdentity,
  type AdminOrganization,
  type AdminPlayer,
  type AdminSession,
  type AdminTeam,
  type CompetitionPayload,
  type CompetitionUpdatePayload,
  type GamePayload,
  type GameReschedulePayload,
  type PlayerConsent,
  type PlayerConsentPayload,
  type PlayerConsentView,
  type PlayerPayload,
  type PlayerUpdatePayload,
  type RosterPayload,
  type RosterUpdatePayload,
  type SeasonPayload,
  type SeasonUpdatePayload,
  type TeamPayload,
  type TeamSeasonPayload,
  type TeamSeasonUpdatePayload,
  type TeamUpdatePayload,
} from "./admin";
import type {
  LeagueCompetition,
  LeagueGame,
  LeagueRosterEntry,
  LeagueSeason,
  LeagueTeamSeason,
  LeagueTeamSeasonView,
} from "./types";
import {
  exportFileName,
  leagueBundleMetadata,
  type LeagueBundle,
  type LeagueImportResult,
  type RosterImportResult,
  type RosterImportRowPayload,
} from "./admin-transfer";

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
    /** Full API error body, used for import conflict lists. */
    readonly payload: unknown = null,
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
      payload,
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
      throw new AdminApiError(
        409,
        gameDeleteErrorMessage(error.detail),
        error.detail,
        error.payload,
      );
    }
    throw error;
  }
}

/** Organization-wide catalog reads, used by the edit/delete lists. */
export function listOrganizationTeams(
  token: string,
  organizationId: string,
): Promise<AdminTeam[]> {
  return request<AdminTeam[]>(
    `/admin/organizations/${encodeURIComponent(organizationId)}/teams`,
    { token },
  );
}

export function listOrganizationPlayers(
  token: string,
  organizationId: string,
): Promise<AdminPlayer[]> {
  return request<AdminPlayer[]>(
    `/admin/organizations/${encodeURIComponent(organizationId)}/players`,
    { token },
  );
}

/** Authenticated read with full player names for the admin console. */
export function getTeamSeason(
  token: string,
  id: string,
): Promise<LeagueTeamSeasonView> {
  return request<LeagueTeamSeasonView>(`/admin/team-seasons/${encodeURIComponent(id)}`, {
    token,
  });
}

export function updateSeason(
  token: string,
  id: string,
  payload: SeasonUpdatePayload,
): Promise<LeagueSeason> {
  return request<LeagueSeason>(`/admin/seasons/${encodeURIComponent(id)}`, {
    method: "PATCH",
    token,
    body: payload,
  });
}

export async function deleteSeason(token: string, id: string): Promise<{ deleted: true }> {
  return deleteCatalogRow<{ deleted: true }>(`/admin/seasons/${encodeURIComponent(id)}`, token);
}

export function updateCompetition(
  token: string,
  id: string,
  payload: CompetitionUpdatePayload,
): Promise<LeagueCompetition> {
  return request<LeagueCompetition>(`/admin/competitions/${encodeURIComponent(id)}`, {
    method: "PATCH",
    token,
    body: payload,
  });
}

export async function deleteCompetition(
  token: string,
  id: string,
): Promise<{ deleted: true }> {
  return deleteCatalogRow<{ deleted: true }>(`/admin/competitions/${encodeURIComponent(id)}`, token);
}

export function updateTeam(
  token: string,
  id: string,
  payload: TeamUpdatePayload,
): Promise<AdminTeam> {
  return request<AdminTeam>(`/admin/teams/${encodeURIComponent(id)}`, {
    method: "PATCH",
    token,
    body: payload,
  });
}

export async function deleteTeam(token: string, id: string): Promise<{ deleted: true }> {
  return deleteCatalogRow<{ deleted: true }>(`/admin/teams/${encodeURIComponent(id)}`, token);
}

export function updateTeamSeason(
  token: string,
  id: string,
  payload: TeamSeasonUpdatePayload,
): Promise<LeagueTeamSeason> {
  return request<LeagueTeamSeason>(`/admin/team-seasons/${encodeURIComponent(id)}`, {
    method: "PATCH",
    token,
    body: payload,
  });
}

export async function deleteTeamSeason(
  token: string,
  id: string,
): Promise<{ deleted: true }> {
  return deleteCatalogRow<{ deleted: true }>(`/admin/team-seasons/${encodeURIComponent(id)}`, token);
}

export function updatePlayer(
  token: string,
  id: string,
  payload: PlayerUpdatePayload,
): Promise<AdminPlayer> {
  return request<AdminPlayer>(`/admin/players/${encodeURIComponent(id)}`, {
    method: "PATCH",
    token,
    body: payload,
  });
}

export function getNameConsent(
  token: string,
  id: string,
): Promise<PlayerConsentView> {
  return request<PlayerConsentView>(
    `/admin/players/${encodeURIComponent(id)}/consent`,
    { token },
  );
}

export function grantNameConsent(
  token: string,
  id: string,
  payload: PlayerConsentPayload,
): Promise<PlayerConsent> {
  return request<PlayerConsent>(
    `/admin/players/${encodeURIComponent(id)}/consent`,
    { method: "POST", token, body: payload },
  );
}

export function revokeNameConsent(
  token: string,
  id: string,
): Promise<{ playerId: string; namePublic: false; revoked: number }> {
  return request<{ playerId: string; namePublic: false; revoked: number }>(
    `/admin/players/${encodeURIComponent(id)}/consent`,
    { method: "DELETE", token },
  );
}

export interface DeletePlayerResponse {
  deleted: true;
  rosterEntriesDeleted: number;
}

export async function deletePlayer(
  token: string,
  id: string,
  force = false,
): Promise<DeletePlayerResponse> {
  const query = force ? "?force=true" : "";
  return deleteCatalogRow<DeletePlayerResponse>(`/admin/players/${encodeURIComponent(id)}${query}`, token);
}

export function updateRosterEntry(
  token: string,
  id: string,
  payload: RosterUpdatePayload,
): Promise<LeagueRosterEntry> {
  return request<LeagueRosterEntry>(`/admin/roster-entries/${encodeURIComponent(id)}`, {
    method: "PATCH",
    token,
    body: payload,
  });
}

export async function deleteRosterEntry(
  token: string,
  id: string,
): Promise<{ deleted: true }> {
  return deleteCatalogRow<{ deleted: true }>(`/admin/roster-entries/${encodeURIComponent(id)}`, token);
}

async function deleteCatalogRow<T>(
  path: string,
  token: string,
): Promise<T> {
  try {
    return await request<T>(path, { method: "DELETE", token });
  } catch (error) {
    if (error instanceof AdminApiError && error.status === 409) {
      throw new AdminApiError(
        409,
        catalogDeleteErrorMessage(error.detail),
        error.detail,
        error.payload,
      );
    }
    throw error;
  }
}

export interface LeagueExport {
  fileName: string;
  bundle: LeagueBundle;
  content: string;
  bytes: number;
}

/**
 * Raw fetch for the export download: unlike `request`, it keeps the body text
 * and the `Content-Disposition` header.
 */
export async function exportLeague(
  token: string,
  seasonId?: string | null,
): Promise<LeagueExport> {
  const query = seasonId ? `?seasonId=${encodeURIComponent(seasonId)}` : "";

  let response: Response;
  try {
    response = await fetch(`${BASE}/admin/export${query}`, {
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
      signal: AbortSignal.timeout(TIMEOUT_MS),
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

  const content = await response.text();
  const payload = readJson(content);
  if (!response.ok) {
    throw new AdminApiError(
      response.status,
      adminErrorMessage(response.status),
      apiMessage(payload),
      payload,
    );
  }

  const bundle = (payload ?? {}) as LeagueBundle;
  const metadata = leagueBundleMetadata(payload);
  return {
    fileName: exportFileName(
      response.headers.get("Content-Disposition"),
      metadata.organizationSlug,
    ),
    bundle,
    content,
    bytes: new TextEncoder().encode(content).length,
  };
}

/** Sends the bundle itself as the body, exactly as the API expects it. */
export function importLeague(
  token: string,
  bundle: LeagueBundle,
  dryRun: boolean,
): Promise<LeagueImportResult> {
  return request<LeagueImportResult>(
    `/admin/import?dryRun=${dryRun ? "true" : "false"}`,
    { method: "POST", token, body: bundle },
  );
}

export function importRoster(
  token: string,
  teamSeasonId: string,
  rows: RosterImportRowPayload[],
  dryRun: boolean,
): Promise<RosterImportResult> {
  return request<RosterImportResult>(
    `/admin/team-seasons/${encodeURIComponent(teamSeasonId)}/roster-import`,
    { method: "POST", token, body: { rows, dryRun } },
  );
}
