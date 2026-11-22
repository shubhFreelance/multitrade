import { z } from "zod";
import { otpSchema, phoneSchema } from "./auth";
import { batchLabel, type SchemeCode } from "./catalog";

export const enrolCodeInput = z.object({ phone: phoneSchema, batchId: z.string().min(1) });

export const enrolConfirmInput = enrolCodeInput.extend({
  code: otpSchema,
  // Needed only when the phone is new; ignored for an existing member.
  name: z.string().trim().min(2).max(100).optional(),
  village: z.string().trim().min(1).max(100).optional(),
  address: z.string().trim().min(1).max(300).optional(),
  nominee: z.string().trim().max(100).optional(),
});

export type EnrolConfirm = z.infer<typeof enrolConfirmInput>;

/** UPH-B03-0457 */
export const tokenNumber = (code: SchemeCode, batchNumber: number, seq: number) =>
  `${batchLabel(code, batchNumber)}-${String(seq).padStart(4, "0")}`;

// POST /api/v1/agent/enrolments response
export type EnrolmentResult = { id: string; tokenNumber: string; installments: number };
