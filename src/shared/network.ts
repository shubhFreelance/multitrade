import { z } from "zod";

// Report periods for agent and admin tracking. Weeks start on Monday; all dates are India time.
export const periods = ["week", "month", "all"] as const;
export type Period = (typeof periods)[number];
export const periodInput = z.enum(periods).catch("month"); // unknown or missing → this month

/** When the period began, as an instant (midnight India time), for `today` ("YYYY-MM-DD" in India). */
export function periodStart(period: Period, today: string): Date {
  if (period === "all") return new Date(0);
  const day = period === "month" ? `${today.slice(0, 8)}01` : mondayOf(today);
  return new Date(`${day}T00:00:00+05:30`);
}

const mondayOf = (today: string) => {
  const d = new Date(`${today}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
};

// Members tab: who joined on their own, and who an agent enrolled.
export const memberSources = ["direct", "agent"] as const;
export type MemberSource = (typeof memberSources)[number];
export const memberSourceInput = z.enum(memberSources).catch("direct");

// Agents tab filter.
export const agentFilters = ["all", "approved", "waiting", "suspended"] as const;
export type AgentFilter = (typeof agentFilters)[number];
export const agentFilterInput = z.enum(agentFilters).catch("all");
