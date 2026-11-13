import type { Event } from "@olb/contract/types";
import {
  ApiError,
  listGameEvents,
  prepareLeagueGame,
} from "./api";
import type { GameStore } from "./db";
import { localStore } from "./store";
import type { Lineup, LocalGame, TeamSide } from "./types";

export interface RecoveryResult {
  game: LocalGame;
  /** Server events this device did not have yet. Zero on a second reload. */
  imported: number;
}

function recoveryError(caught: unknown): ApiError {
  // ApiError messages are already Spanish; anything else is an unexpected
  // failure and gets a readable message instead of leaking an English one.
  if (caught instanceof ApiError) return caught;
  return new ApiError(0, "No pudimos recuperar el juego del servidor.");
}

/**
 * Rebuilds the two lineups from the `lineup.set` events and the roster names.
 * The fold ignores those events, so a device recovering a live game would
 * otherwise open the score screen without a batter or a pitcher.
 */
function lineupsFromEvents(
  events: readonly Event[],
  game: LocalGame,
): { home: Lineup | null; away: Lineup | null } {
  let home: Lineup | null = null;
  let away: Lineup | null = null;

  for (const event of events) {
    if (event.type !== "lineup.set") continue;
    const side: TeamSide = event.payload.team;
    const roster = game.rosters?.[side] ?? [];
    const players = event.payload.battingOrder.map((entry, index) => ({
      id: entry.player,
      name: roster.find((player) => player.id === entry.player)?.name ?? "Jugador",
      position: entry.position,
      battingSlot: index + 1,
    }));
    const lineup: Lineup = {
      team: side,
      players,
      pitcherId: event.payload.pitcher ?? "",
    };
    if (side === "home") home = lineup;
    else away = lineup;
  }

  return { home, away };
}

/**
 * Recovers one game from the server onto this device:
 *
 * - no local game: save the prepared record and import every server event;
 * - local game with an empty log: import every server event;
 * - local game with pending events: import nothing, because sync owns the
 *   order and recovery must never reorder the outbox.
 *
 * Importing is idempotent by event `id`, so calling it again imports zero.
 */
export async function recoverGame(
  gameId: string,
  store: GameStore = localStore(),
): Promise<RecoveryResult> {
  const local = await store.getGame(gameId);

  if (local) {
    const pending = await store.pendingEvents(gameId);
    if (pending.length > 0) return { game: local, imported: 0 };
  }

  let prepared: LocalGame;
  try {
    prepared = await prepareLeagueGame(gameId);
  } catch (caught) {
    throw recoveryError(caught);
  }

  let game: LocalGame = local
    ? { ...prepared, lineups: local.lineups }
    : prepared;
  await store.putGame(game);

  let remote: Event[];
  try {
    remote = await listGameEvents(gameId, 0);
  } catch (caught) {
    throw recoveryError(caught);
  }

  const imported = await store.importSyncedEvents(gameId, remote);

  const stored = (await store.listEvents(gameId)).map((entry) => entry.event);
  const rebuilt = lineupsFromEvents(stored, game);
  const lineups = {
    home: game.lineups.home ?? rebuilt.home,
    away: game.lineups.away ?? rebuilt.away,
  };

  if (lineups.home !== game.lineups.home || lineups.away !== game.lineups.away) {
    game = { ...game, lineups };
    await store.putGame(game);
  }

  return { game, imported };
}
