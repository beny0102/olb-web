import { describe, expect, it } from "vitest";
import {
  isScorePath,
  SCORE_BASE_PATH,
  SCORE_CACHE_NAME,
  scoreCacheName,
  SCORE_SW_PATH,
} from "@/lib/score";

describe("score path scope", () => {
  it("accepts the score index and its children", () => {
    expect(isScorePath("/score")).toBe(true);
    expect(isScorePath("/score/")).toBe(true);
    expect(isScorePath("/score/demo-game")).toBe(true);
    expect(isScorePath("/score/a/b")).toBe(true);
  });

  it("rejects portal, admin and lookalike paths", () => {
    expect(isScorePath("/")).toBe(false);
    expect(isScorePath("/admin")).toBe(false);
    expect(isScorePath("/admin/score")).toBe(false);
    expect(isScorePath("/scoreboard")).toBe(false);
    expect(isScorePath("/scoreboard/live")).toBe(false);
    expect(isScorePath("")).toBe(false);
  });
});

describe("score cache naming", () => {
  it("uses a versioned cache name", () => {
    expect(SCORE_CACHE_NAME).toBe("olb-score-shell-v1");
    expect(scoreCacheName("v2")).toBe("olb-score-shell-v2");
    expect(scoreCacheName()).toBe(SCORE_CACHE_NAME);
  });

  it("keeps the worker inside /score", () => {
    expect(SCORE_BASE_PATH).toBe("/score");
    expect(SCORE_SW_PATH).toBe("/score/sw.js");
  });
});
