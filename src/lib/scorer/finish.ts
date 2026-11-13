import type { GameState } from "./fold";

/** How the current state may be closed, if at all. */
export type FinishMode = "completed" | "shortened" | "blocked";

/** The two reasons the scorer can send when the operator closes a game. */
export type FinishReason = Exclude<FinishMode, "blocked">;

type FinishState = Pick<GameState, "inning" | "half" | "score">;

/**
 * A game can be completed after nine full innings with a winner, after 8.5
 * innings when the home team is ahead, or on a walk-off in the bottom of the
 * ninth or later. Same rule the API applies before it accepts `game.end`.
 */
export function canComplete(state: FinishState): boolean {
  const { home, away } = state.score;
  return (
    (state.inning >= 10 && home !== away) ||
    (state.half === "bottom" && state.inning >= 9 && home > away)
  );
}

/**
 * A game can be shortened after five full innings, or after 4.5 innings when
 * the home team is ahead. Same rule the API applies before it accepts
 * `game.end` with `reason: "shortened"`.
 */
export function canShorten(state: FinishState): boolean {
  const { home, away } = state.score;
  return (
    state.inning >= 6 || (state.inning === 5 && state.half === "bottom" && home > away)
  );
}

/** Which ending the current state allows. */
export function finishMode(state: FinishState): FinishMode {
  if (canComplete(state)) return "completed";
  if (canShorten(state)) return "shortened";
  return "blocked";
}

function halfLabel(half: GameState["half"]): string {
  return half === "top" ? "alta" : "baja";
}

function situation(state: FinishState): string {
  return `Entrada ${state.inning} · ${halfLabel(state.half)}. Marcador: visitante ${state.score.away} — local ${state.score.home}.`;
}

/** Dialog heading for the ending the state allows. */
export function finishTitle(mode: FinishMode): string {
  switch (mode) {
    case "completed":
      return "Finalizar juego";
    case "shortened":
      return "Finalizar como juego corto";
    default:
      return "Todavía no se puede finalizar";
  }
}

/**
 * Dialog body in Spanish. Always states the current inning, half and score, so
 * the operator sees exactly what is being closed before confirming.
 */
export function finishExplanation(state: FinishState, mode: FinishMode): string {
  switch (mode) {
    case "completed":
      return `${situation(state)} El juego llegó al final reglamentario; el marcador queda cerrado y no admite más jugadas.`;
    case "shortened":
      return `${situation(state)} El juego no ha llegado a nueve entradas (ni a 8.5 con el equipo local por delante). Si lo cierras como juego corto, el resultado es definitivo y cuenta en la clasificación.`;
    default:
      return `${situation(state)} Un juego corto necesita al menos cinco entradas completas (o 4.5 con el equipo local por delante). Sigue anotando hasta llegar a esa distancia.`;
  }
}
