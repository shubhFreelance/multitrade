import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import type { SessionUser } from "@/shared/auth";
import { failsWith, makeUser, resetDb } from "../../test/db";
import { listMyNotifications } from "./completion";
import { simulateTestPayment, startPayment } from "./payments";
import { checkCronSecret, longestOverdueRun, runDaily, runDailyAsAdmin } from "./reminders";
import { sendSms } from "./sms";

vi.mock("./sms", () => ({ sendSms: vi.fn() }));

let superAdmin: SessionUser, admin: SessionUser, agent: SessionUser, member: SessionUser;
let enrolmentId: string;
let months: { id: string }[];

/** Months due on the 1st, Jan–Dec 2027. */
beforeEach(async () => {
  vi.mocked(sendSms).mockReset();
  vi.stubEnv("PAYMENT_PROVIDER", "test");
  await resetDb();
  [superAdmin, admin, agent, member] = await Promise.all([
    makeUser("SUPER_ADMIN", "9999999999"),
    makeUser("ADMIN", "9000000001"),
    makeUser("AGENT", "9800000001"),
    makeUser("MEMBER", "9700000001"),
  ]);
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
  enrolmentId = e.id;
  months = e.installments;
});
afterEach(() => vi.unstubAllEnvs());

const statuses = async () => (await db.installment.findMany({ where: { enrolmentId }, orderBy: { monthNo: "asc" } })).map((i) => i.status);
const types = async () => (await db.notification.findMany({ orderBy: { createdAt: "asc" } })).map((n) => n.type);

describe("daily job", () => {
  it("reminds 3 days before and on the due date, once each", async () => {
    expect(await runDaily("2026-12-28")).toMatchObject({ dueSoon: 0, dueToday: 0 });
    expect(await runDaily("2026-12-29")).toMatchObject({ dueSoon: 1, dueToday: 0 });
    expect(await runDaily("2026-12-30")).toMatchObject({ dueSoon: 0 }); // already reminded
    expect(await runDaily("2027-01-01")).toMatchObject({ dueToday: 1 });
    expect(await runDaily("2027-01-01")).toMatchObject({ dueToday: 0 });
    expect(await types()).toEqual(["DUE_SOON", "DUE_TODAY"]);
    expect(sendSms).toHaveBeenCalledTimes(2);
    expect(vi.mocked(sendSms).mock.calls[1][1]).toContain("₹2,000"); // amount in the text
    expect((await listMyNotifications(member))[0]).toMatchObject({ type: "DUE_TODAY", dueDate: "2027-01-01", amount: 2_000_00 });
  });

  it("a month turns overdue more than 10 days after the due date, not before", async () => {
    await runDaily("2027-01-11");
    expect((await statuses())[0]).toBe("DUE");
    expect(await runDaily("2027-01-12")).toMatchObject({ overdue: 1 });
    expect((await statuses())[0]).toBe("OVERDUE");
    expect(await runDaily("2027-01-12")).toMatchObject({ overdue: 0 });
    expect((await types()).filter((t) => t === "OVERDUE")).toHaveLength(1);
  });

  it("cash waiting for verification is not overdue", async () => {
    await db.payment.create({ data: { installmentId: months[0].id, memberId: member.id, method: "CASH", provider: "CASH", amount: 2_000_00, orderId: "CASH-1", status: "PENDING", collectedById: agent.id } });
    expect(await runDaily("2027-01-20")).toMatchObject({ overdue: 0, dueToday: 0 });
  });

  it("2 overdue months in a row default the enrolment (draws skip it, see draws.test.ts); catching up makes it active again", async () => {
    await runDaily("2027-01-20");
    expect(await db.enrolment.findUniqueOrThrow({ where: { id: enrolmentId } })).toMatchObject({ status: "ACTIVE" });
    expect(await runDaily("2027-02-20")).toMatchObject({ overdue: 1, defaulted: 1 });
    expect(await db.enrolment.findUniqueOrThrow({ where: { id: enrolmentId } })).toMatchObject({ status: "DEFAULTED" });
    expect(await runDaily("2027-02-21")).toMatchObject({ defaulted: 0 });


    for (const m of months.slice(0, 2)) await simulateTestPayment(member, (await startPayment(member, m.id)).paymentId, "SUCCESS");
    expect(await db.enrolment.findUniqueOrThrow({ where: { id: enrolmentId } })).toMatchObject({ status: "ACTIVE" });
  });

  it("paid, waived and matured months get no reminders", async () => {
    await simulateTestPayment(member, (await startPayment(member, months[0].id)).paymentId, "SUCCESS");
    await db.installment.update({ where: { id: months[1].id }, data: { status: "WAIVED" } });
    expect(await runDaily("2027-02-25")).toMatchObject({ overdue: 0, dueToday: 0, dueSoon: 0 });
  });

  it("counts overdue months in a row", () => {
    const s = (xs: string[]) => xs.map((status, i) => ({ monthNo: i + 1, status }));
    expect(longestOverdueRun(s(["OVERDUE", "PAID", "OVERDUE"]))).toBe(1);
    expect(longestOverdueRun(s(["PAID", "OVERDUE", "OVERDUE", "DUE"]))).toBe(2);
  });
});

describe("who can run it", () => {
  it("the cron needs the secret; by hand only the super admin", async () => {
    vi.stubEnv("CRON_SECRET", "s3cret-value");
    expect(() => checkCronSecret("Bearer s3cret-value")).not.toThrow();
    expect(() => checkCronSecret("Bearer wrong")).toThrow(/Wrong cron secret/);
    expect(() => checkCronSecret(null)).toThrow(/Wrong cron secret/);
    vi.stubEnv("CRON_SECRET", "");
    expect(() => checkCronSecret("Bearer ")).toThrow(/not set/);
    await failsWith(runDailyAsAdmin(admin), "FORBIDDEN");
    await expect(runDailyAsAdmin(superAdmin)).resolves.toMatchObject({ overdue: expect.any(Number) });
  });
});
