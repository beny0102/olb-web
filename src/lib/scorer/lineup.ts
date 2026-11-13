import { DEFAULT_RULES, type RulesProfile } from "./rules";
import type { FieldingPosition, Lineup, Player } from "./types";

/** The nine batters in plate-appearance order. */
export function battingOrder(lineup: Lineup): Player[] {
  return [...lineup.players].sort((a, b) => a.battingSlot - b.battingSlot);
}

/**
 * The batter for a zero-based plate appearance. The order wraps every nine
 * hitters, so the scorer never has to type the next name by hand.
 */
export function batterAt(lineup: Lineup, plateAppearance: number): Player | null {
  const order = battingOrder(lineup);
  if (order.length === 0) return null;
  const index = ((Math.trunc(plateAppearance) % 9) + 9) % 9;
  return order[index] ?? null;
}

/** The player currently playing a fielding position, or null when empty. */
export function fielderAt(
  lineup: Lineup,
  position: FieldingPosition,
): Player | null {
  return lineup.players.find((player) => player.position === position) ?? null;
}

/**
 * Human-readable validation in Spanish. A lineup is ready to score when this
 * returns an empty list; the pitcher either bats or the lineup carries a DH.
 */
export function validateLineup(
  lineup: Lineup,
  rules: RulesProfile = DEFAULT_RULES,
): string[] {
  const errors: string[] = [];
  const players = lineup.players;

  if (players.length !== 9) {
    errors.push("La alineación debe tener exactamente 9 jugadores.");
  }

  if (new Set(players.map((player) => player.id)).size !== players.length) {
    errors.push("Hay jugadores repetidos en la alineación.");
  }

  if (players.some((player) => player.name.trim() === "")) {
    errors.push("Cada jugador necesita un nombre.");
  }

  const slots = players.map((player) => player.battingSlot);
  if (slots.some((slot) => !Number.isInteger(slot) || slot < 1 || slot > 9)) {
    errors.push("Los turnos al bate deben ser números enteros del 1 al 9.");
  }
  if (new Set(slots).size !== slots.length) {
    errors.push("Hay turnos al bate repetidos.");
  }

  const hasDesignatedHitter = players.some((player) => player.position === "DH");
  if (!rules.dh && hasDesignatedHitter) {
    errors.push("El bateador designado no está permitido con las reglas actuales.");
  }

  if (lineup.pitcherId.trim() === "") {
    errors.push("Falta el pitcher de la alineación.");
  } else {
    const pitcherInOrder = players.some((player) => player.id === lineup.pitcherId);
    if (!pitcherInOrder && !hasDesignatedHitter) {
      errors.push(
        "El pitcher debe estar en el orden al bate o la alineación debe usar bateador designado (DH).",
      );
    }
  }

  return errors;
}
