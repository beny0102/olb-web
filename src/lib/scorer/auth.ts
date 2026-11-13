import {
  login as loginRequest,
  logout as logoutRequest,
  me as meRequest,
} from "./api";

/**
 * Shared with the portal admin console: one login grants both surfaces.
 * The scorer's old key is only read to migrate an existing session.
 */
export const TOKEN_KEY = "olb.admin.token";
export const LEGACY_TOKEN_KEY = "olb.scorer.token";

export type UserStatus = "active" | "disabled";
export type ScopeType = "organization" | "competition" | "team_season";
export type Role =
  | "org_admin"
  | "competition_admin"
  | "team_admin"
  | "scorer"
  | "verifier"
  | "viewer";

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  status: UserStatus;
  createdAt: string;
}

export interface Membership {
  id: string;
  userId: string;
  scopeType: ScopeType;
  scopeId: string;
  role: Role;
  createdAt: string;
}

export interface AuthSession {
  token: string;
  user: AuthUser;
  memberships: Membership[];
}

export interface AuthMe {
  user: AuthUser;
  memberships: Membership[];
}

function storage(): Storage | null {
  try {
    return typeof globalThis.localStorage === "undefined"
      ? null
      : globalThis.localStorage;
  } catch {
    // Safari private mode and blocked storage throw on access.
    return null;
  }
}

/** The stored Bearer token, or null in a server render or a blocked storage. */
export function getToken(): string | null {
  try {
    const store = storage();
    if (!store) return null;

    const current = store.getItem(TOKEN_KEY);
    if (current) return current;

    // Migrate a session created before the scorer moved under /score.
    const legacy = store.getItem(LEGACY_TOKEN_KEY);
    if (legacy) {
      store.setItem(TOKEN_KEY, legacy);
      store.removeItem(LEGACY_TOKEN_KEY);
      return legacy;
    }

    return null;
  } catch {
    return null;
  }
}

export function setToken(token: string): void {
  try {
    const store = storage();
    store?.setItem(TOKEN_KEY, token);
    store?.removeItem(LEGACY_TOKEN_KEY);
  } catch {
    // The session still works for this tab when storage is unavailable.
  }
}

export function clearToken(): void {
  try {
    const store = storage();
    store?.removeItem(TOKEN_KEY);
    store?.removeItem(LEGACY_TOKEN_KEY);
  } catch {
    // Nothing to clear.
  }
}

export function authHeaders(): Record<string, string> {
  const token = getToken();
  return token ? { authorization: `Bearer ${token}` } : {};
}

/** Authenticates against the league API and keeps the token on this device. */
export async function login(email: string, password: string): Promise<AuthSession> {
  const session = await loginRequest({ email, password });
  setToken(session.token);
  return session;
}

/** Re-reads the current session; a 401 has already cleared the token. */
export function me(): Promise<AuthMe> {
  return meRequest();
}

/** Revokes the session when possible and always forgets the local token. */
export async function logout(): Promise<void> {
  try {
    if (getToken()) await logoutRequest();
  } finally {
    clearToken();
  }
}
