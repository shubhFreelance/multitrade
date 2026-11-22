// Recruitment campaign rules. Pure: shared by web, API and the mobile app.
import { z } from "zod";

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD");
const tier = z.object({ enrolments: z.number().int().min(1).max(100_000), bonus: z.number().int().min(1).max(100_000_00) });

export const campaignInput = z
  .object({
    start: day,
    end: day,
    countsAfterPaidInstallments: z.number().int().min(1).max(12),
    tiers: z.array(tier).min(1).max(10),
  })
  .refine((c) => c.start <= c.end, { message: "The campaign must end on or after its start", path: ["end"] })
  .refine((c) => c.tiers.every((t, i) => i === 0 || (t.enrolments > c.tiers[i - 1].enrolments && t.bonus > c.tiers[i - 1].bonus)), {
    message: "Each tier needs more enrolments and a bigger bonus than the one before",
    path: ["tiers"],
  });
export type Campaign = z.infer<typeof campaignInput>;
export type Tier = Campaign["tiers"][number];

/** One award per agent per campaign is keyed by its dates. */
export const campaignKey = (c: Campaign) => `${c.start}/${c.end}`;

/** The highest tier reached (the agent gets only that one, not the sum), and the next one to aim for. */
export function tierProgress(count: number, tiers: Tier[]) {
  const reached = tiers.filter((t) => count >= t.enrolments).at(-1) ?? null;
  const next = tiers.find((t) => count < t.enrolments) ?? null;
  return { count, reached, next, toNext: next ? next.enrolments - count : 0 };
}
