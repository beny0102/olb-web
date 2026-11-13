import { describe, expect, it } from "vitest";
import { parseEvent } from "@olb/contract";
import type { Lineup, Player } from "../../src/lib/scorer/types";
import {
  ballInPlay,
  context,
  ejection,
  gameEnd,
  gameResume,
  gameStart,
  gameSuspend,
  inningEnd,
  interference,
  lineupSet,
  pitch,
  revision,
  runner,
  substitution,
  voidEvent,
} from "../../src/lib/scorer/events";
import { uuid7 } from "../../src/lib/scorer/uuid7";

const gameId = uuid7();
const actorId = "actor-1";

function player(slot: number, position: Player["position"]): Player {
  return { id: uuid7(), name: `Jugador ${slot}`, position, battingSlot: slot };
}

const players = [
  player(1, "1"),
  player(2, "2"),
  player(3, "3"),
  player(4, "4"),
  player(5, "5"),
  player(6, "6"),
  player(7, "7"),
  player(8, "8"),
  player(9, "9"),
];

const lineup: Lineup = { team: "home", players, pitcherId: players[0]!.id };

describe("event builders", () => {
  it("builds contract-valid events for every type", () => {
    const started = gameStart(gameId, 0, { venue: "Campo 1" });
    const set = lineupSet(gameId, 1, lineup);
    const ball = pitch(gameId, 2, {
      pitchNo: 1,
      batter: players[0]!.id,
      pitcher: players[1]!.id,
      count: { balls: 3, strikes: 2 },
      call: "B",
    });
    const contact = ballInPlay(gameId, 3, {
      batter: players[1]!.id,
      code: "S8",
      runsBattedIn: 1,
      fielders: [{ player: players[6]!.id, position: "8", role: "putout" }],
      runnersAdvanced: [{ player: players[1]!.id, from: "B", to: "1" }],
    });
    const steal = runner(gameId, 4, {
      player: players[1]!.id,
      from: "1",
      to: "2",
      kind: "steal",
      out: false,
    });
    const ended = inningEnd(gameId, 5, {
      inning: 1,
      half: "top",
      runsScored: 1,
      outs: 3,
    });
    const finished = gameEnd(gameId, 6, {
      reason: "completed",
      finalScore: { home: 2, away: 1 },
    });
    const corrected = revision(
      context(gameId, 7, actorId),
      started,
      pitch(gameId, 7, {
        pitchNo: 2,
        batter: players[2]!.id,
        pitcher: players[1]!.id,
        count: { balls: 0, strikes: 0 },
        call: "C",
      }),
    );
    const voided = voidEvent(gameId, 8, ball, "data_entry");

    const events = [started, set, ball, contact, steal, ended, finished, corrected, voided];
    for (const event of events) {
      expect(() => parseEvent(event)).not.toThrow();
    }

    expect(eventIdentity(corrected, started)).toBe(started.id);
    if (voided.type === "amendment") {
      expect(voided.payload.targetSeq).toBe(ball.seq);
      expect(voided.payload.replacement).toBeNull();
      expect(voided.revisionOf).toBe(ball.id);
    }
  });

  it("accepts a shortened game end as a final result", () => {
    const shortened = gameEnd(gameId, 20, {
      reason: "shortened",
      finalScore: { home: 2, away: 1 },
    });
    expect(() => parseEvent(shortened)).not.toThrow();
    expect(shortened.type).toBe("game.end");
  });

  it("builds the 0.2 play and game-control events", () => {
    const hitByPitch = pitch(gameId, 10, {
      pitchNo: 1,
      batter: players[0]!.id,
      pitcher: players[1]!.id,
      count: { balls: 0, strikes: 0 },
      call: "H",
    });
    const intentional = pitch(gameId, 11, {
      pitchNo: 2,
      batter: players[0]!.id,
      pitcher: players[1]!.id,
      count: { balls: 0, strikes: 0 },
      call: "I",
    });
    const catcher = interference(gameId, 12, { batter: players[0]!.id });
    const placed = runner(gameId, 13, {
      player: players[2]!.id,
      from: "bench",
      to: "2",
      kind: "placed",
      out: false,
    });
    const courtesy = substitution(gameId, 14, {
      team: "away",
      playerIn: players[3]!.id,
      playerOut: players[2]!.id,
      position: "PR",
      battingSlot: 3,
      reason: "courtesy",
    });
    const reentry = substitution(gameId, 15, {
      team: "home",
      playerIn: players[4]!.id,
      playerOut: players[5]!.id,
      position: "7",
      battingSlot: 6,
      reason: "reentry",
      reentry: true,
    });
    const suspended = gameSuspend(gameId, 16, { reason: "Lluvia" });
    const resumed = gameResume(gameId, 17, {});
    const ejected = ejection(gameId, 18, {
      person: players[6]!.id,
      role: "manager",
      reason: "Protesta",
    });

    for (const event of [
      hitByPitch,
      intentional,
      catcher,
      placed,
      courtesy,
      reentry,
      suspended,
      resumed,
      ejected,
    ]) {
      expect(() => parseEvent(event)).not.toThrow();
    }

    if (courtesy.type === "substitution") {
      expect(courtesy.payload.reason).toBe("courtesy");
    }
    if (reentry.type === "substitution") {
      expect(reentry.payload.reason).toBe("reentry");
      expect(reentry.payload.reentry).toBe(true);
    }
    if (catcher.type === "interference") {
      expect(catcher.payload.kind).toBe("catcher");
    }
  });

  it("rejects a placed runner that is not entering from the bench", () => {
    expect(() =>
      runner(gameId, 1, {
        player: players[0]!.id,
        from: "1",
        to: "2",
        kind: "placed",
        out: false,
      }),
    ).toThrow(RangeError);
  });

  it("rejects an ejection without a reason", () => {
    expect(() =>
      ejection(gameId, 1, {
        person: players[0]!.id,
        role: "player",
        reason: "  ",
      }),
    ).toThrow(RangeError);
  });

  it("takes the batting order from the slots, not the array", () => {
    const shuffled: Lineup = {
      ...lineup,
      players: [...players].reverse(),
    };
    const event = lineupSet(gameId, 1, shuffled);
    if (event.type !== "lineup.set") throw new Error("expected lineup.set");
    expect(event.payload.battingOrder.map((entry) => entry.player)).toEqual(
      players.map((entry) => entry.id),
    );
  });

  it("only writes revisionOf when it is passed", () => {
    const plain = context(gameId, 0, actorId);
    expect("revisionOf" in plain).toBe(false);

    const explicit = context(gameId, 0, actorId, null);
    expect("revisionOf" in explicit).toBe(true);
    expect(explicit.revisionOf).toBeNull();
  });

  it("rejects counts outside 0–3 balls and 0–2 strikes", () => {
    const base = {
      pitchNo: 1,
      batter: players[0]!.id,
      pitcher: players[1]!.id,
      call: "B" as const,
    };

    expect(() => pitch(gameId, 1, { ...base, count: { balls: 4, strikes: 0 } })).toThrow(
      RangeError,
    );
    expect(() => pitch(gameId, 1, { ...base, count: { balls: 0, strikes: 3 } })).toThrow(
      RangeError,
    );
    expect(() => pitch(gameId, 1, { ...base, count: { balls: -1, strikes: 0 } })).toThrow(
      RangeError,
    );
  });

  it("rejects runs batted in outside 0–4 and outs outside 1–3", () => {
    expect(() =>
      ballInPlay(gameId, 1, { batter: players[0]!.id, code: "HR", runsBattedIn: 5 }),
    ).toThrow(RangeError);
    expect(() =>
      ballInPlay(gameId, 1, { batter: players[0]!.id, code: "HR", runsBattedIn: -1 }),
    ).toThrow(RangeError);

    expect(() =>
      inningEnd(gameId, 1, { inning: 1, half: "top", runsScored: 0, outs: 0 }),
    ).toThrow(RangeError);
    expect(() =>
      inningEnd(gameId, 1, { inning: 1, half: "top", runsScored: 0, outs: 4 }),
    ).toThrow(RangeError);
  });
});

function eventIdentity(event: { revisionOf?: string | null }, original: { id: string }) {
  expect(event.revisionOf).toBe(original.id);
  return event.revisionOf;
}
