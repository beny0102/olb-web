import { describe, expect, it } from "vitest";
import { proposalLabel } from "../../src/lib/scorer/proposals";

describe("proposalLabel", () => {
  it("labels every pitch call in Spanish", () => {
    expect(proposalLabel({ kind: "pitch", call: "B" })).toBe("Bola");
    expect(proposalLabel({ kind: "pitch", call: "C" })).toBe("Strike");
    expect(proposalLabel({ kind: "pitch", call: "S" })).toBe("Strike");
    expect(proposalLabel({ kind: "pitch", call: "F" })).toBe("Foul");
    expect(proposalLabel({ kind: "pitch", call: "T" })).toBe("Foul tip");
  });

  it("labels every outcome code", () => {
    expect(proposalLabel({ kind: "outcome", code: "out" })).toBe("Out");
    expect(proposalLabel({ kind: "outcome", code: "1B" })).toBe("1B");
    expect(proposalLabel({ kind: "outcome", code: "2B" })).toBe("2B");
    expect(proposalLabel({ kind: "outcome", code: "3B" })).toBe("3B");
    expect(proposalLabel({ kind: "outcome", code: "HR" })).toBe("HR");
    expect(proposalLabel({ kind: "outcome", code: "E" })).toBe("Error");
    expect(proposalLabel({ kind: "outcome", code: "FC" })).toBe("FC");
  });
});
