import { describe, expect, it } from "vitest";
import { formatPaise, paiseToRupees, rupeesToPaise } from "./money";

describe("money", () => {
  it("parses rupees to exact paise", () => {
    expect(rupeesToPaise("2000")).toBe(200000);
    expect(rupeesToPaise("123.4")).toBe(12340);
    expect(rupeesToPaise("0.07")).toBe(7);
    expect(rupeesToPaise(" 19.99 ")).toBe(1999);
  });

  it("rejects anything that isn't a plain rupee amount", () => {
    for (const bad of ["", "-5", "1.234", "1e3", "abc", "1,000", "."]) expect(rupeesToPaise(bad)).toBeNull();
  });

  it("round-trips paise through the form value", () => {
    for (const p of [0, 7, 1999, 12340, 200000]) expect(rupeesToPaise(paiseToRupees(p))).toBe(p);
  });

  it("formats in Indian style", () => {
    expect(formatPaise(200000)).toBe("₹2,000");
    expect(formatPaise(25000000)).toBe("₹2,50,000");
    expect(formatPaise(12345)).toBe("₹123.45");
  });
});
