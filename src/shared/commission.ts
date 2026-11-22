import { z } from "zod";

// A scheme's commission rule, stored as JSON on the scheme. Money in paise, percentages in basis points.
export const commissionRuleSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("FLAT"), amount: z.number().int().min(0) }),
  z.object({ type: z.literal("PERCENT"), bps: z.number().int().min(0).max(10_000) }),
  z.object({ type: z.literal("TIER"), tiers: z.array(z.unknown()) }),
]);
export type CommissionRule = z.infer<typeof commissionRuleSchema>;

/**
 * Commission for one paid installment. `ruleMissing` means the amount can't be worked out yet
 * (Upahar tiers depend on a tier table the client hasn't sent: OPEN_QUESTIONS #3), so it is ₹0 and flagged.
 */
export function commissionFor(rule: unknown, installmentAmount: number): { amount: number; ruleMissing: boolean } {
  const r = commissionRuleSchema.safeParse(rule);
  if (!r.success) return { amount: 0, ruleMissing: true };
  switch (r.data.type) {
    case "FLAT":
      return { amount: r.data.amount, ruleMissing: false };
    case "PERCENT":
      // Rounded down to the paisa: never pay out a fraction that wasn't earned.
      return { amount: Math.floor((installmentAmount * r.data.bps) / 10_000), ruleMissing: false };
    case "TIER":
      return { amount: 0, ruleMissing: true };
  }
}

/** TDS on a commission total, rounded to the nearest paisa. */
export const tdsFor = (gross: number, tdsBps: number) => Math.round((gross * tdsBps) / 10_000);
