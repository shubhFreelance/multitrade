// Price maths for fulfilment, in paise. Pure: shared by web, API and the mobile app.
import { z } from "zod";

export const GOLD_PURITY = "22K"; // one daily rate, 22K (client, #20)

/**
 * Gold price on the day: rate × weight, plus making charges, plus GST: 3% on the gold and 5% on the making charges
 * (settings goldGstBps and makingGstBps; client, #20). Each part is rounded to the paisa once, so the parts add up to the total.
 */
export function goldPrice(p: { ratePerGram: number; weightMg: number; making: number; goldGstBps: number; makingGstBps: number }) {
  const gold = Math.round((p.ratePerGram * p.weightMg) / 1000);
  const goldGst = Math.round((gold * p.goldGstBps) / 10_000);
  const makingGst = Math.round((p.making * p.makingGstBps) / 10_000);
  return { ...p, gold, goldGst, makingGst, gst: goldGst + makingGst, total: gold + p.making + goldGst + makingGst };
}
export type GoldPrice = ReturnType<typeof goldPrice>;

/** What the member pays on top of what they have paid. Never negative: a cheaper item is no refund (CONFIRM #4). */
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
