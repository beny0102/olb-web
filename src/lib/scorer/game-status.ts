import { foldStored } from "./db";
import type { ApiState } from "./api";
import type { LocalGame, StoredEvent } from "./types";

export type LocalGameStatus = "Sin lineup" | "Listo" | "En curso" | "Final";

function hasBothLineups(game: LocalGame): boolean {
  return game.lineups.home !== null && game.lineups.away !== null;
}

/** The status a local game shows on the home list, from its log. */
export function localGameStatus(
  game: LocalGame,
  events: readonly StoredEvent[],
): LocalGameStatus {
  if (events.length > 0) {
    const state = foldStored([...events]);
    if (state.status === "live") return "En curso";
    if (
      state.status === "final" ||
      state.status === "forfeit" ||
      state.status === "suspended"
    ) {
      return "Final";
    }
  }
  return hasBothLineups(game) ? "Listo" : "Sin lineup";
}

export type RemoteGameStatus = "Programado" | "En curso" | "Final" | "Suspendido";

/** The status a league game shows before it is imported. */
export function remoteGameStatus(state: Pick<ApiState, "status">): RemoteGameStatus {
  switch (state.status) {
    case "live":
      return "En curso";
    case "final":
    case "forfeit":
      return "Final";
    case "suspended":
      return "Suspendido";
    default:
      return "Programado";
  }
}

export function isFinishedRemoteStatus(status: RemoteGameStatus): boolean {
  return status === "Final";
}
