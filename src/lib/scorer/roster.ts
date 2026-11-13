import type { RulesProfile } from "./rules";
import type { FieldingPosition, Lineup, RosterPlayer, TeamSide } from "./types";

/** The nine batting positions a roster is expected to cover. */
export const ROSTER_BATTING_POSITIONS = [
  "C",
  "1B",
  "2B",
  "3B",
  "SS",
  "LF",
  "CF",
  "RF",
] as const;

const POSITION_CODES: Record<string, FieldingPosition> = {
  P: "1",
  C: "2",
  "1B": "3",
  "2B": "4",
  "3B": "5",
  SS: "6",
  LF: "7",
  CF: "8",
  RF: "9",
  DH: "DH",
  PH: "PH",
  PR: "PR",
  "1": "1",
  "2": "2",
  "3": "3",
  "4": "4",
  "5": "5",
  "6": "6",
  "7": "7",
  "8": "8",
  "9": "9",
};

export interface RosterLineupResult {
  lineup: Lineup | null;
  error: string | null;
}

/** Normalizes a roster abbreviation (`C`, `SS`, `P`) to the contract code. */
export function fieldingPosition(position: string): FieldingPosition | null {
  return POSITION_CODES[position.trim().toUpperCase()] ?? null;
}

function eligible(roster: readonly RosterPlayer[]): RosterPlayer[] {
  return roster.filter(
    (player) => player.id.trim() !== "" && player.name.trim() !== "",
  );
}

export interface RosterLineupOptions {
  /**
   * When a roster does not declare a pitcher or every position, fill the holes
   * with unused players instead of failing. Auto-import uses this so a scout
   * roster without full position data still opens a playable lineup; the manual
   * "Cargar plantilla" button keeps the strict result.
   */
  fallback?: boolean;
}

/**
 * Fills nine batting slots from a team-season roster. With the DH rule the
 * pitcher stays out of the batting order; without it the pitcher bats ninth.
 * A roster that cannot cover every slot is an honest error, never a guess,
 * unless the caller explicitly asks for a fallback.
 */
export function rosterToLineup(
  roster: readonly RosterPlayer[],
  team: TeamSide,
  rules: RulesProfile,
  options: RosterLineupOptions = {},
): RosterLineupResult {
  const available = eligible(roster);

  if (available.length < 9) {
    return {
      lineup: null,
      error: "La plantilla no tiene 9 jugadores elegibles.",
    };
  }

  const pitcher =
    available.find((player) => fieldingPosition(player.position) === "1") ??
    (options.fallback ? available[0] : undefined);
  if (!pitcher) {
    return { lineup: null, error: "La plantilla no tiene pitcher." };
  }

  const positions = rules.dh
    ? [...ROSTER_BATTING_POSITIONS, "DH"]
    : [...ROSTER_BATTING_POSITIONS, "P"];
  const used = new Set<string>();
  const missing: string[] = [];
  const players: Lineup["players"] = [];

  for (const [index, code] of positions.entries()) {
    const wanted = fieldingPosition(code);
    const player =
      code === "P"
        ? pitcher
        : (available.find(
            (candidate) =>
              !used.has(candidate.id) &&
              fieldingPosition(candidate.position) === wanted,
          ) ??
          (options.fallback
            ? available.find((candidate) => !used.has(candidate.id))
            : undefined));

    if (!player) {
      missing.push(code);
      continue;
    }

    used.add(player.id);
    players.push({
      id: player.id,
      name: player.name,
      position: wanted ?? "DH",
      battingSlot: index + 1,
    });
  }

  if (missing.length > 0) {
    return {
      lineup: null,
      error: `La plantilla no tiene jugadores para: ${missing.join(", ")}.`,
    };
  }

  return {
    lineup: { team, players, pitcherId: pitcher.id },
    error: null,
  };
}
