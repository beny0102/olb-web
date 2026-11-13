"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { ApiError } from "@/lib/scorer/api";
import {
  clearToken,
  getToken,
  login as loginRequest,
  logout as logoutRequest,
  me,
  type AuthSession,
  type AuthUser,
  type Membership,
} from "@/lib/scorer/auth";

interface AuthContextValue {
  user: AuthUser | null;
  memberships: Membership[];
  loading: boolean;
  login: (email: string, password: string) => Promise<AuthSession>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!getToken()) {
      setUser(null);
      setMemberships([]);
      setLoading(false);
      return;
    }

    try {
      const session = await me();
      setUser(session.user);
      setMemberships(session.memberships);
    } catch (error) {
      // A 401 already cleared the token; a network failure keeps the session
      // on this device so offline scoring still works.
      if (error instanceof ApiError && error.status === 401) {
        clearToken();
        setUser(null);
        setMemberships([]);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    function expired(): void {
      setUser(null);
      setMemberships([]);
    }

    window.addEventListener("olb-auth-expired", expired);
    return () => window.removeEventListener("olb-auth-expired", expired);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const session = await loginRequest(email, password);
    setUser(session.user);
    setMemberships(session.memberships);
    setLoading(false);
    return session;
  }, []);

  const logout = useCallback(async () => {
    try {
      await logoutRequest();
    } catch {
      // The local token is already gone; a failed revoke must not trap the user.
    } finally {
      setUser(null);
      setMemberships([]);
    }
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ user, memberships, loading, login, logout, refresh }),
    [user, memberships, loading, login, logout, refresh],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth debe usarse dentro de AuthProvider.");
  }
  return context;
}
