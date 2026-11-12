import { AdminApiError, adminApiBase } from "./admin-api";
import {
  adminErrorMessage,
  type AdminMembership,
  type AdminRole,
  type AdminScopeType,
  type AdminUser,
} from "./admin";
import type { LeagueTeamSeason } from "./types";

/**
 * Browser-only client for the `/admin/users` and `/admin/memberships` routes.
 * Every call needs the operator token stored under `ADMIN_TOKEN_KEY`.
 */
const BASE = adminApiBase().replace(/\/$/, "");
const TIMEOUT_MS = 8000;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+$/;

export const USER_PASSWORD_MIN_LENGTH = 10;

export type UserAdminAction =
  | "read"
  | "create-user"
  | "update-user"
  | "set-password"
  | "create-membership"
  | "delete-membership";

export interface MembershipDraft {
  scopeType: AdminScopeType;
  scopeId: string;
  role: AdminRole;
}

export interface CreateUserPayload {
  name: string;
  email: string;
  password: string;
  memberships?: MembershipDraft[];
}

export interface CreateUserResponse {
  user: AdminUser;
  memberships: AdminMembership[];
}

export interface MembershipPayload extends MembershipDraft {
  userId: string;
}

export interface SetPasswordResponse {
  updated: true;
  sessionsRevoked: number;
}

export interface UserFormValues {
  name: string;
  email: string;
  password: string;
}

export interface UserFormErrors {
  name?: string;
  email?: string;
  password?: string;
}

export interface MembershipFormValues extends MembershipDraft {
  userId: string;
}

export interface MembershipFormErrors {
  userId?: string;
  scopeType?: string;
  scopeId?: string;
  role?: string;
}

export interface ScopeNames {
  organizations: Readonly<Record<string, string>>;
  competitions: Readonly<Record<string, string>>;
  teamSeasons: Readonly<Record<string, string>>;
}

export interface ScopeTypeOption {
  value: AdminScopeType;
  label: string;
}

export interface RoleOption {
  value: AdminRole;
  label: string;
}

export const SCOPE_TYPE_OPTIONS: readonly ScopeTypeOption[] = [
  { value: "organization", label: "Organización" },
  { value: "competition", label: "Competencia" },
  { value: "team_season", label: "Equipo en temporada" },
];

export const ROLE_OPTIONS: readonly RoleOption[] = [
  { value: "org_admin", label: "Admin. de organización" },
  { value: "competition_admin", label: "Admin. de competencia" },
  { value: "team_admin", label: "Admin. de equipo" },
  { value: "scorer", label: "Anotador" },
  { value: "verifier", label: "Verificador" },
  { value: "viewer", label: "Lector" },
];

const ROLE_LABELS: Record<AdminRole, string> = {
  org_admin: "Admin. de organización",
  competition_admin: "Admin. de competencia",
  team_admin: "Admin. de equipo",
  scorer: "Anotador",
  verifier: "Verificador",
  viewer: "Lector",
};

const SCOPE_TYPE_LABELS: Record<AdminScopeType, string> = {
  organization: "Organización",
  competition: "Competencia",
  team_season: "Equipo en temporada",
};

export function roleLabel(role: AdminRole): string {
  return ROLE_LABELS[role];
}

export function scopeTypeLabel(scopeType: AdminScopeType): string {
  return SCOPE_TYPE_LABELS[scopeType];
}

export function userStatusLabel(status: AdminUser["status"]): string {
  return status === "active" ? "Activo" : "Deshabilitado";
}

/** Readable label for a team season: `Tiburones · Zona Norte`. */
export function teamSeasonScopeLabel(
  teamSeason: Pick<LeagueTeamSeason, "teamName" | "competitionName" | "name">,
): string {
  const team = teamSeason.teamName || teamSeason.name;
  return [team, teamSeason.competitionName].filter(Boolean).join(" · ") || teamSeason.name;
}

export function membershipScopeLabel(
  membership: Pick<AdminMembership, "scopeType" | "scopeId">,
  names: ScopeNames,
): string {
  switch (membership.scopeType) {
    case "organization":
      return names.organizations[membership.scopeId] ?? membership.scopeId;
    case "competition":
      return names.competitions[membership.scopeId] ?? membership.scopeId;
    case "team_season":
      return names.teamSeasons[membership.scopeId] ?? membership.scopeId;
  }
}

/** Adds new users to the list without dropping accounts created without memberships. */
export function mergeUsers(current: readonly AdminUser[], incoming: readonly AdminUser[]): AdminUser[] {
  const byId = new Map<string, AdminUser>();
  for (const user of incoming) byId.set(user.id, user);
  for (const user of current) {
    if (!byId.has(user.id)) byId.set(user.id, user);
  }
  return [...byId.values()].sort(
    (a, b) => a.email.localeCompare(b.email) || a.id.localeCompare(b.id),
  );
}

export function mergeMemberships(
  current: readonly AdminMembership[],
  incoming: readonly AdminMembership[],
): AdminMembership[] {
  const byId = new Map<string, AdminMembership>();
  for (const membership of current) byId.set(membership.id, membership);
  for (const membership of incoming) byId.set(membership.id, membership);
  return [...byId.values()];
}

export function validatePassword(password: string): string | null {
  return password.length < USER_PASSWORD_MIN_LENGTH
    ? `La contraseña debe tener al menos ${USER_PASSWORD_MIN_LENGTH} caracteres.`
    : null;
}

export function validateUserForm(values: UserFormValues): UserFormErrors {
  const errors: UserFormErrors = {};
  if (values.name.trim().length === 0) {
    errors.name = "El nombre es obligatorio.";
  }

  const email = values.email.trim();
  if (email.length === 0) {
    errors.email = "El correo es obligatorio.";
  } else if (!EMAIL_PATTERN.test(email)) {
    errors.email = "Escribe un correo válido.";
  }

  const passwordError = validatePassword(values.password);
  if (passwordError) errors.password = passwordError;
  return errors;
}

export function validateMembershipForm(
  values: Pick<MembershipDraft, "scopeType" | "scopeId" | "role"> & { userId?: string },
): MembershipFormErrors {
  const errors: MembershipFormErrors = {};
  if (values.userId !== undefined && values.userId.trim().length === 0) {
    errors.userId = "Selecciona un usuario.";
  }
  if (!SCOPE_TYPE_OPTIONS.some((option) => option.value === values.scopeType)) {
    errors.scopeType = "Selecciona un tipo de ámbito.";
  }
  if (values.scopeId.trim().length === 0) {
    errors.scopeId = "Selecciona el ámbito de la membresía.";
  }
  if (!ROLE_OPTIONS.some((option) => option.value === values.role)) {
    errors.role = "Selecciona un rol.";
  }
  return errors;
}

export function createUserPayload(
  values: UserFormValues,
  memberships: readonly MembershipDraft[] = [],
): CreateUserPayload {
  const payload: CreateUserPayload = {
    name: values.name.trim(),
    email: values.email.trim(),
    password: values.password,
  };
  if (memberships.length > 0) {
    payload.memberships = memberships.map((membership) => ({
      scopeType: membership.scopeType,
      scopeId: membership.scopeId,
      role: membership.role,
    }));
  }
  return payload;
}

export function membershipPayload(values: MembershipFormValues): MembershipPayload {
  return {
    userId: values.userId,
    scopeType: values.scopeType,
    scopeId: values.scopeId,
    role: values.role,
  };
}

/** Spanish copy for user administration failures. The API speaks English. */
export function adminUsersErrorMessage(
  status: number,
  action: UserAdminAction = "read",
): string {
  switch (status) {
    case 0:
      return "No se pudo conectar con la API. Comprueba que esté en marcha.";
    case 400:
      return "La API rechazó los datos. Revisa el formulario.";
    case 401:
      return "La sesión no es válida o ha caducado. Vuelve a iniciar sesión en la consola.";
    case 403:
      return "No tienes permiso para administrar usuarios.";
    case 404:
      return "El usuario o la referencia ya no existe. Actualiza las listas.";
    case 409:
      switch (action) {
        case "create-user":
          return "Ya existe un usuario con ese correo.";
        case "update-user":
          return "No se pudo cambiar el estado. Un administrador no puede deshabilitar su propia cuenta.";
        case "create-membership":
          return "Ese rol ya existe en el ámbito seleccionado.";
        case "delete-membership":
          return "No puedes quitar la última membresía de administración de la organización.";
        default:
          return "La operación entra en conflicto con el estado actual.";
      }
    default:
      return adminErrorMessage(status);
  }
}

interface RequestOptions {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  action?: UserAdminAction;
}

function readJson(text: string): unknown {
  if (text.length === 0) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

function apiMessage(payload: unknown): string | null {
  if (typeof payload !== "object" || payload === null) return null;
  const message = (payload as { message?: unknown }).message;
  if (typeof message === "string") return message;
  if (Array.isArray(message) && typeof message[0] === "string") return message[0];
  return null;
}

async function request<T>(
  path: string,
  token: string,
  options: RequestOptions = {},
): Promise<T> {
  const headers: Record<string, string> = {
    Accept: "application/json",
    Authorization: `Bearer ${token}`,
  };
  if (options.body !== undefined) headers["Content-Type"] = "application/json";

  let response: Response;
  try {
    response = await fetch(`${BASE}${path}`, {
      method: options.method ?? "GET",
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
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
        : adminUsersErrorMessage(0, options.action),
    );
  }

  const payload = readJson(await response.text());
  if (!response.ok) {
    throw new AdminApiError(
      response.status,
      adminUsersErrorMessage(response.status, options.action),
      apiMessage(payload),
    );
  }
  return payload as T;
}

export function listUsers(token: string): Promise<AdminUser[]> {
  return request<AdminUser[]>("/admin/users", token);
}

export function createUser(
  token: string,
  payload: CreateUserPayload,
): Promise<CreateUserResponse> {
  return request<CreateUserResponse>("/admin/users", token, {
    method: "POST",
    body: payload,
    action: "create-user",
  });
}

export function updateUserStatus(
  token: string,
  userId: string,
  status: AdminUser["status"],
): Promise<AdminUser> {
  return request<AdminUser>(`/admin/users/${encodeURIComponent(userId)}`, token, {
    method: "PATCH",
    body: { status },
    action: "update-user",
  });
}

export function resetUserPassword(
  token: string,
  userId: string,
  password: string,
): Promise<SetPasswordResponse> {
  return request<SetPasswordResponse>(
    `/admin/users/${encodeURIComponent(userId)}/password`,
    token,
    {
      method: "POST",
      body: { password },
      action: "set-password",
    },
  );
}

export function listMemberships(token: string): Promise<AdminMembership[]> {
  return request<AdminMembership[]>("/admin/memberships", token);
}

export function createMembership(
  token: string,
  payload: MembershipPayload,
): Promise<AdminMembership> {
  return request<AdminMembership>("/admin/memberships", token, {
    method: "POST",
    body: payload,
    action: "create-membership",
  });
}

export function deleteMembership(
  token: string,
  membershipId: string,
): Promise<{ deleted: true }> {
  return request<{ deleted: true }>(
    `/admin/memberships/${encodeURIComponent(membershipId)}`,
    token,
    { method: "DELETE", action: "delete-membership" },
  );
}
