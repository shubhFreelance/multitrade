import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import type { SessionUser } from "@/shared/auth";
import { failsWith, makeUser, resetDb } from "../../test/db";
import { listDrawBatches, listMyDraws, pickWinners, runMonthlyDraw } from "./draws";

let admin: SessionUser, agent: SessionUser, members: SessionUser[];
let batchId: string;

/** Batch started three months ago, so draws for months 1–3 are open. */
const start = () => {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - 2, 1));
};

async function enrol(m: SessionUser, seq: number, status: "ACTIVE" | "DEFAULTED" | "WON" = "ACTIVE", batch = "MAN-B01") {
  const s = start();
  return db.enrolment.create({
    data: {
      memberId: m.id,
      agentId: agent.id,
      batchId,
      seq,
      status,
      tokenNumber: `${batch}-${String(seq).padStart(4, "0")}`,
      installments: {
        // Months 1–3 are already due: mark them paid so nobody is overdue unless a test says so.
        create: Array.from({ length: 12 }, (_, i) => ({
          monthNo: i + 1,
          dueDate: new Date(Date.UTC(s.getUTCFullYear(), s.getUTCMonth() + i, 1)),
          amount: 2_000_00,
          status: i < 3 ? ("PAID" as const) : ("DUE" as const),
        })),
      },
    },
  });
}

beforeEach(async () => {
  await resetDb();
  [admin, agent] = await Promise.all([makeUser("ADMIN", "9000000001"), makeUser("AGENT", "9800000001")]);
  members = await Promise.all(Array.from({ length: 6 }, (_, i) => makeUser("MEMBER", `970000000${i}`)));
  const scheme = await db.scheme.create({
    data: { code: "MANPASAND", nameEn: "Manpasand Plan", nameHi: "मनपसंद योजना", installmentAmount: 2_000_00, tenureMonths: 12, commissionRule: { type: "FLAT", amount: 50_00 } },
  });
  batchId = (await db.batch.create({ data: { schemeId: scheme.id, number: 1, startMonth: start(), size: 2500, winnersPerDraw: 2, status: "RUNNING" } })).id;
});

describe("pickWinners", () => {
  const tokens = Array.from({ length: 50 }, (_, i) => `T${i}`);
  it("same seed and list give the same winners, whatever order the list comes in", () => {
    const a = pickWinners("abc", tokens, 10);
    expect(pickWinners("abc", [...tokens].reverse(), 10)).toEqual(a);
    expect(new Set(a).size).toBe(10);
    expect(pickWinners("abd", tokens, 10)).not.toEqual(a);
  });
  it("never picks more than there are", () => {
    expect(pickWinners("x", ["A", "B"], 5).sort()).toEqual(["A", "B"]);
  });
});

describe("monthly draw", () => {
  it("picks only eligible members, waives winners' later months, and saves seed and list", async () => {
    const ok1 = await enrol(members[0], 1);
    const ok2 = await enrol(members[1], 2);
    await enrol(members[2], 3, "DEFAULTED");
    await enrol(members[3], 4, "WON");
    const late = await enrol(members[4], 5);
    // Month 1 unpaid and long past due: overdue.
    await db.installment.updateMany({ where: { enrolmentId: late.id, monthNo: 1 }, data: { status: "DUE" } });

    const d = await runMonthlyDraw(admin, { batchId, monthNo: 1 });
    expect(d.eligibleCount).toBe(2);
    expect(d.winners.sort()).toEqual([ok1.tokenNumber, ok2.tokenNumber]);
    expect(pickWinners(d.seed, [ok1.tokenNumber, ok2.tokenNumber], 2)).toEqual(
      (await db.drawWinner.findMany({ orderBy: { position: "asc" }, include: { enrolment: true } })).map((w) => w.enrolment.tokenNumber),
    );

    const won = await db.enrolment.findUniqueOrThrow({ where: { id: ok1.id }, include: { installments: { orderBy: { monthNo: "asc" } } } });
    expect(won.status).toBe("WON");
    expect(won.installments.map((i) => i.status)).toEqual(["PAID", "PAID", "PAID", ...Array(9).fill("WAIVED")]);
  });

  it("cash waiting for verification doesn't make a month overdue", async () => {
    const e = await enrol(members[0], 1);
    const m1 = await db.installment.update({ where: { enrolmentId_monthNo: { enrolmentId: e.id, monthNo: 1 } }, data: { status: "DUE" } });
    await db.payment.create({ data: { installmentId: m1.id, memberId: members[0].id, method: "CASH", provider: "CASH", amount: m1.amount, orderId: "CASH-1", status: "PENDING", collectedById: agent.id } });
    expect((await runMonthlyDraw(admin, { batchId, monthNo: 1 })).winners).toEqual([e.tokenNumber]);
  });

  it("can't run twice, out of order, before the month starts, or with nobody eligible", async () => {
    await enrol(members[0], 1);
    await enrol(members[1], 2);
    await enrol(members[2], 3);
    await failsWith(runMonthlyDraw(admin, { batchId, monthNo: 2 }), "DRAW_OUT_OF_ORDER");
    await runMonthlyDraw(admin, { batchId, monthNo: 1 });
    await failsWith(runMonthlyDraw(admin, { batchId, monthNo: 1 }), "DRAW_ALREADY_RUN");
    await runMonthlyDraw(admin, { batchId, monthNo: 2 }); // one member left
    await failsWith(runMonthlyDraw(admin, { batchId, monthNo: 3 }), "NO_ELIGIBLE");
    await failsWith(runMonthlyDraw(admin, { batchId, monthNo: 4 }), "DRAW_OUT_OF_ORDER");
    expect((await listDrawBatches(admin))[0]).toMatchObject({ nextMonth: 3, canRun: true });
  });

  it("refuses a month that hasn't started", async () => {
    await db.batch.update({ where: { id: batchId }, data: { startMonth: new Date("2099-01-01") } });
    await failsWith(runMonthlyDraw(admin, { batchId, monthNo: 1 }), "DRAW_NOT_OPEN");
  });

  it("a winner is out of this batch's draws but can join a new batch and win there", async () => {
    await enrol(members[0], 1);
    await runMonthlyDraw(admin, { batchId, monthNo: 1 });
    await failsWith(runMonthlyDraw(admin, { batchId, monthNo: 2 }), "NO_ELIGIBLE");

    const scheme = await db.scheme.findFirstOrThrow();
    batchId = (await db.batch.create({ data: { schemeId: scheme.id, number: 2, startMonth: start(), size: 2500, winnersPerDraw: 1 } })).id;
    await enrol(members[0], 1, "ACTIVE", "MAN-B02");
    expect((await runMonthlyDraw(admin, { batchId, monthNo: 1 })).winners).toEqual(["MAN-B02-0001"]);
    expect((await listMyDraws(members[0])).map((d) => d.batch).sort()).toEqual(["MAN-B01", "MAN-B02"]);
  });
});

describe("access control", () => {
  it("only admins run draws; members see only draws of their own batches", async () => {
    await enrol(members[0], 1);
    await failsWith(runMonthlyDraw(agent, { batchId, monthNo: 1 }), "FORBIDDEN");
    await failsWith(runMonthlyDraw(members[0], { batchId, monthNo: 1 }), "FORBIDDEN");
    await runMonthlyDraw(admin, { batchId, monthNo: 1 });
    expect(await listMyDraws(members[0])).toEqual([expect.objectContaining({ monthNo: 1, winners: [{ token: "MAN-B01-0001", mine: true }] })]);
    expect(await listMyDraws(members[5])).toEqual([]);
  });
});
