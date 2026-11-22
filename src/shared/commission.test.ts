import { describe, expect, it } from "vitest";
import { commissionFor, tdsFor } from "./commission";

describe("commission per paid installment", () => {
  it("Manpasand: flat ₹50", () => {
    expect(commissionFor({ type: "FLAT", amount: 50_00 }, 2_000_00)).toEqual({ amount: 50_00, ruleMissing: false });
  });

  it("Gold: 1% of the installment, exact to the paisa", () => {
    expect(commissionFor({ type: "PERCENT", bps: 100 }, 2_000_00)).toEqual({ amount: 20_00, ruleMissing: false });
    expect(commissionFor({ type: "PERCENT", bps: 100 }, 1_999_99).amount).toBe(19_99); // 1999.99 paise rounds down
  });

  it("Upahar: ₹0 and flagged until the tier table arrives", () => {
    expect(commissionFor({ type: "TIER", tiers: [] }, 2_000_00)).toEqual({ amount: 0, ruleMissing: true });
  });

  it("a malformed rule is flagged rather than guessed", () => {
    expect(commissionFor({ type: "FLAT" }, 2_000_00)).toEqual({ amount: 0, ruleMissing: true });
    expect(commissionFor(null, 2_000_00)).toEqual({ amount: 0, ruleMissing: true });
  });
});

describe("TDS", () => {
  it("2% of a commission total, rounded to the paisa", () => {
    expect(tdsFor(1_500_00, 200)).toBe(30_00);
    expect(tdsFor(1_234_57, 200)).toBe(24_69); // 2469.14 paise
    expect(tdsFor(0, 200)).toBe(0);
  });
});
