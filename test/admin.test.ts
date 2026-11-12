import { afterEach, describe, expect, it, vi } from "vitest";
import {
  adminErrorMessage,
  competitionPayload,
  gameDeleteErrorMessage,
  gamePayload,
  gameReschedulePayload,
  gameStatusLabel,
  loginErrorMessage,
  orgAdminMemberships,
  playerPayload,
  rosterEntryPayload,
  seasonPayload,
  shouldReloadSeason,
  teamPayload,
  teamSeasonPayload,
  toDateTimeLocalValue,
  toIsoTimestamp,
  type AdminMembership,
} from "@/lib/admin";
import { AdminApiError, deleteGame, updateGame } from "@/lib/admin-api";

const ORG = "0192f3d0-0000-7000-8002-000000000001";

function membership(
  scopeType: AdminMembership["scopeType"],
  role: AdminMembership["role"],
): AdminMembership {
  return {
    id: "m1",
    userId: "u1",
    scopeType,
    scopeId: "scope-1",
    role,
    createdAt: "2026-01-01T00:00:00.000Z",
  };
}

describe("admin payload mapping", () => {
  it("maps a season form to the API body", () => {
    expect(
      seasonPayload(
        { name: "  Temporada 2027 ", year: "2027", status: "active" },
        ORG,
      ),
    ).toEqual({ organizationId: ORG, name: "Temporada 2027", year: 2027, status: "active" });
  });

  it("maps a competition form and keeps its kind", () => {
    expect(
      competitionPayload({
        seasonId: "season-1",
        name: " Liga Mayor ",
        kind: "division",
      }),
    ).toEqual({ seasonId: "season-1", name: "Liga Mayor", kind: "division" });
  });

  it("omits an empty team abbreviation as null", () => {
    expect(
      teamPayload({ name: " Halcones ", slug: " halcones ", abbreviation: "  " }, ORG),
    ).toEqual({
      organizationId: ORG,
      name: "Halcones",
      slug: "halcones",
      abbreviation: null,
    });
  });

  it("maps a team-season and defaults empty display fields to null", () => {
    expect(
      teamSeasonPayload({
        teamId: "team-1",
        seasonId: "season-1",
        competitionId: "competition-1",
        name: "   ",
        abbreviation: " HAL ",
      }),
    ).toEqual({
      teamId: "team-1",
      seasonId: "season-1",
      competitionId: "competition-1",
      name: null,
      abbreviation: "HAL",
    });
  });

  it("maps a player form", () => {
    expect(
      playerPayload({ firstName: " Ana ", lastName: " Pérez " }, ORG),
    ).toEqual({ organizationId: ORG, firstName: "Ana", lastName: "Pérez" });
  });

  it("maps a roster entry with optional jersey and position", () => {
    expect(
      rosterEntryPayload({
        teamSeasonId: "ts-1",
        playerId: "player-1",
        jersey: " 27 ",
        primaryPosition: " ",
      }),
    ).toEqual({
      teamSeasonId: "ts-1",
      playerId: "player-1",
      jersey: "27",
      primaryPosition: null,
    });
  });

  it("converts a local scheduled start to ISO and trims the venue", () => {
    const payload = gamePayload({
      seasonId: "season-1",
      competitionId: "competition-1",
      homeTeamSeasonId: "home-1",
      awayTeamSeasonId: "away-1",
      scheduledStart: "2027-04-10T18:00",
      venue: " Parque Central ",
    });

    expect(payload.seasonId).toBe("season-1");
    expect(payload.homeTeamSeasonId).toBe("home-1");
    expect(payload.awayTeamSeasonId).toBe("away-1");
    expect(payload.venue).toBe("Parque Central");
    expect(payload.scheduledStart).toBe(new Date("2027-04-10T18:00").toISOString());
  });

  it("leaves an empty schedule and venue as null", () => {
    expect(toIsoTimestamp("   ")).toBeNull();
    expect(
      gamePayload({
        seasonId: "season-1",
        competitionId: "competition-1",
        homeTeamSeasonId: "home-1",
        awayTeamSeasonId: "away-1",
        scheduledStart: "",
        venue: "",
      }),
    ).toEqual({
      seasonId: "season-1",
      competitionId: "competition-1",
      homeTeamSeasonId: "home-1",
      awayTeamSeasonId: "away-1",
      scheduledStart: null,
      venue: null,
    });
  });
});

describe("admin error messages", () => {
  it("keeps auth, permission and conflict cases in Spanish", () => {
    expect(adminErrorMessage(401)).toContain("sesión");
    expect(adminErrorMessage(403)).toContain("permiso");
    expect(adminErrorMessage(409)).toContain("Ya existe");
    expect(adminErrorMessage(400)).toContain("datos");
    expect(adminErrorMessage(0)).toContain("API");
  });

  it("falls back to the numeric status for an unknown error", () => {
    expect(adminErrorMessage(418)).toContain("418");
  });

  it("uses a clear login message for bad credentials", () => {
    expect(loginErrorMessage(401)).toBe("Correo o contraseña incorrectos.");
    expect(loginErrorMessage(500)).toBe(adminErrorMessage(500));
  });
});

describe("org admin selection", () => {
  it("keeps only organization org_admin memberships", () => {
    const rows = orgAdminMemberships([
      membership("organization", "org_admin"),
      membership("competition", "competition_admin"),
      membership("organization", "viewer"),
    ]);

    expect(rows).toHaveLength(1);
    expect(rows[0]?.role).toBe("org_admin");
    expect(rows[0]?.scopeType).toBe("organization");
  });
});

describe("season re-selection", () => {
  it("keeps the mounted forms when the same season is selected again", () => {
    expect(shouldReloadSeason("season-1", "season-1")).toBe(false);
  });

  it("reloads when the selection changes or starts empty", () => {
    expect(shouldReloadSeason("season-1", "season-2")).toBe(true);
    expect(shouldReloadSeason(null, "season-1")).toBe(true);
  });
});

describe("game reschedule payload", () => {
  it("sends only the mutable display fields", () => {
    const payload = gameReschedulePayload({
      scheduledStart: "2027-04-10T18:00",
      venue: " Parque Central ",
    });

    expect(payload).toEqual({
      scheduledStart: new Date("2027-04-10T18:00").toISOString(),
      venue: "Parque Central",
    });
  });

  it("round-trips an ISO timestamp into a datetime-local value with seconds", () => {
    const local = "2027-04-10T18:30:45";
    expect(toDateTimeLocalValue(new Date(local).toISOString())).toBe(local);
    expect(toDateTimeLocalValue(null)).toBe("");
    expect(toDateTimeLocalValue("not-a-date")).toBe("");
  });

  it("maps deletion conflicts to Spanish without leaking the API message", () => {
    expect(gameDeleteErrorMessage("game has events and cannot be deleted")).toContain("eventos");
    expect(gameDeleteErrorMessage("only a scheduled game can be deleted")).toContain(
      "programado",
    );
    expect(gameDeleteErrorMessage(null)).toContain("actividad");
  });
});

describe("game client actions", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("patches a game and returns the updated row", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ id: "game-1", status: "scheduled" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const row = await updateGame("token", "game-1", {
      scheduledStart: null,
      venue: "Parque Central",
    });

    expect(row).toMatchObject({ id: "game-1", status: "scheduled" });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/admin/games/game-1");
    expect(init.method).toBe("PATCH");
    expect(init.body).toBe(JSON.stringify({ scheduledStart: null, venue: "Parque Central" }));
  });

  it("maps a 409 on delete to the Spanish conflict message", async () => {
    const conflict = () =>
      new Response(
        JSON.stringify({
          statusCode: 409,
          message: "game has events and cannot be deleted",
          error: "Conflict",
        }),
        { status: 409, headers: { "Content-Type": "application/json" } },
      );
    vi.stubGlobal("fetch", vi.fn().mockImplementation(async () => conflict()));

    await expect(deleteGame("token", "game-1")).rejects.toMatchObject({
      status: 409,
      message: expect.stringContaining("eventos"),
    });
    await expect(deleteGame("token", "game-1")).rejects.toBeInstanceOf(AdminApiError);
  });
});

describe("game status labels", () => {
  it("renders API statuses in Spanish", () => {
    expect(gameStatusLabel("scheduled")).toBe("Programado");
    expect(gameStatusLabel("live")).toBe("En vivo");
    expect(gameStatusLabel("final")).toBe("Final");
    expect(gameStatusLabel("suspended")).toBe("Suspendido");
    expect(gameStatusLabel("forfeit")).toBe("Cedido");
  });
});
