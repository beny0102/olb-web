import { describe, expect, it } from "vitest";
import type { Event } from "@olb/contract/types";
import {
  deriveLinescore,
  describeLastPlay,
  previewStatus,
  teamAbbr,
} from "../../src/lib/scorer/preview";
import { initialState } from "../../src/lib/scorer/fold";

const gameId = "0192f3a0-5b11-7a02-8f3c-1c9d2e3f4a50";
const batter = "0192f3a2-0001-7000-8000-000000000001";
const pitcher = "0192f3a2-0001-7000-8000-000000000002";

function event(seq: number, type: string, payload: unknown = {}): Event {
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

const start = (seq = 0) => event(seq, "game.start");

const inningEnd = (seq: number, inning: number, half: "top" | "bottom", runsScored: number) =>
  event(seq, "inning.end", { inning, half, runsScored, outs: 3 });

const pitch = (seq: number, call: string) =>
  event(seq, "pitch", {
    pitchNo: seq,
    batter,
    pitcher,
    count: { balls: 0, strikes: 0 },
    call,
  });

describe("deriveLinescore", () => {
  it("returns an empty linescore without closed innings", () => {
    expect(deriveLinescore([start()])).toEqual({
      innings: [],
      awayTotal: 0,
      homeTotal: 0,
      hasData: false,
    });
  });

  it("keeps unclosed halves null and totals the closed ones", () => {
    const line = deriveLinescore([
      start(),
      inningEnd(1, 1, "top", 1),
      inningEnd(2, 1, "bottom", 0),
      inningEnd(3, 2, "top", 2),
    ]);

    expect(line.innings).toEqual([
      { inning: 1, away: 1, home: 0 },
      { inning: 2, away: 2, home: null },
    ]);
    expect(line.awayTotal).toBe(3);
    expect(line.homeTotal).toBe(0);
    expect(line.hasData).toBe(true);
  });

  it("drops a half inning voided by an amendment, as undo does", () => {
    const line = deriveLinescore([
      start(),
      inningEnd(1, 1, "top", 2),
      event(2, "amendment", { targetSeq: 1, replacement: null }),
    ]);

    expect(line.innings).toEqual([]);
    expect(line.hasData).toBe(false);
  });
});

describe("describeLastPlay", () => {
  it("says there are no plays yet on an empty log", () => {
    expect(describeLastPlay([])).toBe("Sin jugadas todavía");
  });

  it("maps a pitch call to Spanish", () => {
    expect(describeLastPlay([start(), pitch(1, "B")])).toBe("Bola");
    expect(describeLastPlay([start(), pitch(1, "C")])).toBe("Strike cantado");
    expect(describeLastPlay([start(), pitch(1, "F")])).toBe("Foul");
  });

  it("prefers the description a ball in play already carries", () => {
    const play = event(1, "ball_in_play", {
      batter,
      code: "6-3/G",
      runsBattedIn: 0,
      description: "Rodado al campocorto, out en primera",
    });
    expect(describeLastPlay([start(), play])).toBe(
      "Rodado al campocorto, out en primera",
    );
  });

  it("falls back to the play code when there is no description", () => {
    const out = event(1, "ball_in_play", {
      batter,
      code: "6-3/G",
      runsBattedIn: 0,
    });
    expect(describeLastPlay([start(), out])).toBe("Out en primera");

    const single = event(1, "ball_in_play", {
      batter,
      code: "S8",
      runsBattedIn: 0,
    });
    expect(describeLastPlay([start(), single])).toBe("Sencillo");
  });

  it("labels a closed half as Cambio", () => {
    expect(describeLastPlay([start(), inningEnd(1, 1, "top", 0)])).toBe("Cambio");
  });

  it("names the runner when the map has an id", () => {
    const steal = event(1, "runner", {
      player: "runner-1",
      from: "1",
      to: "2",
      kind: "steal",
      out: false,
    });
    expect(describeLastPlay([start(), steal], { "runner-1": "Ana" })).toBe(
      "Robo de base · Ana",
    );
  });

  it("skips an amendment so undo falls back to the previous play", () => {
    const out = event(1, "ball_in_play", {
      batter,
      code: "6-3/G",
      runsBattedIn: 0,
    });
    const single = event(2, "ball_in_play", {
      batter,
      code: "S8",
      runsBattedIn: 0,
    });
    const undo = event(3, "amendment", {
      targetSeq: 2,
      replacement: null,
    });
    expect(describeLastPlay([start(), out, single, undo])).toBe("Out en primera");
  });
});

describe("previewStatus", () => {
  it("maps every projection status to the three public chips", () => {
    expect(previewStatus(initialState)).toBe("scheduled");
    expect(previewStatus({ status: "live" })).toBe("live");
    expect(previewStatus({ status: "suspended" })).toBe("live");
    expect(previewStatus({ status: "final" })).toBe("final");
    expect(previewStatus({ status: "forfeit" })).toBe("final");
  });
});

describe("teamAbbr", () => {
  it("mirrors the viewer club mark", () => {
    expect(teamAbbr("Tiburones")).toBe("TIB");
    expect(teamAbbr("Faros del Puerto")).toBe("FDP");
    expect(teamAbbr("Club Tiburones del Puerto")).toBe("CTD");
  });
});
