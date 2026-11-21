import { z } from "zod";

export const schemeCodes = ["UPAHAR", "MANPASAND", "GOLD"] as const;
export type SchemeCode = (typeof schemeCodes)[number];

export const batchStatuses = ["OPEN", "RUNNING", "CLOSED"] as const; // in order: status only moves forward
export type BatchStatus = (typeof batchStatuses)[number];

/** Prefix of token numbers, e.g. UPH-B03-0457. */
export const schemePrefix: Record<SchemeCode, string> = { UPAHAR: "UPH", MANPASAND: "MNP", GOLD: "GLD" };
export const batchLabel = (code: SchemeCode, number: number) => `${schemePrefix[code]}-B${String(number).padStart(2, "0")}`;

const paise = z.number().int().positive().max(100_000_000_00); // up to ₹10 crore
const name = z.string().trim().min(1).max(100);
const month = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Use YYYY-MM"); // e.g. "2026-12"

export const schemeUpdateInput = z
  .object({ nameEn: name, nameHi: name, installmentAmount: paise, tenureMonths: z.number().int().min(1).max(60) })
  .partial();

export const batchCreateInput = z.object({
  schemeId: z.string().min(1),
  startMonth: month,
  size: z.number().int().min(1).max(100_000),
  winnersPerDraw: z.number().int().min(0).max(10_000),
});

export const batchUpdateInput = batchCreateInput
  .omit({ schemeId: true })
  .extend({ status: z.enum(batchStatuses) })
  .partial();

const productFields = z.object({
  name,
  nameHi: name.optional(),
  price: paise,
  schemes: z.array(z.enum(schemeCodes)).min(1, "Pick at least one scheme"),
  stock: z.number().int().min(0).max(1_000_000),
  active: z.boolean(),
});

export const productCreateInput = productFields.extend({ active: z.boolean().default(true) });
// Not derived from productCreateInput: zod 4 applies defaults inside .partial(), which would re-activate products on every edit.
export const productUpdateInput = productFields.partial();

export type SchemeUpdate = z.infer<typeof schemeUpdateInput>;
export type BatchCreate = z.infer<typeof batchCreateInput>;
export type BatchUpdate = z.infer<typeof batchUpdateInput>;
export type ProductCreate = z.infer<typeof productCreateInput>;
export type ProductUpdate = z.infer<typeof productUpdateInput>;
