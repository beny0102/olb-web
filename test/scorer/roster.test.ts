import { describe, expect, it } from "vitest";
import { DEFAULT_RULES } from "../../src/lib/scorer/rules";
import {
  ROSTER_BATTING_POSITIONS,
  fieldingPosition,
  rosterToLineup,
} from "../../src/lib/scorer/roster";
import type { RosterPlayer } from "../../src/lib/scorer/types";

const positions = ["C", "1B", "2B", "3B", "SS", "LF", "CF", "RF", "DH", "P"];

function roster(overrides: Partial<RosterPlayer>[] = []): RosterPlayer[] {
  return positions.map((position, index) => ({
    id: `0192f3a2-0100-7000-8000-0000000000${String(index + 10).padStart(2, "0")}`,
    name: `Jugador ${index + 1}`,
    position,
    jersey: String(index + 1),
    ...overrides[index],
  }));
}

describe("fieldingPosition", () => {
  it("maps roster abbreviations to the contract codes", () => {
    expect(fieldingPosition("P")).toBe("1");
    expect(fieldingPosition("C")).toBe("2");
    expect(fieldingPosition("SS")).toBe("6");
    expect(fieldingPosition("DH")).toBe("DH");
    expect(fieldingPosition(" p ")).toBe("1");
    expect(fieldingPosition("X")).toBeNull();
  });
});

describe("rosterToLineup", () => {
  it("fills the nine batting slots with the DH rule and keeps roster ids", () => {
    const players = roster();
    const result = rosterToLineup(players, "home", DEFAULT_RULES);

    expect(result.error).toBeNull();
    expect(result.lineup).not.toBeNull();
    const lineup = result.lineup!;
    expect(lineup.team).toBe("home");
    expect(lineup.players).toHaveLength(9);
    expect(lineup.players.map((player) => player.position)).toEqual([
      ...ROSTER_BATTING_POSITIONS.map((code) => fieldingPosition(code)),
      "DH",
    ]);
    expect(lineup.players.map((player) => player.battingSlot)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9,
    ]);
    expect(lineup.players.map((player) => player.id)).toEqual(
      players.slice(0, 9).map((player) => player.id),
    );
    expect(lineup.pitcherId).toBe(players[9]!.id);
    expect(lineup.players.some((player) => player.id === lineup.pitcherId)).toBe(false);
  });

  it("makes the pitcher bat ninth when the DH is off", () => {
    const players = roster();
    const result = rosterToLineup(players, "away", {
      ...DEFAULT_RULES,
      dh: false,
    });

    expect(result.error).toBeNull();
    const lineup = result.lineup!;
    expect(lineup.players).toHaveLength(9);
    expect(lineup.players[8]).toMatchObject({
      id: players[9]!.id,
      position: "1",
      battingSlot: 9,
    });
    expect(lineup.pitcherId).toBe(players[9]!.id);
  });

  it("fills the holes with unused players when fallback is requested", () => {
    const players = roster().filter((player) => player.position !== "P");

    expect(rosterToLineup(players, "home", DEFAULT_RULES).lineup).toBeNull();

    const result = rosterToLineup(players, "home", DEFAULT_RULES, {
      fallback: true,
    });
    expect(result.error).toBeNull();
    expect(result.lineup?.players).toHaveLength(9);
    expect(result.lineup?.pitcherId).toBe(players[0]!.id);
  });

  it("rejects a roster without a pitcher", () => {
    const players = roster().filter((player) => player.position !== "P");

    expect(rosterToLineup(players, "home", DEFAULT_RULES)).toEqual({
      lineup: null,
      error: "La plantilla no tiene pitcher.",
    });
  });

  it("rejects fewer than nine eligible players", () => {
    const players = roster().slice(0, 8);

    expect(rosterToLineup(players, "home", DEFAULT_RULES)).toEqual({
      lineup: null,
      error: "La plantilla no tiene 9 jugadores elegibles.",
    });
  });

  it("names the positions a roster cannot cover", () => {
    const players = roster().filter((player) => player.position !== "CF");

    expect(rosterToLineup(players, "home", DEFAULT_RULES)).toEqual({
      lineup: null,
      error: "La plantilla no tiene jugadores para: CF.",
    });
  });

  it("ignores players without an id or a name", () => {
    const players = roster([
      { id: "" },
      { name: "  " },
    ]);

    expect(rosterToLineup(players, "home", DEFAULT_RULES)).toEqual({
      lineup: null,
      error: "La plantilla no tiene 9 jugadores elegibles.",
    });
  });
});
