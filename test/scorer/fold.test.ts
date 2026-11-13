import { describe, expect, it } from "vitest";
import type { Event } from "@olb/contract/types";
import { appliedEvents, foldEvents } from "../../src/lib/scorer/fold";
import { outcome } from "../../src/lib/scorer/scoring";

const gameId = "0192f3a0-5b11-7a02-8f3c-1c9d2e3f4a50";
const batter = "0192f3a2-0001-7000-8000-000000000001";
const pitcher = "0192f3a2-0001-7000-8000-000000000002";
const player = (n: number) => `0192f3a2-0003-7000-8000-${String(n).padStart(12, "0")}`;

function event(seq: number, type: string, payload: unknown): Event {
  return {
    contract: "olb.event/1",
    id: `0192f3a1-7c2e-7c3${seq.toString(16)}-9a3f-2b1d4e5f6a70`.slice(0, 36),
    gameId,
    seq,
    occurredAt: "2026-04-11T23:41:07.412Z",
    recordedAt: "2026-04-11T23:41:08.119Z",
    type,
    source: "human",
    actor: { kind: "user", id: "test" },
    payload,
  } as Event;
}

const start = (seq = 0) => event(seq, "game.start", {});
const pitch = (seq: number, call: string) =>
  event(seq, "pitch", {
    pitchNo: seq,
    batter,
    pitcher,
    count: { balls: 0, strikes: 0 },
    call,
  });

describe("foldEvents", () => {
  it("returns a scheduled projection for an empty log", () => {
    const state = foldEvents([]);
    expect(state.status).toBe("scheduled");
    expect(state.lastSeq).toBe(0);
  });

  it("starts the game with the visitors batting", () => {
    const state = foldEvents([start()]);
    expect(state).toMatchObject({
      status: "live",
      inning: 1,
      half: "top",
      outs: 0,
      battingTeam: "away",
      lastSeq: 0,
    });
  });

  it("counts balls and strikes with caps", () => {
    const state = foldEvents([start(), pitch(1, "B"), pitch(2, "S"), pitch(3, "F"), pitch(4, "F")]);
    expect(state.count).toEqual({ balls: 1, strikes: 2 });
    expect(state.lastSeq).toBe(4);
  });

  it("walks the batter on a fourth ball, resetting the count", () => {
    const state = foldEvents([
      start(),
      pitch(1, "B"),
      pitch(2, "B"),
      pitch(3, "B"),
      pitch(4, "B"),
    ]);

    expect(state.bases.first).toBe(batter);
    expect(state.count).toEqual({ balls: 0, strikes: 0 });
    expect(state.outs).toBe(0);
  });

  it("strikes out the batter on a third strike", () => {
    const state = foldEvents([start(), pitch(1, "S"), pitch(2, "C"), pitch(3, "Q")]);

    expect(state.outs).toBe(1);
    expect(state.count).toEqual({ balls: 0, strikes: 0 });
    expect(state.bases).toEqual({ first: null, second: null, third: null });
  });

  it("does not strike out on a foul with two strikes", () => {
    const state = foldEvents([start(), pitch(1, "S"), pitch(2, "C"), pitch(3, "F")]);

    expect(state.outs).toBe(0);
    expect(state.count).toEqual({ balls: 0, strikes: 2 });
  });

  it("does strike out on a foul tip with two strikes", () => {
    const state = foldEvents([start(), pitch(1, "S"), pitch(2, "C"), pitch(3, "T")]);

    expect(state.outs).toBe(1);
    expect(state.count).toEqual({ balls: 0, strikes: 0 });
  });

  it("awards first base on a hit by pitch and resets the count", () => {
    const state = foldEvents([start(), pitch(1, "B"), pitch(2, "S"), pitch(3, "H")]);

    expect(state.bases.first).toBe(batter);
    expect(state.count).toEqual({ balls: 0, strikes: 0 });
    expect(state.outs).toBe(0);
  });

  it("forces a run home when a hit by pitch loads the bases", () => {
    const first = player(31);
    const second = player(32);
    const third = player(33);
    const state = foldEvents([
      start(),
      event(1, "runner", { player: first, from: "bench", to: "1", kind: "placed", out: false }),
      event(2, "runner", { player: second, from: "bench", to: "2", kind: "placed", out: false }),
      event(3, "runner", { player: third, from: "bench", to: "3", kind: "placed", out: false }),
      pitch(4, "H"),
    ]);

    expect(state.score.away).toBe(1);
    expect(state.bases).toEqual({ first: batter, second: first, third: second });
  });

  it("treats an intentional ball as a ball and walks on the fourth", () => {
    const state = foldEvents([
      start(),
      pitch(1, "I"),
      pitch(2, "I"),
      pitch(3, "I"),
      pitch(4, "I"),
    ]);

    expect(state.bases.first).toBe(batter);
    expect(state.count).toEqual({ balls: 0, strikes: 0 });
  });

  it("awards first base on batter interference", () => {
    const state = foldEvents([
      start(),
      pitch(1, "B"),
      event(2, "interference", { batter, kind: "catcher" }),
    ]);

    expect(state.bases.first).toBe(batter);
    expect(state.count).toEqual({ balls: 0, strikes: 0 });
  });

  it("leaves the projection unchanged for a substitution", () => {
    const before = foldEvents([start(), pitch(1, "B")]);
    const after = foldEvents([
      start(),
      pitch(1, "B"),
      event(2, "substitution", {
        team: "away",
        playerIn: player(51),
        playerOut: batter,
        position: "1",
        battingSlot: 1,
        reason: "courtesy",
      }),
    ]);

    expect({ ...after, lastSeq: before.lastSeq }).toEqual(before);
    expect(after.lastSeq).toBe(2);
  });

  it("places an automatic runner from the bench on second", () => {
    const state = foldEvents([
      start(),
      event(1, "runner", {
        player: player(41),
        from: "bench",
        to: "2",
        kind: "placed",
        out: false,
      }),
    ]);

    expect(state.bases).toEqual({ first: null, second: player(41), third: null });
    expect(state.outs).toBe(0);
    expect(state.score).toEqual({ home: 0, away: 0 });
  });

  it("suspends and resumes the game", () => {
    const suspended = foldEvents([
      start(),
      event(1, "game.suspend", { reason: "Lluvia" }),
    ]);
    expect(suspended.status).toBe("suspended");

    const resumed = foldEvents([
      start(),
      event(1, "game.suspend", { reason: "Lluvia" }),
      event(2, "game.resume", {}),
    ]);
    expect(resumed.status).toBe("live");
    expect(resumed.lastSeq).toBe(2);
  });

  it("keeps an ejection as an audit-only event", () => {
    const before = foldEvents([start(), pitch(1, "B")]);
    const after = foldEvents([
      start(),
      pitch(1, "B"),
      event(2, "ejection", {
        person: player(61),
        role: "manager",
        reason: "Protesta",
      }),
    ]);

    expect({ ...after, lastSeq: before.lastSeq }).toEqual(before);
    expect(after.lastSeq).toBe(2);
  });

  it("records both outs of a double play", () => {
    const state = foldEvents([
      start(),
      event(1, "ball_in_play", {
        batter,
        code: "6(1)3/GDP",
        runsBattedIn: 0,
        fielders: [
          { player: player(21), role: "putout" },
          { player: player(22), role: "putout" },
          { player: player(23), role: "assist" },
        ],
      }),
    ]);

    expect(state.outs).toBe(2);
  });

  it("clears the lead runner's base on a double play", () => {
    const runnerOnFirst = player(71);
    const before = {
      ...foldEvents([start()]),
      bases: { first: runnerOnFirst, second: null, third: null },
    };
    const defence = [
      { id: player(81), name: "SS", position: "6" as const, battingSlot: 6 },
      { id: player(82), name: "2B", position: "4" as const, battingSlot: 4 },
      { id: player(83), name: "1B", position: "3" as const, battingSlot: 3 },
    ];
    const state = foldEvents(
      [start(), event(1, "ball_in_play", outcome(before, "DP", batter, defence))],
    );

    expect(state.outs).toBe(2);
    expect(state.bases.first).toBeNull();
  });

  it("moves a runner on a single and keeps the batter on first", () => {
    const runner = player(41);
    const state = foldEvents([
      start(),
      event(1, "ball_in_play", {
        batter,
        code: "S7",
        runsBattedIn: 0,
        runnersAdvanced: [
          { player: batter, from: "B", to: "1" },
          { player: runner, from: "1", to: "2" },
        ],
      }),
    ]);

    expect(state.bases).toEqual({ first: batter, second: runner, third: null });
    expect(state.count).toEqual({ balls: 0, strikes: 0 });
  });

  it("credits runs batted in when there is no baserunning detail", () => {
    const state = foldEvents([
      start(),
      event(1, "ball_in_play", { batter, code: "D7/L", runsBattedIn: 2 }),
    ]);
    expect(state.count).toEqual({ balls: 0, strikes: 0 });
    expect(state.score).toEqual({ home: 0, away: 2 });
  });

  it("advances the half inning and the inning number", () => {
    const afterTop = foldEvents([
      start(),
      event(1, "inning.end", { inning: 1, half: "top", runsScored: 0, outs: 3 }),
    ]);
    expect(afterTop).toMatchObject({ inning: 1, half: "bottom", battingTeam: "home", outs: 0 });

    const afterBottom = foldEvents([
      start(),
      event(1, "inning.end", { inning: 1, half: "top", runsScored: 0, outs: 3 }),
      event(2, "inning.end", { inning: 1, half: "bottom", runsScored: 0, outs: 3 }),
    ]);
    expect(afterBottom).toMatchObject({ inning: 2, half: "top", battingTeam: "away" });
  });

  it("finishes the game and takes the official score", () => {
    const state = foldEvents([
      start(),
      event(1, "game.end", { reason: "completed", finalScore: { home: 3, away: 5 } }),
    ]);
    expect(state.status).toBe("final");
    expect(state.score).toEqual({ home: 3, away: 5 });
  });

  it("treats a shortened game end as final", () => {
    const state = foldEvents([
      start(),
      event(1, "game.end", { reason: "shortened", finalScore: { home: 1, away: 2 } }),
    ]);
    expect(state.status).toBe("final");
    expect(state.score).toEqual({ home: 1, away: 2 });
  });

  it("skips an event type it does not know but consumes its sequence", () => {
    const future = event(1, "pitch_clock", {}) as unknown as Event;
    const state = foldEvents([start(), future]);
    expect(state.lastSeq).toBe(1);
    expect(state.status).toBe("live");
  });
});

describe("revisions and voids", () => {
  it("applies only the latest event of a revision chain", () => {
    const first = pitch(1, "B");
    const second = { ...pitch(2, "B"), revisionOf: first.id };
    const third = { ...pitch(3, "S"), revisionOf: second.id };

    expect(appliedEvents([first, second, third]).map((entry) => entry.seq)).toEqual([3]);

    const state = foldEvents([start(), first, second, third]);
    expect(state.count).toEqual({ balls: 0, strikes: 1 });
    expect(state.lastSeq).toBe(3);
  });

  it("voids the target event without deleting it from the log", () => {
    const original = pitch(1, "B");
    const voided = {
      ...event(2, "amendment", {
        targetSeq: original.seq,
        reason: "data_entry",
        replacement: null,
      }),
      revisionOf: original.id,
    };

    expect(appliedEvents([original, voided]).map((entry) => entry.seq)).toEqual([2]);

    const state = foldEvents([start(), original, voided]);
    expect(state.count).toEqual({ balls: 0, strikes: 0 });
    expect(state.lastSeq).toBe(2);
  });
});
