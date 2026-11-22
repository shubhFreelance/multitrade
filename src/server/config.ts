import { db } from "@/lib/db";

export type Company = { name: string; cin: string; address: string; registrations: string[] };

/** Legal details for invoices and the footer, from the `company` config value. */
export async function getCompany(): Promise<Company> {
  const row = await db.config.findUnique({ where: { key: "company" } });
  return { name: "Saksham Multitrade Pvt Ltd", cin: "", address: "", registrations: [], ...(row?.value as Partial<Company> | undefined) };
}

/** A whole-number config value, or `fallback` if it is missing or not a number. */
export async function getConfigInt(key: string, fallback: number): Promise<number> {
  const v = (await db.config.findUnique({ where: { key } }))?.value;
  return typeof v === "number" && Number.isInteger(v) ? v : fallback;
}
