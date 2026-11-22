import { beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import type { SessionUser } from "@/shared/auth";
import { failsWith, makeUser, resetDb } from "../../test/db";
import { bonusOverview, getMyBonus, listBonusDraws, markPrizeHandedOver, runBonusDraw } from "./bonus";
import { pickWinners } from "./draws";
import { listMyEnrolments } from "./tracker";
import { sendSms } from "./sms";

vi.mock("./sms", () => ({ sendSms: vi.fn() }));

let admin: SessionUser, agent: SessionUser;
let batchId: string;
let seq = 0;

/** A member with one enrolment whose first `paid` months are PAID (plus one PENDING cash month if `pendingCash`). */
async function member(phone: string, paid: number, opts: { status?: "ACTIVE" | "DEFAULTED" | "MATURED"; pendingCash?: boolean } = {}) {
  const m = await makeUser("MEMBER", phone);
  seq++;
  const e = await db.enrolment.create({
    data: {
      memberId: m.id,
      agentId: agent.id,
      batchId,
      seq,
      status: opts.status ?? "ACTIVE",
      tokenNumber: `MAN-B01-${String(seq).padStart(4, "0")}`,
      installments: {
        create: Array.from({ length: 12 }, (_, i) => ({ monthNo: i + 1, dueDate: new Date(Date.UTC(2026, i, 1)), amount: 2_000_00, status: i < paid ? ("PAID" as const) : ("DUE" as const) })),
      },
    },
    include: { installments: { orderBy: { monthNo: "asc" } } },
  });
  if (opts.pendingCash) {
    await db.payment.create({
      data: { installmentId: e.installments[paid].id, memberId: m.id, method: "CASH", provider: "CASH", amount: 2_000_00, orderId: `CASH-${seq}`, status: "PENDING", collectedById: agent.id },
    });
  }
  return { user: m, token: e.tokenNumber };
}

beforeEach(async () => {
  vi.mocked(sendSms).mockReset();
  seq = 0;
  await resetDb();
  [admin, agent] = await Promise.all([makeUser("ADMIN", "9000000001"), makeUser("AGENT", "9800000001")]);
  await db.config.create({ data: { key: "bonusRewards", value: { scooters: 2, goldChains: 1 } } });
  const scheme = await db.scheme.create({
    data: { code: "MANPASAND", nameEn: "Manpasand Plan", nameHi: "मनपसंद योजना", installmentAmount: 2_000_00, tenureMonths: 12, commissionRule: { type: "FLAT", amount: 50_00 } },
  });
  batchId = (await db.batch.create({ data: { schemeId: scheme.id, number: 1, startMonth: new Date("2026-01-01"), size: 2500, winnersPerDraw: 1 } })).id;
});

describe("bonus draw", () => {
  it("only unlocked, not defaulted members are in; pending cash doesn't count; winners follow from the seed", async () => {
    const a = await member("9700000001", 6);
    const b = await member("9700000002", 7);
    await member("9700000003", 5, { pendingCash: true }); // 5 confirmed + cash waiting: still locked
    await member("9700000004", 9, { status: "DEFAULTED" });
    const c = await member("9700000005", 12, { status: "MATURED" });

    const d = await runBonusDraw(admin, "SCOOTER");
    expect(d.eligibleCount).toBe(3);
    expect(d.winners).toEqual(pickWinners(d.seed, [a.token, b.token, c.token], 2));
    const saved = await db.draw.findUniqueOrThrow({ where: { id: d.id } });
    expect(saved.eligible).toEqual([a.token, b.token, c.token].sort());

    await failsWith(runBonusDraw(admin, "SCOOTER"), "DRAW_ALREADY_RUN");
    // A bonus prize is not a monthly win: the scheme stays as it was.
    const [winner] = await db.user.findMany({ where: { enrolments: { some: { tokenNumber: d.winners[0] } } } });
    expect((await listMyEnrolments({ id: winner.id, phone: winner.phone, name: winner.name, role: "MEMBER", language: "hi" }))[0].wonMonth).toBeNull();
    expect(sendSms).toHaveBeenCalledTimes(2);
  });

  it("the gold chain needs 12 paid months, and a scooter winner can't win it too", async () => {
    const full = await member("9700000001", 12, { status: "MATURED" });
    await member("9700000002", 11);
    await db.config.update({ where: { key: "bonusRewards" }, data: { value: { scooters: 1, goldChains: 1 } } });

    expect((await bonusOverview(admin)).map((p) => [p.prize, p.eligibleNow])).toEqual([["SCOOTER", 2], ["GOLD_CHAIN", 1]]);
    const chain = await runBonusDraw(admin, "GOLD_CHAIN");
    expect(chain.winners).toEqual([full.token]);
    // The chain winner is now out of the scooter draw.
    const scooter = await runBonusDraw(admin, "SCOOTER");
    expect(scooter).toMatchObject({ eligibleCount: 1 });
    expect(scooter.winners).not.toContain(full.token);

    expect(await getMyBonus(full.user)).toEqual(expect.arrayContaining([expect.objectContaining({ prize: "GOLD_CHAIN", won: true })]));
    expect((await listBonusDraws(full.user)).find((x) => x.prize === "GOLD_CHAIN")!.winners).toEqual([{ token: full.token, mine: true }]);
  });

  it("refuses when nobody has unlocked the prize", async () => {
    await member("9700000001", 5);
    await failsWith(runBonusDraw(admin, "SCOOTER"), "NO_ELIGIBLE");
    await failsWith(runBonusDraw(admin, "BIKE"), "VALIDATION");
  });

  it("records the hand-over once; only admins run or manage it", async () => {
    const a = await member("9700000001", 6);
    await runBonusDraw(admin, "SCOOTER");
    const [w] = (await bonusOverview(admin))[0].draw!.winners;
    await markPrizeHandedOver(admin, w.id);
    await failsWith(markPrizeHandedOver(admin, w.id), "NOT_FOUND");
    for (const u of [agent, a.user]) {
      await failsWith(runBonusDraw(u, "GOLD_CHAIN"), "FORBIDDEN");
      await failsWith(bonusOverview(u), "FORBIDDEN");
      await failsWith(markPrizeHandedOver(u, w.id), "FORBIDDEN");
    }
  });
});
