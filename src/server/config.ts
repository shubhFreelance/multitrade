import { db } from "@/lib/db";

export type Company = { name: string; cin: string; address: string; registrations: string[] };

/** Legal details for receipts and the footer, from the `company` config value. */
export async function getCompany(): Promise<Company> {
  const row = await db.config.findUnique({ where: { key: "company" } });
  return { name: "Saksham Multitrade Pvt Ltd", cin: "", address: "", registrations: [], ...(row?.value as Partial<Company> | undefined) };
}
