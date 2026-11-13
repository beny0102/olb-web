import { describe, expect, it } from "vitest";
import { uuid7 } from "../../src/lib/scorer/uuid7";

const UUID7 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe("uuid7", () => {
  it("matches the RFC 9562 v7 shape", () => {
    const id = uuid7();
    expect(id).toMatch(UUID7);
    expect(id[14]).toBe("7");
    expect("89ab").toContain(id[19]);
  });

  it("is lowercase and unique", () => {
    const ids = new Set(Array.from({ length: 100 }, () => uuid7()));
    expect(ids.size).toBe(100);
    for (const id of ids) expect(id).toBe(id.toLowerCase());
  });

  it("sorts by timestamp when generated 5 ms apart", () => {
    const base = Date.UTC(2026, 3, 11, 23, 41, 7, 412);
    const earlier = uuid7(base);
    const later = uuid7(base + 5);
    expect(earlier < later).toBe(true);

    const timestamp = (id: string) => Number.parseInt(id.slice(0, 8) + id.slice(9, 13), 16);
    expect(timestamp(earlier)).toBe(base);
    expect(timestamp(later)).toBe(base + 5);
  });
});
