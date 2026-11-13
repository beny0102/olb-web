import { describe, expect, it } from "vitest";
import type { Lineup, Player } from "../../src/lib/scorer/types";
import {
  batterAt,
  battingOrder,
  fielderAt,
  validateLineup,
} from "../../src/lib/scorer/lineup";

function player(id: string, slot: number, position: Player["position"]): Player {
  return { id, name: `Jugador ${id}`, position, battingSlot: slot };
}

const players = [
  player("p1", 1, "1"),
  player("p2", 2, "2"),
  player("p3", 3, "3"),
  player("p4", 4, "4"),
  player("p5", 5, "5"),
  player("p6", 6, "6"),
  player("p7", 7, "7"),
  player("p8", 8, "8"),
  player("p9", 9, "9"),
];

const lineup: Lineup = { team: "away", players, pitcherId: "p1" };

describe("battingOrder", () => {
  it("sorts by batting slot", () => {
    const shuffled: Lineup = { ...lineup, players: [...players].reverse() };
    expect(battingOrder(shuffled).map((entry) => entry.id)).toEqual([
      "p1",
      "p2",
      "p3",
      "p4",
      "p5",
      "p6",
      "p7",
      "p8",
      "p9",
    ]);
  });
});

describe("batterAt", () => {
  it("wraps every nine plate appearances", () => {
    expect(batterAt(lineup, 0)?.id).toBe("p1");
    expect(batterAt(lineup, 8)?.id).toBe("p9");
    expect(batterAt(lineup, 9)?.id).toBe("p1");
    expect(batterAt(lineup, 10)?.id).toBe("p2");
  });

  it("returns null for an empty lineup", () => {
    expect(batterAt({ ...lineup, players: [] }, 0)).toBeNull();
  });
});

describe("fielderAt", () => {
  it("finds the player at a fielding position", () => {
    expect(fielderAt(lineup, "8")?.id).toBe("p8");
    expect(fielderAt(lineup, "DH")).toBeNull();
  });
});

describe("validateLineup", () => {
  it("accepts a complete lineup with the pitcher batting", () => {
    expect(validateLineup(lineup)).toEqual([]);
  });

  it("accepts a pitcher outside the order when there is a DH", () => {
    const dh: Lineup = {
      ...lineup,
      players: [
        ...players.slice(0, 8),
        player("dh", 9, "DH"),
      ],
      pitcherId: "pitcher-outside",
    };
    expect(validateLineup(dh)).toEqual([]);
  });

  it("reports missing players, duplicates, bad slots and the pitcher rule", () => {
    const broken: Lineup = {
      ...lineup,
      players: [
        player("p1", 1, "1"),
        player("p1", 2, "2"),
        player("p3", 0, "3"),
        player("p4", 4, "4"),
      ],
      pitcherId: "nobody",
    };

    const errors = validateLineup(broken);
    expect(errors).toContain("La alineación debe tener exactamente 9 jugadores.");
    expect(errors).toContain("Hay jugadores repetidos en la alineación.");
    expect(errors).toContain("Los turnos al bate deben ser números enteros del 1 al 9.");
    expect(errors).toContain(
      "El pitcher debe estar en el orden al bate o la alineación debe usar bateador designado (DH).",
    );
  });

  it("reports an empty pitcher", () => {
    expect(validateLineup({ ...lineup, pitcherId: "" })).toContain(
      "Falta el pitcher de la alineación.",
    );
  });
});
