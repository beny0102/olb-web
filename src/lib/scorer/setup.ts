import { parseEvent } from "@olb/contract";
import type { Event } from "@olb/contract/types";
import { gameStart, lineupSet } from "./events";
import type { Lineup, LocalGame, Player, TeamSide } from "./types";
import { uuid7 } from "./uuid7";

export interface SetupLineups {
  home: Lineup;
  away: Lineup;
}

const POSITIONS: Player["position"][] = ["1", "2", "3", "4", "5", "6", "7", "8", "9"];

/** Nine empty batting slots in default fielding positions. */
export function blankLineup(team: TeamSide): Lineup {
  const players: Player[] = POSITIONS.map((position, index) => ({
    id: uuid7(),
    name: "",
    position,
    battingSlot: index + 1,
  }));
  return { team, players, pitcherId: "" };
}

/**
 * The opening events of a game: the start followed by the visitor and home
 * lineups, in that order. Every event is validated against the contract before
 * it reaches the local log.
 */
export function buildStartEvents(
  game: LocalGame,
  lineups: SetupLineups,
  startSeq: number,
): Event[] {
  const events = [
    gameStart(game.id, startSeq, game.venue ? { venue: game.venue } : {}),
    lineupSet(game.id, startSeq + 1, lineups.away),
    lineupSet(game.id, startSeq + 2, lineups.home),
  ];
  return events.map((event) => parseEvent(event));
}

/** The two lineups for a game whose start event is already in the log. */
export function buildLineupEvents(
  game: LocalGame,
  lineups: SetupLineups,
  startSeq: number,
): Event[] {
  const events = [
    lineupSet(game.id, startSeq, lineups.away),
    lineupSet(game.id, startSeq + 1, lineups.home),
  ];
  return events.map((event) => parseEvent(event));
}
