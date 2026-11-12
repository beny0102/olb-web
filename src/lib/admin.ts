import type {
  GameStatus,
  LeagueCompetition,
  LeagueGame,
  LeagueRosterEntry,
  LeagueSeason,
  LeagueTeamSeason,
} from "./types";

/** `localStorage` key for the operator session. */
export const ADMIN_TOKEN_KEY = "olb.admin.token";

export type AdminRole =
  | "org_admin"
  | "competition_admin"
  | "team_admin"
  | "scorer"
  | "verifier"
  | "viewer";

export type AdminScopeType = "organization" | "competition" | "team_season";

export interface AdminUser {
  id: string;
  email: string;
  name: string;
  status: "active" | "disabled";
  createdAt: string;
}

export interface AdminMembership {
  id: string;
  userId: string;
  scopeType: AdminScopeType;
  scopeId: string;
  role: AdminRole;
  createdAt: string;
}

export interface AdminSession {
  token: string;
  user: AdminUser;
  memberships: AdminMembership[];
}

export interface AdminIdentity {
  user: AdminUser;
  memberships: AdminMembership[];
}

export interface AdminOrganization {
  id: string;
  name: string;
  slug: string;
  createdAt: string;
}

export interface AdminTeam {
  id: string;
  organizationId: string;
  name: string;
  slug: string;
  abbreviation: string | null;
  createdAt: string;
}

export interface AdminPlayer {
  id: string;
  organizationId: string;
  firstName: string;
  lastName: string;
  createdAt: string;
}

export interface SeasonFormValues {
  name: string;
  year: string;
  status: "active" | "archived";
}

export interface SeasonPayload {
  organizationId: string;
  name: string;
  year: number;
  status: "active" | "archived";
}

export interface CompetitionFormValues {
  seasonId: string;
  name: string;
  kind: "league" | "division";
}

export interface CompetitionPayload {
  seasonId: string;
  name: string;
  kind: "league" | "division";
}

export interface TeamFormValues {
  name: string;
  slug: string;
  abbreviation: string;
}

export interface TeamPayload {
  organizationId: string;
  name: string;
  slug: string;
  abbreviation: string | null;
}

export interface TeamSeasonFormValues {
  teamId: string;
  seasonId: string;
  competitionId: string;
  name: string;
  abbreviation: string;
}

export interface TeamSeasonPayload {
  teamId: string;
  seasonId: string;
  competitionId: string;
  name: string | null;
  abbreviation: string | null;
}

export interface PlayerFormValues {
  firstName: string;
  lastName: string;
}

export interface PlayerPayload {
  organizationId: string;
  firstName: string;
  lastName: string;
}

export interface RosterFormValues {
  teamSeasonId: string;
  playerId: string;
  jersey: string;
  primaryPosition: string;
}

export interface RosterPayload {
  teamSeasonId: string;
  playerId: string;
  jersey: string | null;
  primaryPosition: string | null;
}

export interface GameFormValues {
  seasonId: string;
  competitionId: string;
  homeTeamSeasonId: string;
  awayTeamSeasonId: string;
  scheduledStart: string;
  venue: string;
}

export interface GamePayload {
  seasonId: string;
  competitionId: string;
  homeTeamSeasonId: string;
  awayTeamSeasonId: string;
  scheduledStart: string | null;
  venue: string | null;
}

export interface GameRescheduleValues {
  scheduledStart: string;
  venue: string;
}

export interface GameReschedulePayload {
  scheduledStart: string | null;
  venue: string | null;
}

export interface SeasonUpdateValues {
  name: string;
  year: string;
  status: "active" | "archived";
  startsOn: string;
  endsOn: string;
}

export interface SeasonUpdatePayload {
  name: string;
  year: number;
  status: "active" | "archived";
  startsOn: string | null;
  endsOn: string | null;
}

export interface CompetitionUpdateValues {
  name: string;
  kind: "league" | "division";
  parentId: string;
  sortOrder: string;
}

export interface CompetitionUpdatePayload {
  name: string;
  kind: "league" | "division";
  parentId: string | null;
  sortOrder: number;
}

export interface TeamUpdateValues {
  name: string;
  slug: string;
  abbreviation: string;
}

export interface TeamUpdatePayload {
  name: string;
  slug: string;
  abbreviation: string | null;
}

export interface TeamSeasonUpdateValues {
  name: string;
  abbreviation: string;
  competitionId: string;
}

export interface TeamSeasonUpdatePayload {
  name: string;
  abbreviation: string | null;
  competitionId: string | null;
}

export interface PlayerUpdateValues {
  firstName: string;
  lastName: string;
}

export interface PlayerUpdatePayload {
  firstName: string;
  lastName: string;
}

export interface RosterUpdateValues {
  jersey: string;
  primaryPosition: string;
  eligibilityStart: string;
  eligibilityEnd: string;
  status: "active" | "inactive";
}

export interface RosterUpdatePayload {
  jersey: string | null;
  primaryPosition: string | null;
  eligibilityStart: string | null;
  eligibilityEnd: string | null;
  status: "active" | "inactive";
}

function optional(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

/** `datetime-local` has no zone; the browser interprets it as local time. */
export function toIsoTimestamp(value: string): string | null {
  const trimmed = value.trim();
  if (trimmed.length === 0) return null;
  const date = new Date(trimmed);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export function seasonPayload(values: SeasonFormValues, organizationId: string): SeasonPayload {
  return {
    organizationId,
    name: values.name.trim(),
    year: Number(values.year),
    status: values.status,
  };
}

export function competitionPayload(values: CompetitionFormValues): CompetitionPayload {
  return {
    seasonId: values.seasonId,
    name: values.name.trim(),
    kind: values.kind,
  };
}

export function teamPayload(values: TeamFormValues, organizationId: string): TeamPayload {
  return {
    organizationId,
    name: values.name.trim(),
    slug: values.slug.trim(),
    abbreviation: optional(values.abbreviation),
  };
}

export function teamSeasonPayload(values: TeamSeasonFormValues): TeamSeasonPayload {
  return {
    teamId: values.teamId,
    seasonId: values.seasonId,
    competitionId: values.competitionId,
    name: optional(values.name),
    abbreviation: optional(values.abbreviation),
  };
}

export function playerPayload(values: PlayerFormValues, organizationId: string): PlayerPayload {
  return {
    organizationId,
    firstName: values.firstName.trim(),
    lastName: values.lastName.trim(),
  };
}

export function rosterEntryPayload(values: RosterFormValues): RosterPayload {
  return {
    teamSeasonId: values.teamSeasonId,
    playerId: values.playerId,
    jersey: optional(values.jersey),
    primaryPosition: optional(values.primaryPosition),
  };
}

export function gamePayload(values: GameFormValues): GamePayload {
  return {
    seasonId: values.seasonId,
    competitionId: values.competitionId,
    homeTeamSeasonId: values.homeTeamSeasonId,
    awayTeamSeasonId: values.awayTeamSeasonId,
    scheduledStart: toIsoTimestamp(values.scheduledStart),
    venue: optional(values.venue),
  };
}

/** PATCH body for the reschedule action; only the two mutable display fields. */
export function gameReschedulePayload(values: GameRescheduleValues): GameReschedulePayload {
  return {
    scheduledStart: toIsoTimestamp(values.scheduledStart),
    venue: optional(values.venue),
  };
}

/** API date (`YYYY-MM-DD`) from a date input or an ISO timestamp. */
export function toIsoDate(value: string): string | null {
  const trimmed = value.trim();
  if (trimmed.length === 0) return null;
  const datePart = /^(\d{4}-\d{2}-\d{2})(?:[T\s].*)?$/.exec(trimmed);
  if (datePart) {
    const date = new Date(`${datePart[1]}T00:00:00Z`);
    return Number.isNaN(date.getTime()) ? null : datePart[1]!;
  }
  const date = new Date(trimmed);
  return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
}

export function seasonUpdatePayload(values: SeasonUpdateValues): SeasonUpdatePayload {
  return {
    name: values.name.trim(),
    year: Number(values.year),
    status: values.status,
    startsOn: toIsoDate(values.startsOn),
    endsOn: toIsoDate(values.endsOn),
  };
}

export function competitionUpdatePayload(
  values: CompetitionUpdateValues,
): CompetitionUpdatePayload {
  return {
    name: values.name.trim(),
    kind: values.kind,
    parentId: optional(values.parentId),
    sortOrder: Number(values.sortOrder),
  };
}

export function teamUpdatePayload(values: TeamUpdateValues): TeamUpdatePayload {
  return {
    name: values.name.trim(),
    slug: values.slug.trim(),
    abbreviation: optional(values.abbreviation),
  };
}

export function teamSeasonUpdatePayload(
  values: TeamSeasonUpdateValues,
): TeamSeasonUpdatePayload {
  return {
    name: values.name.trim(),
    abbreviation: optional(values.abbreviation),
    competitionId: optional(values.competitionId),
  };
}

export function playerUpdatePayload(values: PlayerUpdateValues): PlayerUpdatePayload {
  return {
    firstName: values.firstName.trim(),
    lastName: values.lastName.trim(),
  };
}

export function rosterUpdatePayload(values: RosterUpdateValues): RosterUpdatePayload {
  return {
    jersey: optional(values.jersey),
    primaryPosition: optional(values.primaryPosition),
    eligibilityStart: toIsoDate(values.eligibilityStart),
    eligibilityEnd: toIsoDate(values.eligibilityEnd),
    status: values.status,
  };
}

/** `<input type="datetime-local">` value in the operator's local timezone. */
export function toDateTimeLocalValue(value: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (part: number) => String(part).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

/** Spanish copy for a cancelled game that the API refuses to delete. */
export function gameDeleteErrorMessage(detail: string | null): string {
  if (detail === "game has events and cannot be deleted") {
    return "El juego ya tiene eventos registrados y no se puede cancelar.";
  }
  if (detail === "only a scheduled game can be deleted") {
    return "Solo se puede cancelar un juego programado.";
  }
  return "El juego no se puede cancelar porque ya tiene actividad registrada.";
}

/** Spanish copy for catalog deletes that the API refuses with `409`. */
export function catalogDeleteErrorMessage(detail: string | null): string {
  switch (detail) {
    case "season still has competitions, team seasons or games":
      return "No se puede borrar: la temporada todavía tiene competencias, inscripciones o juegos.";
    case "competition still has team seasons or games":
      return "No se puede borrar: la competencia todavía tiene equipos inscritos o juegos.";
    case "team still has team seasons":
      return "No se puede borrar: el equipo todavía está inscrito en una temporada.";
    case "team season still has games":
      return "No se puede borrar: la inscripción todavía tiene juegos programados.";
    case "player still has roster entries; use force=true":
      return "El jugador todavía tiene entradas de roster.";
    default:
      return "No se puede borrar: el registro todavía tiene datos asociados.";
  }
}

/** The player delete needs a second confirmation with `force=true`. */
export function playerDeleteNeedsForce(detail: string | null): boolean {
  return detail === "player still has roster entries; use force=true";
}

/**
 * Re-selecting the season that is already loaded is a no-op; clearing the
 * dependent lists would unmount the competition, team-season and game forms.
 */
export function shouldReloadSeason(currentId: string | null, nextId: string): boolean {
  return currentId !== nextId;
}

/** Memberships that grant catalog-wide admin inside one organization. */
export function orgAdminMemberships(memberships: AdminMembership[]): AdminMembership[] {
  return memberships.filter(
    (membership) =>
      membership.scopeType === "organization" && membership.role === "org_admin",
  );
}

/** Spanish copy for read failures and admin writes. The API speaks English. */
export function adminErrorMessage(status: number): string {
  switch (status) {
    case 0:
      return "No se pudo conectar con la API. Comprueba que esté en marcha.";
    case 400:
      return "La API rechazó los datos. Revisa los campos del formulario.";
    case 401:
      return "La sesión no es válida o ha caducado. Vuelve a iniciar sesión.";
    case 403:
      return "No tienes permiso para esta operación.";
    case 404:
      return "La referencia seleccionada ya no existe. Actualiza las listas.";
    case 409:
      return "Ya existe un registro con esos datos.";
    case 500:
      return "La API falló al guardar. Inténtalo de nuevo.";
    default:
      return `La API respondió con un error inesperado (${status}).`;
  }
}

export function loginErrorMessage(status: number): string {
  if (status === 401) return "Correo o contraseña incorrectos.";
  return adminErrorMessage(status);
}

const GAME_STATUS_LABELS: Record<GameStatus, string> = {
  scheduled: "Programado",
  live: "En vivo",
  final: "Final",
  suspended: "Suspendido",
  forfeit: "Cedido",
};

export function gameStatusLabel(status: GameStatus): string {
  return GAME_STATUS_LABELS[status];
}

/** Convenience view over the records the console keeps after each create. */
export interface AdminCatalog {
  seasons: LeagueSeason[];
  competitions: LeagueCompetition[];
  teamSeasons: LeagueTeamSeason[];
  games: LeagueGame[];
  teams: AdminTeam[];
  players: AdminPlayer[];
  rosterEntries: LeagueRosterEntry[];
}
