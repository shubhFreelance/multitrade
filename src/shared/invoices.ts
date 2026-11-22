import { z } from "zod";

export const invoicePeriodInput = z.object({ period: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Use YYYY-MM") });
export const markPaidInput = z.object({ utr: z.string().trim().regex(/^[A-Za-z0-9]{6,30}$/, "Enter the bank transfer reference (UTR)") });
