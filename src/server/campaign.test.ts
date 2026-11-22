import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import type { SessionUser } from "@/shared/auth";
import { campaignInput, tierProgress } from "@/shared/campaign";
import { todayInIndia } from "@/shared/tracker";
import { failsWith, makeUser, resetDb } from "../../test/db";
import { awardCampaignBonuses, campaignOverview, getMyCampaign, updateCampaign } from "./campaign";
import { createAgentInvoices } from "./invoices";

let superAdmin: SessionUser, admin: SessionUser, agent: SessionUser, agent2: SessionUser;
let batchId: string;
let seq = 0;

const tiers = [
  { enrolments: 2, bonus: 1_500_00 },
  { enrolments: 3, bonus: 4_000_00 },
];
const dayOffset = (days: number) => new Date(Date.now() + days * 864e5).toISOString().slice(0, 10);

/** An enrolment by `by` made at `createdAt`, with `paid` successful payments made at `paidAt`. */
async function enrolment(by: SessionUser | null, createdAt: string, paid: number, paidAt = createdAt) {
  const m = await makeUser("MEMBER", `97${String(++seq).padStart(8, "0")}`);
  const e = await db.enrolment.create({
    data: {
      memberId: m.id,
      agentId: by?.id ?? null,
      batchId,
      seq,
      tokenNumber: `MAN-B01-${String(seq).padStart(4, "0")}`,
      createdAt: new Date(`${createdAt}T10:00:00+05:30`),
      installments: { create: Array.from({ length: 12 }, (_, i) => ({ monthNo: i + 1, dueDate: new Date(Date.UTC(2026, 10 + i, 1)), amount: 2_000_00 })) },
    },
    include: { installments: { orderBy: { monthNo: "asc" } } },
  });
  for (const i of e.installments.slice(0, paid)) {
    await db.installment.update({ where: { id: i.id }, data: { status: "PAID" } });
    await db.payment.create({
      data: { installmentId: i.id, memberId: m.id, method: "ONLINE", provider: "TEST", amount: i.amount, orderId: `O-${i.id}`, status: "SUCCESS", paidAt: new Date(`${paidAt}T10:00:00+05:30`) },
    });
  }
}

beforeEach(async () => {
  seq = 0;
  await resetDb();
  [superAdmin, admin, agent, agent2] = await Promise.all([
    makeUser("SUPER_ADMIN", "9999999999"),
    makeUser("ADMIN", "9000000001"),
    makeUser("AGENT", "9800000001"),
    makeUser("AGENT", "9800000002"),
  ]);
  const scheme = await db.scheme.create({
    data: { code: "MANPASAND", nameEn: "Manpasand Plan", nameHi: "मनपसंद योजना", installmentAmount: 2_000_00, tenureMonths: 12, commissionRule: { type: "FLAT", amount: 50_00 } },
  });
  batchId = (await db.batch.create({ data: { schemeId: scheme.id, number: 1, startMonth: new Date("2026-11-01"), size: 2500, winnersPerDraw: 1 } })).id;
});

describe("campaign rules", () => {
  it("the agent gets the highest tier reached, not the sum", () => {
    expect(tierProgress(1, tiers)).toMatchObject({ reached: null, next: tiers[0], toNext: 1 });
    expect(tierProgress(2, tiers)).toMatchObject({ reached: tiers[0], next: tiers[1], toNext: 1 });
    expect(tierProgress(9, tiers)).toMatchObject({ reached: tiers[1], next: null });
  });

  it("rejects tiers that don't grow, and an end before the start", () => {
    expect(campaignInput.safeParse({ start: "2026-12-01", end: "2026-11-01", countsAfterPaidInstallments: 1, tiers }).success).toBe(false);
    expect(campaignInput.safeParse({ start: "2026-11-01", end: "2026-12-01", countsAfterPaidInstallments: 1, tiers: [tiers[1], tiers[0]] }).success).toBe(false);
  });
});

describe("counting and awarding", () => {
  // A campaign that ended yesterday and ran for 30 days.
  const start = dayOffset(-30);
  const end = dayOffset(-1);
  beforeEach(async () => {
    await updateCampaign(superAdmin, { start, end, countsAfterPaidInstallments: 1, tiers });
  });

  it("counts enrolments made in the window whose first month was paid by the end", async () => {
    await enrolment(agent, start, 1); // counts
    await enrolment(agent, end, 1); // counts: last day
    await enrolment(agent, end, 1, dayOffset(0)); // paid after the campaign: doesn't count
    await enrolment(agent, dayOffset(-40), 1); // made before: doesn't count
    await enrolment(agent, start, 0); // never paid: doesn't count
    await enrolment(null, start, 1); // joined directly: nobody's
    await enrolment(agent2, start, 1);

    expect(await getMyCampaign(agent)).toMatchObject({ count: 2, reached: tiers[0], ended: true, awarded: null });
    const o = await campaignOverview(superAdmin);
    expect(o.agents.map((a) => [a.id, a.count])).toEqual([
      [agent.id, 2],
      [agent2.id, 1],
    ]);
  });

  it("awards once per agent, as a bonus commission that goes on the next invoice", async () => {
    for (let i = 0; i < 3; i++) await enrolment(agent, start, 1);
    await enrolment(agent2, start, 1); // below the first tier

    const awards = await awardCampaignBonuses(superAdmin);
    expect(awards).toEqual([expect.objectContaining({ agentId: agent.id, type: "BONUS", amount: 4_000_00 })]);
    expect(await awardCampaignBonuses(superAdmin)).toEqual([]);
    expect(await getMyCampaign(agent)).toMatchObject({ awarded: 4_000_00 });
    await failsWith(updateCampaign(superAdmin, { start, end, countsAfterPaidInstallments: 1, tiers }), "CAMPAIGN_AWARDED");

    // Backdate it into last month and invoice it.
    const lastMonth = new Date(Date.UTC(+todayInIndia().slice(0, 4), +todayInIndia().slice(5, 7) - 2, 15));
    await db.commission.updateMany({ data: { createdAt: lastMonth } });
    const [inv] = await createAgentInvoices(superAdmin, { period: lastMonth.toISOString().slice(0, 7) });
    expect(inv).toMatchObject({ agentId: agent.id, gross: 4_000_00 });
  });

  it("can't award before the end", async () => {
    await updateCampaign(superAdmin, { start: dayOffset(-5), end: dayOffset(5), countsAfterPaidInstallments: 1, tiers });
    await failsWith(awardCampaignBonuses(superAdmin), "CAMPAIGN_NOT_OVER");
  });

  it("only the super admin manages it; agents see only their own", async () => {
    for (const u of [admin, agent]) {
      await failsWith(updateCampaign(u, { start, end, countsAfterPaidInstallments: 1, tiers }), "FORBIDDEN");
      await failsWith(awardCampaignBonuses(u), "FORBIDDEN");
      await failsWith(campaignOverview(u), "FORBIDDEN");
    }
    await failsWith(getMyCampaign(admin), "FORBIDDEN");
  });
});
