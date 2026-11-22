import { describe, expect, it } from "vitest";
import { rhythmThisMonth } from "./rhythm";

describe("rhythmThisMonth", () => {
  it("counts per India day of the current month and sums amounts", () => {
    const r = rhythmThisMonth(
      [
        { at: new Date("2026-11-01T00:00:00+05:30"), amount: 100 },
        { at: new Date("2026-11-30T23:59:00+05:30"), amount: 50 },
        { at: new Date("2026-11-30T18:31:00Z"), amount: 7 }, // 1 Dec in India: not this month
        { at: new Date("2026-10-31T18:29:00Z"), amount: 9 }, // 31 Oct in India
      ],
      "2026-11-22",
    );
    expect(r.counts).toHaveLength(30);
    expect([r.counts[0], r.counts[29], r.total, r.count, r.today]).toEqual([1, 1, 150, 2, 22]);
  });
});
