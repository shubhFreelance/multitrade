import { z } from "zod";

export const exportKinds = ["enrolments", "payments", "commission", "agents"] as const;
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
// GET /api/v1/admin/exports/:kind?from=&to= (India dates, both included; default this month; ignored for enrolments and agents)
export const exportInput = z.object({ kind: z.enum(exportKinds), from: day.optional(), to: day.optional() });
