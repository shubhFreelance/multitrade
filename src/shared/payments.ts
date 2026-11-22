import { z } from "zod";

export const startPaymentInput = z.object({ installmentId: z.string().min(1) });
export const testOutcomeInput = z.object({ status: z.enum(["SUCCESS", "FAILED"]) });

// POST /api/v1/me/payments response. Send the member to checkoutUrl.
export type StartPaymentResult = { paymentId: string; orderId: string; checkoutUrl: string };
