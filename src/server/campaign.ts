// Recruitment campaigns: agents who enrol enough paying members in the campaign window get a bonus commission.
import { db } from "@/lib/db";
import type { SessionUser } from "@/shared/auth";
import { campaignInput, campaignKey, tierProgress, type Campaign } from "@/shared/campaign";
import { todayInIndia } from "@/shared/tracker";
import { audit } from "./audit";
import { requireRole } from "./auth";
import { AppError } from "./errors";

/** The campaign in settings, or null if there is none (or it is invalid). */
export async function getCampaign(): Promise<Campaign | null> {
  const row = await db.config.findUnique({ where: { key: "recruitmentCampaign" } });
  const parsed = campaignInput.safeParse(row?.value);
  return parsed.success ? parsed.data : null;
}

/** Midnight India time at the start of `day`, and at the start of the day after `end`. */
const startOf = (day: string) => new Date(`${day}T00:00:00+05:30`);
const afterEnd = (day: string) => new Date(startOf(day).getTime() + 864e5);

/**
 * Enrolments that count, per agent: made in the campaign window, with at least `countsAfterPaidInstallments`
 * confirmed payments by the end of its last day. Members who joined on their own count for nobody.
 */
async function countsByAgent(c: Campaign, agentId?: string) {
  const from = startOf(c.start);
  const to = afterEnd(c.end);
  const rows = await db.$queryRaw<{ agentId: string; n: bigint }[]>`
    select e."agentId", count(*) as n from "Enrolment" e
    where e."agentId" is not null and e."createdAt" >= ${from} and e."createdAt" < ${to}
      and (${agentId ?? null}::text is null or e."agentId" = ${agentId ?? null})
      and (select count(*) from "Payment" p join "Installment" i on i.id = p."installmentId"
           where i."enrolmentId" = e.id and p.status = 'SUCCESS' and p."paidAt" < ${to}) >= ${c.countsAfterPaidInstallments}
    group by e."agentId"`;
  return new Map(rows.map((r) => [r.agentId, Number(r.n)]));
}

const hasEnded = (c: Campaign) => todayInIndia() > c.end;

/** The signed-in agent's progress in the current campaign, or null if there is none. */
export async function getMyCampaign(user: SessionUser | null) {
  const agent = requireRole(user, ["AGENT"]);
  const c = await getCampaign();
  if (!c) return null;
  const [counts, award] = await Promise.all([
    countsByAgent(c, agent.id),
    db.commission.findUnique({ where: { agentId_campaign: { agentId: agent.id, campaign: campaignKey(c) } } }),
  ]);
  return { campaign: c, started: todayInIndia() >= c.start, ended: hasEnded(c), awarded: award?.amount ?? null, ...tierProgress(counts.get(agent.id) ?? 0, c.tiers) };
}

/** Super admin: the campaign and every agent's count, tier reached and award. */
export async function campaignOverview(user: SessionUser | null) {
  requireRole(user, ["SUPER_ADMIN"]);
  const c = await getCampaign();
  if (!c) return { campaign: null, ended: false, agents: [] };
  const [agents, counts, awards] = await Promise.all([
    db.user.findMany({ where: { role: "AGENT" }, include: { agentProfile: true }, orderBy: { name: "asc" } }),
    countsByAgent(c),
    db.commission.findMany({ where: { campaign: campaignKey(c) }, select: { agentId: true, amount: true } }),
  ]);
  const awarded = new Map(awards.map((a) => [a.agentId, a.amount]));
  return {
    campaign: c,
    ended: hasEnded(c),
    agents: agents
      .map((a) => ({ id: a.id, name: a.name, panchayat: a.agentProfile?.panchayat ?? "", awarded: awarded.get(a.id) ?? null, ...tierProgress(counts.get(a.id) ?? 0, c.tiers) }))
      .sort((x, y) => y.count - x.count || x.name.localeCompare(y.name)),
  };
}

/** Super admin sets the campaign. Changing the dates starts a new campaign (awards are keyed by them). */
export async function updateCampaign(user: SessionUser | null, input: unknown) {
  const admin = requireRole(user, ["SUPER_ADMIN"]);
  const c = campaignInput.parse(input);
  return db.$transaction(async (tx) => {
    const old = await tx.config.findUnique({ where: { key: "recruitmentCampaign" } });
    if (old && (await tx.commission.count({ where: { campaign: campaignKey(c) } })) > 0) {
      throw new AppError("CAMPAIGN_AWARDED", "Bonuses for this campaign were already awarded; it can't be changed", 409);
    }
    await tx.config.upsert({ where: { key: "recruitmentCampaign" }, create: { key: "recruitmentCampaign", value: c }, update: { value: c } });
    await audit(tx, admin.id, "campaign.update", "Config", "recruitmentCampaign", { before: old?.value ?? null, after: c });
    return c;
  });
}

/**
 * After the campaign ends, gives each agent the bonus of the highest tier they reached, as a BONUS commission line
 * (it goes on their next invoice, with TDS). Safe to run again: an agent is awarded once per campaign.
 */
export async function awardCampaignBonuses(user: SessionUser | null) {
  const admin = requireRole(user, ["SUPER_ADMIN"]);
  const c = await getCampaign();
  if (!c) throw new AppError("NOT_FOUND", "There is no campaign", 404);
  if (!hasEnded(c)) throw new AppError("CAMPAIGN_NOT_OVER", "Bonuses can be awarded once the campaign has ended", 409);
  const counts = await countsByAgent(c);
  return db.$transaction(async (tx) => {
    await tx.$executeRaw`select pg_advisory_xact_lock(hashtext('campaign-award'))`;
    const key = campaignKey(c);
    const done = new Set((await tx.commission.findMany({ where: { campaign: key }, select: { agentId: true } })).map((x) => x.agentId));
    const created = [];
    for (const [agentId, count] of counts) {
      const { reached } = tierProgress(count, c.tiers);
      if (!reached || done.has(agentId)) continue;
      created.push(await tx.commission.create({ data: { agentId, type: "BONUS", amount: reached.bonus, campaign: key } }));
    }
    await audit(tx, admin.id, "campaign.award", "Config", "recruitmentCampaign", { campaign: key, awards: created.map((x) => ({ agentId: x.agentId, amount: x.amount })) });
    return created;
  });
}
