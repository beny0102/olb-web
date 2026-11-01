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

export function inningLabel(state: GameState): string {
  return `${state.inning}ª ${state.half === "top" ? "alta" : "baja"}`;
}

export function outsLabel(outs: number): string {
  return outs === 1 ? "1 out" : `${outs} outs`;
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
      return `${event.payload.finalScore.home}-${event.payload.finalScore.away} · ${event.payload.reason}`;
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
      return "Forfeit";
    default:
      return status;
  }
}
