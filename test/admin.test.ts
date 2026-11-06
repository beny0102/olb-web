import { describe, expect, it } from "vitest";
import {
  adminErrorMessage,
  competitionPayload,
  gamePayload,
  gameStatusLabel,
  loginErrorMessage,
  orgAdminMemberships,
  playerPayload,
  rosterEntryPayload,
  seasonPayload,
  teamPayload,
  teamSeasonPayload,
  toIsoTimestamp,
  type AdminMembership,
} from "@/lib/admin";

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

describe("game status labels", () => {
  it("renders API statuses in Spanish", () => {
    expect(gameStatusLabel("scheduled")).toBe("Programado");
    expect(gameStatusLabel("live")).toBe("En vivo");
    expect(gameStatusLabel("final")).toBe("Final");
    expect(gameStatusLabel("suspended")).toBe("Suspendido");
    expect(gameStatusLabel("forfeit")).toBe("Cedido");
  });
});
