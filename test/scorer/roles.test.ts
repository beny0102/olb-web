import { describe, expect, it } from "vitest";
import type { Membership, Role } from "../../src/lib/scorer/auth";
import {
  hasScoringRole,
  primaryMembership,
  roleLabel,
  SCORING_ROLES,
} from "../../src/lib/scorer/roles";

function membership(role: Role, id: string = role): Membership {
  return {
    id,
    userId: "user-1",
    scopeType: "team_season",
    scopeId: "team-season-1",
    role,
    createdAt: "2026-01-01T00:00:00.000Z",
  };
}

describe("hasScoringRole", () => {
  it("accepts every role the API lets write scoring events", () => {
    expect(SCORING_ROLES).toEqual([
      "org_admin",
      "competition_admin",
      "team_admin",
      "scorer",
    ]);
    for (const role of SCORING_ROLES) {
      expect(hasScoringRole([membership(role)])).toBe(true);
    }
  });

  it("rejects a verifier-only or viewer-only account", () => {
    expect(hasScoringRole([membership("verifier")])).toBe(false);
    expect(hasScoringRole([membership("viewer")])).toBe(false);
    expect(hasScoringRole([])).toBe(false);
  });

  it("accepts an account with any scoring membership", () => {
    expect(
      hasScoringRole([membership("verifier"), membership("scorer", "scorer-1")]),
    ).toBe(true);
  });
});

describe("roleLabel", () => {
  it("labels every role in Spanish", () => {
    expect(roleLabel("org_admin")).toBe("Admin de liga");
    expect(roleLabel("competition_admin")).toBe("Admin de zona");
    expect(roleLabel("team_admin")).toBe("Admin de equipo");
    expect(roleLabel("scorer")).toBe("Anotador");
    expect(roleLabel("verifier")).toBe("Verificador");
    expect(roleLabel("viewer")).toBe("Espectador");
  });

  it("falls back when there is no membership", () => {
    expect(roleLabel(null)).toBe("Sin membresía");
    expect(roleLabel(undefined)).toBe("Sin membresía");
  });
});

describe("primaryMembership", () => {
  it("prefers scorer over every other role", () => {
    const picked = primaryMembership([
      membership("verifier"),
      membership("org_admin"),
      membership("scorer"),
    ]);
    expect(picked?.role).toBe("scorer");
  });

  it("orders team admin before the admins and verifier", () => {
    expect(
      primaryMembership([membership("verifier"), membership("org_admin"), membership("team_admin")])
        ?.role,
    ).toBe("team_admin");
    expect(
      primaryMembership([membership("verifier"), membership("competition_admin")])?.role,
    ).toBe("competition_admin");
    expect(primaryMembership([membership("verifier"), membership("org_admin")])?.role).toBe(
      "org_admin",
    );
    expect(primaryMembership([membership("viewer"), membership("verifier")])?.role).toBe(
      "verifier",
    );
  });

  it("returns null when the user has no membership", () => {
    expect(primaryMembership([])).toBeNull();
  });
});
