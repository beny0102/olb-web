import { isEvent } from "@olb/contract";
import { describe, expect, it } from "vitest";
import { demoEvents, demoState } from "@/lib/demo";

describe("demo game", () => {
  it("keeps sequence numbers contiguous from zero", () => {
    expect(demoEvents.map((event) => event.seq)).toEqual(
      demoEvents.map((_, index) => index),
    );
  });

  it("validates every event against the published contract", () => {
    for (const event of demoEvents) {
      expect(isEvent(event), `seq ${event.seq} (${event.type}) is invalid`).toBe(true);
    }
  });

  it("folds the recorded log into the expected state", () => {
    expect(demoState).toMatchObject({
      status: "live",
      inning: 1,
      half: "bottom",
      battingTeam: "home",
      outs: 0,
      score: { away: 1, home: 0 },
      count: { balls: 0, strikes: 0 },
      lastSeq: 10,
    });
  });
});
