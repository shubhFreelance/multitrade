import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import type { SessionUser } from "@/shared/auth";
import { bonusStatus, defaultBonusRewards } from "@/shared/bonus";
import { failsWith, makeUser, resetDb } from "../../test/db";
import { getMyBonus } from "./bonus";
import { recordCash, simulateTestPayment, startPayment, verifyCash } from "./payments";

let admin: SessionUser, agent: SessionUser, member: SessionUser;
let months: { id: string }[];

const pay = async (installmentId: string) => simulateTestPayment(member, (await startPayment(member, installmentId)).paymentId, "SUCCESS");

beforeEach(async () => {
  vi.stubEnv("PAYMENT_PROVIDER", "test");
  await resetDb();
  [admin, agent, member] = await Promise.all([makeUser("SUPER_ADMIN", "9999999999"), makeUser("AGENT", "9800000001"), makeUser("MEMBER", "9700000001")]);
  await db.config.create({ data: { key: "bonusUnlock", value: { paidInstallments: 6, scope: "ENROLMENT" } } });
  const scheme = await db.scheme.create({
    data: { code: "MANPASAND", nameEn: "Manpasand Plan", nameHi: "मनपसंद योजना", installmentAmount: 2_000_00, tenureMonths: 12, commissionRule: { type: "FLAT", amount: 50_00 } },
  });
  const batch = await db.batch.create({ data: { schemeId: scheme.id, number: 1, startMonth: new Date("2027-01-01"), size: 10, winnersPerDraw: 1 } });
  const e = await db.enrolment.create({
    data: {
      memberId: member.id,
      agentId: agent.id,
      batchId: batch.id,
      seq: 1,
      tokenNumber: "MAN-B01-0001",
      installments: { create: Array.from({ length: 12 }, (_, i) => ({ monthNo: i + 1, dueDate: new Date(Date.UTC(2027, i, 1)), amount: 2_000_00 })) },
    },
    include: { installments: { orderBy: { monthNo: "asc" } } },
  });
  months = e.installments;
});
afterEach(() => vi.unstubAllEnvs());

describe("bonus unlock", () => {
  it("5 paid is locked; pending cash for the 6th doesn't count; verified, it unlocks", async () => {
    for (const m of months.slice(0, 5)) await pay(m.id);
    expect(await getMyBonus(member)).toMatchObject({ unlocked: false, paid: 5, remaining: 1 });

    const cash = await recordCash(agent, months[5].id);
    expect(await getMyBonus(member)).toMatchObject({ unlocked: false, paid: 5 });

    await verifyCash(admin, cash.id);
    expect(await getMyBonus(member)).toMatchObject({ unlocked: true, paid: 6, remaining: 0, rewards: defaultBonusRewards });
  });

  it("only members can ask", async () => {
    await failsWith(getMyBonus(agent), "FORBIDDEN");
  });
});

describe("bonusStatus", () => {
  const rule = { paidInstallments: 6, scope: "ENROLMENT" as const };
  it("counts one enrolment by default, all of them when cumulative, and never a defaulted one", () => {
    const es = [{ status: "ACTIVE", paid: 3 }, { status: "MATURED", paid: 4 }, { status: "DEFAULTED", paid: 9 }];
    expect(bonusStatus(es, rule, defaultBonusRewards)).toMatchObject({ unlocked: false, paid: 4, remaining: 2 });
    expect(bonusStatus(es, { ...rule, scope: "CUMULATIVE" }, defaultBonusRewards)).toMatchObject({ unlocked: true, paid: 6 });
    expect(bonusStatus([], rule, defaultBonusRewards)).toMatchObject({ unlocked: false, paid: 0, remaining: 6 });
  });
});
