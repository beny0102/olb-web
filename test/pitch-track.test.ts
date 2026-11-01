import { describe, expect, it } from "vitest";
import { buildPitch } from "@/lib/pitch-track";

describe("buildPitch", () => {
  it("starts at the release point and ends at the plate", () => {
    const { samples } = buildPitch("S");
    const first = samples[0]!;
    const last = samples[samples.length - 1]!;

    expect(samples).toHaveLength(32);
    expect(first.p[1]).toBeCloseTo(18, 1);
    expect(last.p[1]).toBeCloseTo(0, 5);
  });

  it("keeps the ball between the mound and the plate, above the ground", () => {
    for (const call of ["B", "S", "F", "X"]) {
      for (const sample of buildPitch(call).samples) {
        expect(sample.p[1]).toBeGreaterThanOrEqual(0);
        expect(sample.p[1]).toBeLessThanOrEqual(18);
        expect(sample.p[2]).toBeGreaterThan(0.3);
      }
    }
  });

  it("sends a ball outside the zone and a strike over the plate", () => {
    const ball = buildPitch("B").samples.at(-1)!;
    const strike = buildPitch("S").samples.at(-1)!;

    expect(Math.abs(ball.p[0])).toBeGreaterThan(0.43);
    expect(Math.abs(strike.p[0])).toBeLessThan(0.43);
  });
});
