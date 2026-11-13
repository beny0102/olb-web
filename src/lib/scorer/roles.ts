import type { Membership, Role } from "./auth";

/** Roles the API accepts as authors of scoring events. */
export const SCORING_ROLES = [
  "org_admin",
  "competition_admin",
  "team_admin",
  "scorer",
] as const;

export type ScoringRole = (typeof SCORING_ROLES)[number];

const ROLE_LABELS: Record<Role, string> = {
  org_admin: "Admin de liga",
  competition_admin: "Admin de zona",
  team_admin: "Admin de equipo",
  scorer: "Anotador",
  verifier: "Verificador",
  viewer: "Espectador",
};

/** Badge order: the most specific scoring role wins, then the read-only ones. */
const PRIMARY_ORDER: readonly Role[] = [
  "scorer",
  "team_admin",
  "competition_admin",
  "org_admin",
  "verifier",
  "viewer",
];

export function isScoringRole(role: Role): role is ScoringRole {
  return (SCORING_ROLES as readonly Role[]).includes(role);
}

/** Whether any membership lets this user write scoring events. */
export function hasScoringRole(memberships: readonly Membership[]): boolean {
  return memberships.some((membership) => isScoringRole(membership.role));
}

/** The Spanish label for a role, shared with the session badge. */
export function roleLabel(role: Role | null | undefined): string {
  return role ? ROLE_LABELS[role] : "Sin membresía";
}

/** The membership that best represents the user's role on screen. */
export function primaryMembership(
  memberships: readonly Membership[],
): Membership | null {
  for (const role of PRIMARY_ORDER) {
    const found = memberships.find((membership) => membership.role === role);
    if (found) return found;
  }
  return memberships[0] ?? null;
}
