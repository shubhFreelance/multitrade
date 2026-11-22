// Price maths for fulfilment, in paise. Pure: shared by web, API and the mobile app.
import { z } from "zod";

export const GOLD_PURITY = "22K"; // CONFIRM #20: one purity for now

/**
 * Gold price on the day: rate × weight, plus making charges, plus GST on both.
 * Each part is rounded to the paisa once, so the parts always add up to the total.
 */
export function goldPrice({ ratePerGram, weightMg, making, gstBps }: { ratePerGram: number; weightMg: number; making: number; gstBps: number }) {
  const gold = Math.round((ratePerGram * weightMg) / 1000);
  const gst = Math.round(((gold + making) * gstBps) / 10_000);
  return { ratePerGram, weightMg, gold, making, gstBps, gst, total: gold + making + gst };
}
export type GoldPrice = ReturnType<typeof goldPrice>;

/** What the member pays on top of what their plan is worth. Never negative: a cheaper item is no refund (CONFIRM #18). */
export const differenceDue = (price: number, planValue: number) => Math.max(0, price - planValue);

/** "10", "10.5", "10.250" grams → milligrams; null if not a weight with up to 3 decimals. */
export function gramsToMg(input: string): number | null {
  const m = /^(\d{1,4})(?:\.(\d{1,3}))?$/.exec(input.trim());
  if (!m) return null;
  return Number(m[1]) * 1000 + Number((m[2] ?? "").padEnd(3, "0"));
}

const paise = z.number().int().min(0).max(100_000_000_00);
export const goldRateInput = z.object({
  day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(), // default: today in India
  ratePerGram: paise.min(1),
});
// Upahar: productId (the company picks). Manpasand: nothing (the member chose). Gold: weightMg and making.
export const allocateInput = z.object({
  productId: z.string().min(1).optional(),
  weightMg: z.number().int().min(1).max(10_000_000).optional(),
  making: paise.optional(),
});
export const differencePaidInput = z.object({ ref: z.string().trim().min(4).max(40) });
