import { z } from "zod";

// POST /api/v1/me/completions/:id: address for Upahar and Manpasand, productId for Manpasand, nothing for Gold.
export const confirmFulfilmentInput = z.object({
  address: z.string().trim().min(5).max(300).optional(),
  productId: z.string().min(1).optional(),
});
