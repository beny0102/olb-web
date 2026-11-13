import { describe, expect, it } from "vitest";
import type { Event } from "@olb/contract/types";
import {
  ballInPlay,
  gameStart,
  inningEnd,
  interference,
  pitch,
  voidEvent,
} from "../../src/lib/scorer/events";
import { foldEvents, initialState, type GameState } from "../../src/lib/scorer/fold";
import type { Lineup, Player } from "../../src/lib/scorer/types";
import {
  canUndo,
  countPlateAppearances,
  lastUndoable,
  nextPitchNo,
  outcome,
  outsAdded,
  runsThisHalf,
  undoTargets,
  type OutcomeCode,
} from "../../src/lib/scorer/scoring";
import { uuid7 } from "../../src/lib/scorer/uuid7";

const gameId = uuid7();

function lineup(team: "home" | "away"): Lineup {
  const positions: Player["position"][] = ["1", "2", "3", "4", "5", "6", "7", "8", "9"];
  const players: Player[] = positions.map((position, index) => ({
    id: uuid7(),
    name: `${team} ${index + 1}`,
    position,
    battingSlot: index + 1,
  }));
  return { team, players, pitcherId: players[0]!.id };
}

const home = lineup("home");
const away = lineup("away");
const batter = away.players[0]!;
const second = away.players[1]!;
const third = away.players[2]!;
const fourth = away.players[3]!;

function stateWith(loaded: boolean): GameState {
  return {
    ...initialState,
    status: "live",
    bases: loaded
      ? { first: second.id, second: third.id, third: fourth.id }
      : { first: null, second: null, third: null },
  };
}

const pitchEvent = (
  seq: number,
  call: "B" | "C" | "S" | "F" | "T" | "X" | "P" | "Q" | "H" | "I",
) =>
  pitch(gameId, seq, {
    pitchNo: seq,
    batter: batter.id,
    pitcher: home.players[0]!.id,
    count: { balls: 0, strikes: 0 },
    call,
  });

describe("outcome", () => {
  it("turns out into a 6-3 grounder with a putout and an assist", () => {
    const payload = outcome(stateWith(false), "out", batter, home.players);

    expect(payload.code).toBe("6-3/G");
    expect(payload.runnersAdvanced).toBeUndefined();
    expect(payload.fielders?.map((fielder) => fielder.role)).toEqual(["putout", "assist"]);
    expect(payload.fielders?.[0]?.player).toBe(home.players[5]!.id);
    expect(payload.fielders?.[1]?.player).toBe(home.players[2]!.id);
  });

  const expectations: Record<
    Exclude<OutcomeCode, "out" | "DP" | "SAC">,
    { code: string; on: string; emptyAdvances: number; loadedAdvances: number; runs: number }
  > = {
    "1B": { code: "S8", on: "hit", emptyAdvances: 1, loadedAdvances: 4, runs: 1 },
    "2B": { code: "D8", on: "hit", emptyAdvances: 1, loadedAdvances: 4, runs: 2 },
    "3B": { code: "T8", on: "hit", emptyAdvances: 1, loadedAdvances: 4, runs: 3 },
    HR: { code: "HR", on: "hit", emptyAdvances: 1, loadedAdvances: 4, runs: 4 },
    E: { code: "E6", on: "error", emptyAdvances: 1, loadedAdvances: 4, runs: 1 },
    FC: { code: "FC6", on: "other", emptyAdvances: 1, loadedAdvances: 4, runs: 1 },
  };

  for (const [code, expected] of Object.entries(expectations) as Array<
    [
      Exclude<OutcomeCode, "out" | "DP" | "SAC">,
      (typeof expectations)[Exclude<OutcomeCode, "out" | "DP" | "SAC">],
    ]
  >) {
    it(`records ${code} from empty bases`, () => {
      const payload = outcome(stateWith(false), code, batter, home.players);
      const advances = payload.runnersAdvanced ?? [];

      expect(payload.code).toBe(expected.code);
      expect(advances).toHaveLength(expected.emptyAdvances);
      expect(advances.every((advance) => advance.on === expected.on)).toBe(true);
      const emptyRuns = code === "HR" ? 1 : 0;
      expect(advances.filter((advance) => advance.to === "H")).toHaveLength(emptyRuns);
      expect(payload.runsBattedIn).toBe(emptyRuns);
    });

    it(`records ${code} with loaded bases`, () => {
      const payload = outcome(stateWith(true), code, batter, home.players);
      const advances = payload.runnersAdvanced ?? [];

      expect(advances).toHaveLength(expected.loadedAdvances);
      expect(advances.every((advance) => advance.on === expected.on)).toBe(true);
      expect(advances.filter((advance) => advance.to === "H")).toHaveLength(expected.runs);
      expect(payload.runsBattedIn).toBe(
        code === "E" || code === "FC" ? 0 : expected.runs,
      );
    });
  }

  it("records a double play with two putouts and clears the lead runner", () => {
    const defence = [
      { id: home.players[5]!.id, name: "SS", position: "6" as const, battingSlot: 6 },
      { id: home.players[3]!.id, name: "2B", position: "4" as const, battingSlot: 4 },
      { id: home.players[2]!.id, name: "1B", position: "3" as const, battingSlot: 3 },
    ];
    const payload = outcome(stateWith(true), "DP", batter, defence);

    expect(payload.code).toBe("6(1)3/GDP");
    expect(payload.fielders?.filter((fielder) => fielder.role === "putout")).toHaveLength(2);
    expect(payload.runnersAdvanced?.[0]).toMatchObject({ from: "1", to: "B" });
  });

  it("advances every runner one base on a sacrifice", () => {
    const payload = outcome(stateWith(true), "SAC", batter, home.players);
    const advances = payload.runnersAdvanced ?? [];

    expect(payload.code).toBe("1-3/SH");
    expect(advances).toHaveLength(3);
    expect(advances.every((advance) => advance.on === "sacrifice")).toBe(true);
    expect(advances.find((advance) => advance.from === "3")?.to).toBe("H");
    expect(payload.runsBattedIn).toBe(0);
  });

  it("moves the batter to the base the hit asks for", () => {
    expect(outcome(stateWith(false), "1B", batter).runnersAdvanced?.[0]?.to).toBe("1");
    expect(outcome(stateWith(false), "2B", batter).runnersAdvanced?.[0]?.to).toBe("2");
    expect(outcome(stateWith(false), "3B", batter).runnersAdvanced?.[0]?.to).toBe("3");
    expect(outcome(stateWith(false), "HR", batter).runnersAdvanced?.[0]?.to).toBe("H");
  });

  it("scores the game state the payload describes", () => {
    const empty = stateWith(false);
    const single = foldEvents(
      [gameStart(gameId, 0), ballInPlay(gameId, 1, outcome(empty, "1B", batter, home.players))],
    );
    expect(single.bases.first).toBe(batter.id);
    expect(single.score.away).toBe(0);

    const loaded = foldEvents([
      gameStart(gameId, 0),
      ballInPlay(gameId, 1, outcome(stateWith(true), "HR", batter, home.players)),
    ]);
    expect(loaded.score.away).toBe(4);
    expect(loaded.bases).toEqual({ first: null, second: null, third: null });
  });
});

describe("outsAdded", () => {
  const twoStrikes: GameState = {
    ...initialState,
    count: { balls: 0, strikes: 2 },
  };

  it("counts a strikeout on a called strike or a foul tip", () => {
    expect(outsAdded(twoStrikes, pitchEvent(1, "C"))).toBe(1);
    expect(outsAdded(twoStrikes, pitchEvent(1, "S"))).toBe(1);
    expect(outsAdded(twoStrikes, pitchEvent(1, "Q"))).toBe(1);
    expect(outsAdded(twoStrikes, pitchEvent(1, "T"))).toBe(1);
  });

  it("does not count a foul or a strike before two strikes", () => {
    expect(outsAdded(twoStrikes, pitchEvent(1, "F"))).toBe(0);
    expect(outsAdded({ ...initialState, count: { balls: 0, strikes: 1 } }, pitchEvent(1, "C"))).toBe(
      0,
    );
  });

  it("counts two outs for a double play outcome", () => {
    const defence = [
      { id: home.players[5]!.id, name: "SS", position: "6" as const, battingSlot: 6 },
      { id: home.players[3]!.id, name: "2B", position: "4" as const, battingSlot: 4 },
      { id: home.players[2]!.id, name: "1B", position: "3" as const, battingSlot: 3 },
    ];
    const dp = ballInPlay(gameId, 1, outcome(stateWith(true), "DP", batter, defence));

    expect(outsAdded(stateWith(true), dp)).toBe(2);
  });

  it("counts one out per putout, so a double play adds two", () => {
    const dp = ballInPlay(gameId, 1, {
      batter: batter.id,
      code: "6(1)3/GDP",
      runsBattedIn: 0,
      fielders: [
        { player: home.players[5]!.id, role: "putout" },
        { player: home.players[2]!.id, role: "putout" },
        { player: home.players[0]!.id, role: "assist" },
      ],
    });

    expect(outsAdded(initialState, dp)).toBe(2);
  });

  it("counts a runner caught out", () => {
    const caught = {
      ...pitchEvent(1, "X"),
      type: "runner",
      payload: { player: second.id, from: "1", to: "2", kind: "caught_stealing", out: true },
    } as Event;

    expect(outsAdded(initialState, caught)).toBe(1);
  });
});

describe("countPlateAppearances", () => {
  it("counts walks, strikeouts and balls in play across innings", () => {
    const events: Event[] = [
      gameStart(gameId, 0),
      pitchEvent(1, "B"),
      pitchEvent(2, "B"),
      pitchEvent(3, "B"),
      pitchEvent(4, "B"),
      pitchEvent(5, "S"),
      pitchEvent(6, "C"),
      pitchEvent(7, "Q"),
      inningEnd(gameId, 8, { inning: 1, half: "top", runsScored: 0, outs: 3 }),
      ballInPlay(gameId, 9, {
        batter: away.players[1]!.id,
        code: "S8",
        runsBattedIn: 0,
        runnersAdvanced: [{ player: away.players[1]!.id, from: "B", to: "1" }],
      }),
    ];

    expect(countPlateAppearances(events)).toBe(3);
  });

  it("counts a hit by pitch as a completed plate appearance", () => {
    const events = [
      gameStart(gameId, 0),
      pitchEvent(1, "H"),
    ];

    expect(countPlateAppearances(events)).toBe(1);
  });

  it("counts batter interference as a completed plate appearance", () => {
    const events = [
      gameStart(gameId, 0),
      interference(gameId, 1, { batter: batter.id }),
    ];

    expect(countPlateAppearances(events)).toBe(1);
  });

  it("does not count a foul or an unfinished at-bat", () => {
    const events = [
      gameStart(gameId, 0),
      pitchEvent(1, "F"),
      pitchEvent(2, "S"),
      pitchEvent(3, "B"),
    ];

    expect(countPlateAppearances(events)).toBe(0);
  });
});

describe("runsThisHalf", () => {
  it("subtracts the last inning checkpoint after a reload", () => {
    const events: Event[] = [
      gameStart(gameId, 0),
      ballInPlay(gameId, 1, { batter: batter.id, code: "HR/F", runsBattedIn: 1 }),
      inningEnd(gameId, 2, { inning: 1, half: "top", runsScored: 1, outs: 3 }),
      ballInPlay(gameId, 3, {
        batter: home.players[0]!.id,
        code: "HR/F",
        runsBattedIn: 1,
      }),
    ];
    const state = foldEvents(events);

    expect(state.score).toEqual({ home: 1, away: 1 });
    expect(runsThisHalf(events, state)).toBe(1);
  });

  it("counts from the start of the game before the first checkpoint", () => {
    const events: Event[] = [
      gameStart(gameId, 0),
      ballInPlay(gameId, 1, { batter: batter.id, code: "HR/F", runsBattedIn: 2 }),
    ];
    const state = foldEvents(events);

    expect(runsThisHalf(events, state)).toBe(2);
  });
});

describe("undo helpers", () => {
  it("cannot undo a structural event", () => {
    expect(canUndo([])).toBe(false);
    expect(canUndo([gameStart(gameId, 0)])).toBe(false);
    expect(canUndo([gameStart(gameId, 0), pitchEvent(1, "B")])).toBe(true);
    expect(canUndo([gameStart(gameId, 0), inningEnd(gameId, 1, {
      inning: 1,
      half: "top",
      runsScored: 0,
      outs: 3,
    })])).toBe(true);
  });

  it("returns the last real play, skipping an existing void", () => {
    const first = pitchEvent(1, "B");
    const second = pitchEvent(2, "S");
    const voided = voidEvent(gameId, 3, { id: second.id, seq: 2 }, "data_entry");
    const events = [gameStart(gameId, 0), first, second, voided];

    expect(lastUndoable(events)?.id).toBe(first.id);
    expect(canUndo(events)).toBe(true);
  });

  it("does not offer undo when the only play is already voided", () => {
    const only = pitchEvent(1, "B");
    const voided = voidEvent(gameId, 2, { id: only.id, seq: 1 }, "data_entry");
    const events = [gameStart(gameId, 0), only, voided];

    expect(lastUndoable(events)).toBeNull();
    expect(canUndo(events)).toBe(false);
  });

  it("takes back the automatic inning end together with the third out", () => {
    const out = (seq: number) =>
      ballInPlay(gameId, seq, {
        batter: batter.id,
        code: "6-3/G",
        runsBattedIn: 0,
        fielders: [{ player: home.players[5]!.id, role: "putout" }],
      });
    const end = inningEnd(gameId, 4, {
      inning: 1,
      half: "top",
      runsScored: 0,
      outs: 3,
    });
    const events = [gameStart(gameId, 0), out(1), out(2), out(3), end];

    expect(undoTargets(events).map((event) => event.type)).toEqual([
      "inning.end",
      "ball_in_play",
    ]);
  });

  it("takes back only the inning end when the previous play was not the third out", () => {
    const end = inningEnd(gameId, 1, {
      inning: 1,
      half: "top",
      runsScored: 0,
      outs: 1,
    });

    expect(undoTargets([gameStart(gameId, 0), end]).map((event) => event.type)).toEqual([
      "inning.end",
    ]);
  });
});

describe("nextPitchNo", () => {
  it("counts every applied pitch plus the next one", () => {
    const events = [gameStart(gameId, 0), pitchEvent(1, "B"), pitchEvent(2, "C")];
    expect(nextPitchNo(events)).toBe(3);
  });
});
