import { validateLineup } from "./lineup";
import type { RulesProfile } from "./rules";
import type { Lineup, LocalGame, RosterPlayer, TeamSide } from "./types";

/** Names the old blank-lineup flow left behind, e.g. "Jugador 4". */
const PLACEHOLDER_NAME = /^Jugador \d+$/;

export interface StartCheck {
  ok: boolean;
  errors: string[];
}

function teamName(game: Pick<LocalGame, "homeTeam" | "awayTeam">, side: TeamSide): string {
  return side === "home" ? game.homeTeam : game.awayTeam;
}

function eligiblePlayers(roster: readonly RosterPlayer[] | undefined): RosterPlayer[] {
  return (roster ?? []).filter(
    (player) => player.id.trim() !== "" && player.name.trim() !== "",
  );
}

/**
 * Roster reasons a game cannot start. The API only returns active players, so
 * a local roster with fewer than nine is a missing preparation, not a choice.
 */
export function rosterStartErrors(
  game: Pick<LocalGame, "homeTeam" | "awayTeam" | "rosters">,
): string[] {
  const errors: string[] = [];
  for (const side of ["away", "home"] as const) {
    if (eligiblePlayers(game.rosters?.[side]).length < 9) {
      errors.push(
        `Falta la plantilla de ${teamName(game, side)}; prepara el juego desde el calendario.`,
      );
    }
  }
  return errors;
}

/**
 * Lineup reasons a game cannot start. Besides `validateLineup`, this rejects an
 * empty lineup and the placeholder names older local records may still carry.
 */
export function lineupStartErrors(
  lineup: Lineup | null,
  team: string,
  rules: RulesProfile,
): string[] {
  if (!lineup || lineup.players.length === 0) {
    return [`Falta la alineación de ${team}.`];
  }

  const errors = validateLineup(lineup, rules);
  if (
    lineup.players.some((player) => PLACEHOLDER_NAME.test(player.name.trim()))
  ) {
    errors.push(
      `La alineación de ${team} todavía tiene nombres de relleno («Jugador N»).`,
    );
  }
  return errors;
}

/** Pure start guard: rosters first, then both lineups under the rules profile. */
export function canStartGame(
  game: Pick<LocalGame, "homeTeam" | "awayTeam" | "rosters">,
  lineups: { home: Lineup | null; away: Lineup | null },
  rules: RulesProfile,
): StartCheck {
  const errors = [
    ...rosterStartErrors(game),
    ...lineupStartErrors(lineups.away, game.awayTeam, rules),
    ...lineupStartErrors(lineups.home, game.homeTeam, rules),
  ];
  return { ok: errors.length === 0, errors };
}
