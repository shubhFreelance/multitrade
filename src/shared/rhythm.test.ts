import { describe, expect, it } from "vitest";
import { bucketed, bucketsFor, rhythmThisMonth } from "./rhythm";

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

describe("bucketsFor / bucketed", () => {
  it("week runs Monday to Sunday, month covers its days, all time the last 12 months", () => {
    expect(bucketsFor("week", "2026-11-22").keys).toEqual(["2026-11-16", "2026-11-17", "2026-11-18", "2026-11-19", "2026-11-20", "2026-11-21", "2026-11-22"]);
    expect(bucketsFor("month", "2026-11-22").keys).toHaveLength(30);
    expect(bucketsFor("all", "2026-11-22").keys).toEqual(["2025-12", "2026-01", "2026-02", "2026-03", "2026-04", "2026-05", "2026-06", "2026-07", "2026-08", "2026-09", "2026-10", "2026-11"]);
  });
  it("sums into the right bucket in India time", () => {
    const r = bucketed("all", [{ at: new Date("2026-10-31T19:00:00Z"), amount: 5 }, { at: new Date("2024-01-01T00:00:00Z"), amount: 9 }], "2026-11-22");
    expect(r.totals.at(-1)).toBe(5); // 1 Nov in India
    expect(r.totals.reduce((a, b) => a + b, 0)).toBe(5); // too old: left out
  });
});
