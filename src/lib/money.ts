// All money is integer paise. These helpers are the only place rupees appear.

const inr = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });
const inrPaise = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 2 });

/** 200000 → "₹2,000", 12345 → "₹123.45" (paise shown only when there are any) */
export const formatPaise = (paise: number) => (paise % 100 === 0 ? inr : inrPaise).format(paise / 100);

/** "2000" → 200000, "123.4" → 12340. Null if not a plain non-negative rupee amount (max 2 decimals). No float maths. */
export function rupeesToPaise(input: string): number | null {
  const m = /^(\d{1,9})(?:\.(\d{1,2}))?$/.exec(input.trim());
  if (!m) return null;
  return Number(m[1]) * 100 + Number((m[2] ?? "").padEnd(2, "0"));
}

/** 200000 → "2000", 12340 → "123.40", for form default values. */
export const paiseToRupees = (paise: number) =>
  paise % 100 === 0 ? String(paise / 100) : `${Math.floor(paise / 100)}.${String(paise % 100).padStart(2, "0")}`;
