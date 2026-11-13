import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchJson, login as apiLogin } from "../../src/lib/scorer/api";
import {
  LEGACY_TOKEN_KEY,
  TOKEN_KEY,
  authHeaders,
  clearToken,
  getToken,
  login,
  logout,
  me,
  setToken,
} from "../../src/lib/scorer/auth";

function memoryStorage(): Storage {
  const values = new Map<string, string>();
  return {
    get length() {
      return values.size;
    },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => [...values.keys()][index] ?? null,
    removeItem: (key) => {
      values.delete(key);
    },
    setItem: (key, value) => {
      values.set(key, value);
    },
  };
}

function response(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

const user = {
  id: "0192f3a2-0100-7000-8000-000000000001",
  email: "tiburones@liga-metropolitana.olb",
  name: "Tiburones",
  status: "active" as const,
  createdAt: "2026-11-04T15:00:00.000Z",
};

const membership = {
  id: "0192f3a2-0100-7000-8000-000000000002",
  userId: user.id,
  scopeType: "team_season" as const,
  scopeId: "0192f3a2-0100-7000-8000-000000000003",
  role: "scorer" as const,
  createdAt: "2026-11-04T15:00:00.000Z",
};

beforeEach(() => {
  vi.stubGlobal("localStorage", memoryStorage());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("token storage", () => {
  it("stores, reads and clears the scorer token", () => {
    expect(getToken()).toBeNull();
    setToken("token-1");
    expect(getToken()).toBe("token-1");
    expect(localStorage.getItem(TOKEN_KEY)).toBe("token-1");
    expect(authHeaders()).toEqual({ authorization: "Bearer token-1" });
    clearToken();
    expect(getToken()).toBeNull();
    expect(authHeaders()).toEqual({});
  });

  it("shares the portal admin token and migrates the legacy scorer token", () => {
    expect(TOKEN_KEY).toBe("olb.admin.token");

    localStorage.setItem(LEGACY_TOKEN_KEY, "legacy-token");
    expect(getToken()).toBe("legacy-token");
    expect(localStorage.getItem(TOKEN_KEY)).toBe("legacy-token");
    expect(localStorage.getItem(LEGACY_TOKEN_KEY)).toBeNull();

    clearToken();
    expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
    expect(localStorage.getItem(LEGACY_TOKEN_KEY)).toBeNull();
  });

  it("survives a storage that throws", () => {
    vi.stubGlobal("localStorage", {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
      removeItem: () => {
        throw new Error("blocked");
      },
    });

    expect(getToken()).toBeNull();
    expect(() => setToken("token")).not.toThrow();
    expect(() => clearToken()).not.toThrow();
    expect(authHeaders()).toEqual({});
  });
});

describe("login", () => {
  it("authenticates and keeps the token", async () => {
    const fetchMock = vi.fn(async () =>
      response({ token: "token-1", user, memberships: [membership] }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const session = await login("tiburones@liga-metropolitana.olb", "olb-demo-tiburones");

    expect(session.token).toBe("token-1");
    expect(getToken()).toBe("token-1");
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("http://localhost:3001/auth/login");
    expect(init.method).toBe("POST");
    expect(JSON.parse(String(init.body))).toEqual({
      email: "tiburones@liga-metropolitana.olb",
      password: "olb-demo-tiburones",
    });
  });

  it("maps a rejected password to a Spanish message and stores nothing", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => response({}, 401)));

    await expect(apiLogin({ email: "nadie@olb", password: "mala" })).rejects.toMatchObject({
      name: "ApiError",
      status: 401,
      message: "Correo o contraseña incorrectos.",
    });
    expect(getToken()).toBeNull();
  });
});

describe("session", () => {
  it("sends the stored Bearer token on me()", async () => {
    setToken("token-1");
    const fetchMock = vi.fn(async () => response({ user, memberships: [membership] }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(me()).resolves.toMatchObject({ user, memberships: [membership] });

    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(init.headers).toMatchObject({ authorization: "Bearer token-1" });
  });

  it("clears the token and notifies the app on a 401", async () => {
    setToken("token-1");
    const dispatchEvent = vi.fn();
    vi.stubGlobal("window", {
      location: { hostname: "localhost" },
      dispatchEvent,
    });
    vi.stubGlobal("fetch", vi.fn(async () => response({}, 401)));

    await expect(fetchJson("/auth/me")).rejects.toMatchObject({ status: 401 });

    expect(getToken()).toBeNull();
    expect(dispatchEvent).toHaveBeenCalledTimes(1);
    expect(dispatchEvent.mock.calls[0]?.[0]).toMatchObject({
      type: "olb-auth-expired",
    });
  });
});

describe("logout", () => {
  it("revokes the session and always forgets the token", async () => {
    setToken("token-1");
    const fetchMock = vi.fn(async () => response({ loggedOut: true }));
    vi.stubGlobal("fetch", fetchMock);

    await logout();

    expect(getToken()).toBeNull();
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("http://localhost:3001/auth/logout");
    expect(init.method).toBe("POST");
  });

  it("forgets the token even when the API is unreachable", async () => {
    setToken("token-1");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("Failed to fetch");
      }),
    );

    await expect(logout()).rejects.toMatchObject({ name: "ApiError", status: 0 });
    expect(getToken()).toBeNull();
  });
});
