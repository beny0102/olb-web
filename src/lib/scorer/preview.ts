import type { Event } from "@olb/contract/types";
import { appliedEvents, type GameState } from "./fold";

/**
 * One row of the public linescore. A half inning only gets a number once its
 * `inning.end` exists; an unplayed or still-open half stays `null`, exactly as
 * the viewer's `deriveLinescore` in olb-web renders it.
 */
export interface InningLine {
  inning: number;
  away: number | null;
  home: number | null;
}

export interface Linescore {
  innings: InningLine[];
  awayTotal: number;
  homeTotal: number;
  hasData: boolean;
}

/** The public status chip: scheduled, live (including suspended) or final. */
export type PreviewStatus = "scheduled" | "live" | "final";

export function previewStatus(state: Pick<GameState, "status">): PreviewStatus {
  if (state.status === "final" || state.status === "forfeit") return "final";
  if (state.status === "live" || state.status === "suspended") return "live";
  return "scheduled";
}

/**
 * Closed half innings only. Totals come from the same `runsScored` the log
 * states, so they match the viewer's linescore; the R column of the breakdown
 * still prefers the local `GameState` score.
 */
export function deriveLinescore(events: readonly Event[]): Linescore {
  const rows = new Map<number, { away: number | null; home: number | null }>();
  let awayTotal = 0;
  let homeTotal = 0;

  for (const event of appliedEvents(events)) {
    if (event.type !== "inning.end") continue;
    const row = rows.get(event.payload.inning) ?? { away: null, home: null };
    if (event.payload.half === "top") {
      row.away = event.payload.runsScored;
      awayTotal += event.payload.runsScored;
    } else {
      row.home = event.payload.runsScored;
      homeTotal += event.payload.runsScored;
    }
    rows.set(event.payload.inning, row);
  }

  const lastInning = rows.size === 0 ? 0 : Math.max(...rows.keys());
  const innings: InningLine[] = [];
  for (let inning = 1; inning <= lastInning; inning += 1) {
    const row = rows.get(inning);
    innings.push({
      inning,
      away: row?.away ?? null,
      home: row?.home ?? null,
    });
  }

  return { innings, awayTotal, homeTotal, hasData: rows.size > 0 };
}

const PITCH_LABELS: Record<string, string> = {
  B: "Bola",
  C: "Strike cantado",
  S: "Strike abanicado",
  F: "Foul",
  T: "Foul tip",
  X: "Bola en juego",
  P: "Pitchout",
  Q: "Otra",
  H: "Golpeado por el pitcher",
};

const RUNNER_LABELS: Record<string, string> = {
  steal: "Robo de base",
  caught_stealing: "Out en intento de robo",
  pickoff: "Out en pickoff",
  wild_pitch: "Lanzamiento descontrolado",
  passed_ball: "Bola pasada",
  balk: "Balk",
  placed: "Corredor automático",
  other: "Movimiento de corredor",
};

/** A Spanish label for a ball in play when the log has no description. */
function ballInPlayLabel(code: string, runsBattedIn: number): string {
  let label: string;
  if (/GDP/i.test(code)) label = "Doble play";
  else if (/SH/i.test(code)) label = "Sacrificio";
  else if (/^E/i.test(code)) label = "Error";
  else if (/^FC/i.test(code)) label = "Elección del fildeador";
  else if (/^HR/i.test(code)) label = "Home run";
  else if (/^S/i.test(code)) label = "Sencillo";
  else if (/^D/i.test(code)) label = "Doble";
  else if (/^T/i.test(code)) label = "Triple";
  else if (/\/G/i.test(code)) label = "Out en primera";
  else label = "Bola en juego";

  if (runsBattedIn === 1) return `${label} · 1 carrera`;
  if (runsBattedIn > 1) return `${label} · ${runsBattedIn} carreras`;
  return label;
}

/**
 * A short, deterministic Spanish description of the last play. A
 * `ball_in_play` description written by the scorekeeper always wins; the
 * fallback maps the pitch call or the play code so an offline log still says
 * something useful. `names` resolves runner ids to names.
 */
export function describeLastPlay(
  events: readonly Event[],
  names: Readonly<Record<string, string>> = {},
): string {
  const applied = appliedEvents(events).filter(
    (event) => event.type !== "amendment" && event.type !== "discrepancy",
  );
  const event = applied[applied.length - 1];
  if (!event) return "Sin jugadas todavía";

  switch (event.type) {
    case "game.start":
      return "Inicio del juego";
    case "game.end":
      return "Final";
    case "game.suspend":
      return "Juego suspendido";
    case "game.resume":
      return "Juego reanudado";
    case "pitch":
      return PITCH_LABELS[event.payload.call] ?? "Lanzamiento";
    case "ball_in_play": {
      const description = event.payload.description?.trim();
      if (description) return description;
      return ballInPlayLabel(event.payload.code, event.payload.runsBattedIn);
    }
    case "inning.end":
      return "Cambio";
    case "runner": {
      const base = RUNNER_LABELS[event.payload.kind] ?? "Movimiento de corredor";
      const name = names[event.payload.player];
      return name ? `${base} · ${name}` : base;
    }
    case "substitution":
      return "Cambio";
    case "ejection":
      return "Expulsión";
    case "interference":
      return "Interferencia";
    case "note":
      return event.payload.text;
    case "lineup.set":
      return "Alineación";
    default:
      return "Jugada";
  }
}

/** Uppercase club mark for the compact scoreboard, same idea as the viewer. */
export function teamAbbr(name: string): string {
  const cleaned = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ")
    .trim();

  if (cleaned.length === 0) return "OLB";
  const words = cleaned.split(/\s+/);
  if (words.length >= 3) {
    return words
      .slice(0, 3)
      .map((word) => word[0] ?? "")
      .join("");
  }
  if (words.length === 2) {
    return `${words[0]?.slice(0, 2) ?? ""}${words[1]?.[0] ?? ""}`;
  }
  return words[0]?.slice(0, 3) ?? "OLB";
}
