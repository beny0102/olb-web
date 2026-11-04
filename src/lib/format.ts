import type { Event, GameState } from "./types";

const CALLS: Record<string, string> = {
  B: "Bola",
  C: "Strike cantado",
  S: "Strike abanicado",
  F: "Foul",
  T: "Foul tip",
  X: "Bola en juego",
  P: "Pitchout",
  Q: "Otra",
};

export function callLabel(call: string): string {
  return CALLS[call] ?? call;
}

const REASONS: Record<string, string> = {
  completed: "finalizado",
  rain: "lluvia",
  forfeit: "incomparecencia",
};

export function reasonLabel(reason: string): string {
  return REASONS[reason] ?? reason;
}

const SOURCES: Record<string, string> = {
  human: "anotador",
  vision: "visión",
  import: "importación",
  system: "sistema",
};

export function sourceLabel(source: string): string {
  return SOURCES[source] ?? source;
}

export function inningLabel(state: GameState): string {
  return `${state.inning}.ª ${state.half === "top" ? "alta" : "baja"}`;
}

export function outsLabel(outs: number): string {
  return outs === 1 ? "1 out" : `${outs} outs`;
}

/** Live telemetry only belongs to a live game; other states name themselves. */
export function scoreboardLine(state: GameState): string {
  if (state.status === "live") return `${inningLabel(state)} · ${outsLabel(state.outs)}`;
  return statusLabel(state.status);
}

export function eventTitle(event: Event): string {
  switch (event.type) {
    case "game.start":
      return "Inicio del juego";
    case "game.end":
      return "Fin del juego";
    case "pitch":
      return callLabel(event.payload.call);
    case "ball_in_play":
      return "Bola puesta en juego";
    case "inning.end":
      return `Fin de la ${event.payload.half === "top" ? "alta" : "baja"}`;
    case "lineup.set":
      return "Alineación";
    case "substitution":
      return "Cambio";
    case "runner":
      return "Corredor";
    case "discrepancy":
      return "Discrepancia";
    case "amendment":
      return "Enmienda";
    case "note":
      return "Nota";
    default:
      return "Evento";
  }
}

/** Replaces the game.end title while a game is suspended. */
export function suspendedTitle(event: Event | null): string | null {
  if (!event || event.type !== "game.end") return null;
  return `Suspendido · ${reasonLabel(event.payload.reason)}`;
}

export function eventDetail(event: Event): string | null {
  switch (event.type) {
    case "pitch":
      return `${event.payload.count.balls}-${event.payload.count.strikes} · lanzamiento ${event.payload.pitchNo}`;
    case "ball_in_play": {
      const runs = event.payload.runsBattedIn;
      return `${event.payload.code}${runs > 0 ? ` · ${runs} ${runs === 1 ? "carrera" : "carreras"}` : ""}`;
    }
    case "inning.end":
      return `${event.payload.runsScored} carreras · ${event.payload.outs} outs`;
    case "note":
      return event.payload.text;
    case "game.end":
      return `${event.payload.finalScore.away}-${event.payload.finalScore.home} · ${reasonLabel(event.payload.reason)}`;
    default:
      return null;
  }
}

const dateFormat = new Intl.DateTimeFormat("es-MX", {
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

export function formatTime(iso: string): string {
  return dateFormat.format(new Date(iso));
}

/**
 * Scheduled starts arrive as `...Z` from the memory store and `...000Z` from
 * Postgres. Date.parse handles both; anything else is reported as missing
 * rather than rendered as "Invalid Date".
 */
export function formatScheduledStart(value: string | null | undefined): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("es-ES", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

/** Always nine inning columns; shorter payloads are padded with nulls. */
export function formatLinescore(line: readonly (number | null)[]): string[] {
  const length = Math.max(9, line.length);
  return Array.from({ length }, (_, index) => {
    const runs = line[index];
    return runs === null || runs === undefined ? "–" : String(runs);
  });
}

/** Baseball convention: a leading zero is dropped (`.667`, `1.000`). */
export function formatPct(pct: number): string {
  if (!Number.isFinite(pct)) return "—";
  const fixed = pct.toFixed(3);
  return fixed.startsWith("0") ? fixed.slice(1) : fixed;
}

export function statusLabel(status: GameState["status"]): string {
  switch (status) {
    case "scheduled":
      return "Programado";
    case "live":
      return "En vivo";
    case "final":
      return "Final";
    case "suspended":
      return "Suspendido";
    case "forfeit":
      return "Incomparecencia";
    default:
      return status;
  }
}
