import { z } from "zod";

// POST /api/v1/admin/draws: the month is named so a repeated tap fails instead of running the next month's draw.
export const runDrawInput = z.object({ batchId: z.string().min(1), monthNo: z.number().int().min(1).max(60) });
