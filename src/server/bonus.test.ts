import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import type { SessionUser } from "@/shared/auth";
import { bonusStatus, defaultBonusRewards, type PrizeStatus } from "@/shared/bonus";
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
  await db.config.create({ data: { key: "bonusUnlock", value: { scooter: 6, goldChain: 12, scope: "ENROLMENT" } } });
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

const prize = (ps: PrizeStatus[], p: string) => ps.find((x) => x.prize === p);

describe("bonus unlock", () => {
  it("scooters: 5 paid is locked; pending cash for the 6th doesn't count; verified, it unlocks", async () => {
    for (const m of months.slice(0, 5)) await pay(m.id);
    expect(prize(await getMyBonus(member), "SCOOTER")).toMatchObject({ unlocked: false, paid: 5, remaining: 1, count: 5 });

    const cash = await recordCash(agent, months[5].id);
    expect(prize(await getMyBonus(member), "SCOOTER")).toMatchObject({ unlocked: false, paid: 5 });

    await verifyCash(admin, cash.id);
    const after = await getMyBonus(member);
    expect(prize(after, "SCOOTER")).toMatchObject({ unlocked: true, paid: 6, remaining: 0 });
    expect(prize(after, "GOLD_CHAIN")).toMatchObject({ unlocked: false, paid: 6, needed: 12, remaining: 6, count: 1 });
  });

  it("the gold chain unlocks only with all 12 months paid", async () => {
    for (const m of months.slice(0, 11)) await pay(m.id);
    expect(prize(await getMyBonus(member), "GOLD_CHAIN")).toMatchObject({ unlocked: false, remaining: 1 });
    await pay(months[11].id);
    expect(prize(await getMyBonus(member), "GOLD_CHAIN")).toMatchObject({ unlocked: true, paid: 12 });
  });

  it("only members can ask", async () => {
    await failsWith(getMyBonus(agent), "FORBIDDEN");
  });
});

describe("bonusStatus", () => {
  const rule = { scooter: 6, goldChain: 12, scope: "ENROLMENT" as const };
  it("counts one enrolment by default, all of them when cumulative, and never a defaulted one", () => {
    const es = [{ status: "ACTIVE", paid: 3 }, { status: "MATURED", paid: 4 }, { status: "DEFAULTED", paid: 12 }];
    expect(bonusStatus(es, rule, defaultBonusRewards)[0]).toMatchObject({ prize: "SCOOTER", unlocked: false, paid: 4, remaining: 2 });
    expect(bonusStatus(es, { ...rule, scope: "CUMULATIVE" }, defaultBonusRewards).map((p) => p.unlocked)).toEqual([true, false]);
    expect(bonusStatus([], rule, defaultBonusRewards)[0]).toMatchObject({ unlocked: false, paid: 0, remaining: 6 });
  });
  it("leaves out a prize with a count of 0", () => {
    expect(bonusStatus([], rule, { scooters: 5, goldChains: 0 }).map((p) => p.prize)).toEqual(["SCOOTER"]);
  });
});
