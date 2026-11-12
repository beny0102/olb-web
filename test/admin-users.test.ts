import { afterEach, describe, expect, it, vi } from "vitest";
import {
  USER_PASSWORD_MIN_LENGTH,
  adminUsersErrorMessage,
  createMembership,
  createUser,
  createUserPayload,
  deleteMembership,
  listMemberships,
  listUsers,
  membershipPayload,
  membershipScopeLabel,
  mergeMemberships,
  mergeUsers,
  resetUserPassword,
  roleLabel,
  scopeTypeLabel,
  teamSeasonScopeLabel,
  updateUserStatus,
  userStatusLabel,
  validateMembershipForm,
  validatePassword,
  validateUserForm,
  type MembershipDraft,
} from "@/lib/admin-users";
import { AdminApiError } from "@/lib/admin-api";

const TOKEN = "token-123";
const USER_ID = "0192f3d0-0000-7000-8002-000000000001";
const SCOPE_ID = "0192f3d0-0000-7000-8002-000000000002";
const MEMBERSHIP_ID = "0192f3d0-0000-7000-8002-000000000003";

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function mockFetch(handler: (url: string, init: RequestInit) => Response) {
  const fetchMock = vi.fn().mockImplementation(async (url: string, init: RequestInit) =>
    handler(url, init),
  );
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("user payloads", () => {
  it("trims fields and omits memberships when none are selected", () => {
    expect(
      createUserPayload({ name: " Ana Pérez ", email: " ana@liga.olb ", password: "abcdefghij" }),
    ).toEqual({ name: "Ana Pérez", email: "ana@liga.olb", password: "abcdefghij" });
  });

  it("includes initial memberships with scope and role", () => {
    const drafts: MembershipDraft[] = [
      { scopeType: "organization", scopeId: SCOPE_ID, role: "org_admin" },
    ];

    expect(
      createUserPayload(
        { name: "Ana", email: "ana@liga.olb", password: "abcdefghij" },
        drafts,
      ),
    ).toEqual({
      name: "Ana",
      email: "ana@liga.olb",
      password: "abcdefghij",
      memberships: drafts,
    });
  });

  it("maps a membership form to the API body", () => {
    expect(
      membershipPayload({
        userId: USER_ID,
        scopeType: "team_season",
        scopeId: SCOPE_ID,
        role: "scorer",
      }),
    ).toEqual({
      userId: USER_ID,
      scopeType: "team_season",
      scopeId: SCOPE_ID,
      role: "scorer",
    });
  });
});

describe("user validation", () => {
  it("requires name, email and a password of at least ten characters", () => {
    const errors = validateUserForm({ name: " ", email: "nope", password: "short" });
    expect(errors.name).toBeDefined();
    expect(errors.email).toBeDefined();
    expect(errors.password).toContain(String(USER_PASSWORD_MIN_LENGTH));
  });

  it("accepts a complete form and the API's basic email shape", () => {
    expect(
      validateUserForm({ name: "Ana", email: "ana@liga.olb", password: "abcdefghij" }),
    ).toEqual({});
    expect(
      validateUserForm({ name: "Ana", email: "ana@liga", password: "abcdefghij" }),
    ).toEqual({});
  });

  it("checks password length on its own", () => {
    expect(validatePassword("123456789")).toContain("10");
    expect(validatePassword("1234567890")).toBeNull();
  });

  it("requires a user, scope and role for a membership", () => {
    expect(
      validateMembershipForm({
        userId: "",
        scopeType: "competition",
        scopeId: "",
        role: "viewer",
      }),
    ).toMatchObject({ userId: expect.any(String), scopeId: expect.any(String) });
  });
});

describe("scope and role labels", () => {
  const names = {
    organizations: { [SCOPE_ID]: "Liga Metropolitana" },
    competitions: { [SCOPE_ID]: "Zona Norte" },
    teamSeasons: { [SCOPE_ID]: "Tiburones · Zona Norte" },
  };

  it("resolves the name of each scope type", () => {
    expect(
      membershipScopeLabel({ scopeType: "organization", scopeId: SCOPE_ID }, names),
    ).toBe("Liga Metropolitana");
    expect(
      membershipScopeLabel({ scopeType: "competition", scopeId: SCOPE_ID }, names),
    ).toBe("Zona Norte");
    expect(
      membershipScopeLabel({ scopeType: "team_season", scopeId: SCOPE_ID }, names),
    ).toBe("Tiburones · Zona Norte");
  });

  it("falls back to the id when the scope is not loaded", () => {
    expect(
      membershipScopeLabel(
        { scopeType: "competition", scopeId: "missing" },
        names,
      ),
    ).toBe("missing");
  });

  it("builds a readable team-season label", () => {
    expect(
      teamSeasonScopeLabel({
        teamName: "Tiburones",
        competitionName: "Zona Norte",
        name: "Tiburones",
      }),
    ).toBe("Tiburones · Zona Norte");
    expect(
      teamSeasonScopeLabel({ teamName: "", competitionName: null, name: "Tiburones" }),
    ).toBe("Tiburones");
  });

  it("renders roles and statuses in Spanish", () => {
    expect(roleLabel("org_admin")).toContain("organización");
    expect(roleLabel("scorer")).toBe("Anotador");
    expect(scopeTypeLabel("team_season")).toBe("Equipo en temporada");
    expect(userStatusLabel("active")).toBe("Activo");
    expect(userStatusLabel("disabled")).toBe("Deshabilitado");
  });
});

describe("local list merging", () => {
  it("keeps a user created without memberships when the API list omits it", () => {
    const orphan = {
      id: USER_ID,
      email: "sin@liga.olb",
      name: "Sin Membresía",
      status: "active" as const,
      createdAt: "",
    };
    expect(mergeUsers([orphan], [])).toEqual([orphan]);
  });

  it("deduplicates memberships by id and prefers the incoming row", () => {
    const base = {
      id: MEMBERSHIP_ID,
      userId: USER_ID,
      scopeType: "organization" as const,
      scopeId: SCOPE_ID,
      role: "viewer" as const,
      createdAt: "",
    };
    const updated = { ...base, role: "scorer" as const };
    expect(mergeMemberships([base], [updated])).toEqual([updated]);
  });
});

describe("user error mapping", () => {
  it("keeps 401, 403, 404 and 409 in Spanish", () => {
    expect(adminUsersErrorMessage(401)).toContain("sesión");
    expect(adminUsersErrorMessage(403)).toContain("permiso");
    expect(adminUsersErrorMessage(404)).toContain("ya no existe");
    expect(adminUsersErrorMessage(409)).toContain("conflicto");
    expect(adminUsersErrorMessage(0)).toContain("API");
  });

  it("uses a contextual conflict message per action", () => {
    expect(adminUsersErrorMessage(409, "create-user")).toContain("correo");
    expect(adminUsersErrorMessage(409, "update-user")).toContain("propia cuenta");
    expect(adminUsersErrorMessage(409, "create-membership")).toContain("ya existe");
    expect(adminUsersErrorMessage(409, "delete-membership")).toContain("última");
  });
});

describe("users API client", () => {
  it("lists users with the bearer token", async () => {
    const fetchMock = mockFetch(() =>
      jsonResponse(200, [
        { id: USER_ID, email: "ana@liga.olb", name: "Ana", status: "active", createdAt: "" },
      ]),
    );

    const rows = await listUsers(TOKEN);

    expect(rows).toHaveLength(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/admin/users");
    expect(init.headers).toMatchObject({ Authorization: `Bearer ${TOKEN}` });
  });

  it("creates a user with optional memberships", async () => {
    const fetchMock = mockFetch(() =>
      jsonResponse(201, {
        user: { id: USER_ID, email: "ana@liga.olb", name: "Ana", status: "active" },
        memberships: [],
      }),
    );

    await createUser(TOKEN, {
      name: "Ana",
      email: "ana@liga.olb",
      password: "abcdefghij",
      memberships: [],
    });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.method).toBe("POST");
    expect(init.body).toBe(
      JSON.stringify({
        name: "Ana",
        email: "ana@liga.olb",
        password: "abcdefghij",
        memberships: [],
      }),
    );
  });

  it("disables and enables a user", async () => {
    const fetchMock = mockFetch((_url, init) =>
      jsonResponse(200, {
        id: USER_ID,
        email: "ana@liga.olb",
        name: "Ana",
        status: init.body === JSON.stringify({ status: "disabled" }) ? "disabled" : "active",
      }),
    );

    const disabled = await updateUserStatus(TOKEN, USER_ID, "disabled");
    const enabled = await updateUserStatus(TOKEN, USER_ID, "active");

    expect(disabled.status).toBe("disabled");
    expect(enabled.status).toBe("active");
    const calls = fetchMock.mock.calls as [string, RequestInit][];
    expect(calls[0]?.[1].method).toBe("PATCH");
    expect(calls[0]?.[1].body).toBe(JSON.stringify({ status: "disabled" }));
    expect(calls[1]?.[1].body).toBe(JSON.stringify({ status: "active" }));
  });

  it("resets a password and reports the revoked sessions", async () => {
    const fetchMock = mockFetch(() =>
      jsonResponse(200, { updated: true, sessionsRevoked: 2 }),
    );

    const result = await resetUserPassword(TOKEN, USER_ID, "abcdefghij");

    expect(result.sessionsRevoked).toBe(2);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain(`/admin/users/${USER_ID}/password`);
    expect(init.body).toBe(JSON.stringify({ password: "abcdefghij" }));
  });

  it("lists, adds and removes memberships", async () => {
    const fetchMock = mockFetch((url, init) => {
      if (init.method === "DELETE") return jsonResponse(200, { deleted: true });
      if (init.method === "POST") {
        return jsonResponse(201, {
          id: MEMBERSHIP_ID,
          userId: USER_ID,
          scopeType: "team_season",
          scopeId: SCOPE_ID,
          role: "scorer",
          createdAt: "",
        });
      }
      return jsonResponse(200, []);
    });

    expect(await listMemberships(TOKEN)).toEqual([]);
    const created = await createMembership(TOKEN, {
      userId: USER_ID,
      scopeType: "team_season",
      scopeId: SCOPE_ID,
      role: "scorer",
    });
    expect(created.id).toBe(MEMBERSHIP_ID);
    expect(await deleteMembership(TOKEN, MEMBERSHIP_ID)).toEqual({ deleted: true });

    const calls = fetchMock.mock.calls as [string, RequestInit][];
    expect(calls[1]?.[1].method).toBe("POST");
    expect(calls[2]?.[0]).toContain(`/admin/memberships/${MEMBERSHIP_ID}`);
    expect(calls[2]?.[1].method).toBe("DELETE");
  });

  it.each([401, 403, 404, 409])("maps a %i response to AdminApiError", async (status) => {
    mockFetch(() => jsonResponse(status, { statusCode: status, message: "api detail" }));

    const error = await listUsers(TOKEN).catch((reason: unknown) => reason);
    expect(error).toBeInstanceOf(AdminApiError);
    expect((error as AdminApiError).status).toBe(status);
    expect((error as AdminApiError).detail).toBe("api detail");
    expect((error as AdminApiError).message).toBe(adminUsersErrorMessage(status, "read"));
  });

  it("maps a membership conflict with its action-specific message", async () => {
    mockFetch(() =>
      jsonResponse(409, { statusCode: 409, message: "duplicate membership" }),
    );

    await expect(
      createMembership(TOKEN, {
        userId: USER_ID,
        scopeType: "organization",
        scopeId: SCOPE_ID,
        role: "viewer",
      }),
    ).rejects.toMatchObject({
      status: 409,
      message: adminUsersErrorMessage(409, "create-membership"),
    });
  });
});
