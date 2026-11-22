import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import type { SessionUser } from "@/shared/auth";
import { failsWith, makeUser, resetDb } from "../../test/db";
import { confirmPayment, getPayment, listPendingCash, recordCash, rejectCash, simulateTestPayment, startPayment, verifyCash } from "./payments";
import { listMyEnrolments } from "./tracker";
import { listMyCommission } from "./commission";

let member: SessionUser, other: SessionUser, agent: SessionUser;
let enrolmentId: string;
let months: { id: string }[];

beforeEach(async () => {
  vi.stubEnv("PAYMENT_PROVIDER", "test");
  await resetDb();
  [member, other, agent] = await Promise.all([makeUser("MEMBER", "9700000001"), makeUser("MEMBER", "9700000002"), makeUser("AGENT", "9800000001")]);
  const scheme = await db.scheme.create({
    data: { code: "UPAHAR", nameEn: "Upahar Plan", nameHi: "उपहार योजना", installmentAmount: 2_000_00, tenureMonths: 12, commissionRule: {} },
  });
  const batch = await db.batch.create({ data: { schemeId: scheme.id, number: 1, startMonth: new Date("2027-01-01"), size: 10, winnersPerDraw: 1 } });
  const e = await db.enrolment.create({
    data: {
      memberId: member.id,
      agentId: agent.id,
      batchId: batch.id,
      seq: 1,
      tokenNumber: "UPH-B01-0001",
      installments: {
        create: Array.from({ length: 12 }, (_, i) => ({ monthNo: i + 1, dueDate: new Date(Date.UTC(2027, i, 1)), amount: 2_000_00 })),
      },
    },
    include: { installments: { orderBy: { monthNo: "asc" } } },
  });
  enrolmentId = e.id;
  months = e.installments;
});
afterEach(() => vi.unstubAllEnvs());

const status = async (i: number) => (await db.installment.findUniqueOrThrow({ where: { id: months[i].id } })).status;
const pay = async (i: number) => {
  const { paymentId } = await startPayment(member, months[i].id);
  return simulateTestPayment(member, paymentId, "SUCCESS");
};

describe("paying an installment", () => {
  it("a successful payment marks the month paid, with the gateway reference", async () => {
    const p = await pay(0);
    expect(p).toMatchObject({ status: "SUCCESS", amount: 2_000_00 });
    expect(p.gatewayPaymentId).toMatch(/^TEST-/);
    expect(await status(0)).toBe("PAID");
  });

  it("a failed payment leaves the month unpaid, and the member can try again", async () => {
    const { paymentId } = await startPayment(member, months[0].id);
    expect((await simulateTestPayment(member, paymentId, "FAILED")).status).toBe("FAILED");
    expect(await status(0)).toBe("DUE");
    await pay(0);
    expect(await status(0)).toBe("PAID");
  });

  it("months are paid oldest first and never twice", async () => {
    await failsWith(startPayment(member, months[1].id), "PAY_OLDEST_FIRST");
    await pay(0);
    await failsWith(startPayment(member, months[0].id), "ALREADY_PAID");
  });

  it("the 12th payment matures the enrolment", async () => {
    for (let i = 0; i < 11; i++) await pay(i);
    expect((await db.enrolment.findUniqueOrThrow({ where: { id: enrolmentId } })).status).toBe("ACTIVE");
    await pay(11);
    expect((await db.enrolment.findUniqueOrThrow({ where: { id: enrolmentId } })).status).toBe("MATURED");
  });
});

describe("gateway confirmation (webhook)", () => {
  it("the same confirmation delivered twice counts once", async () => {
    const { orderId } = await startPayment(member, months[0].id);
    const outcome = { status: "SUCCESS" as const, gatewayPaymentId: "CF-1", amount: 2_000_00 };
    await confirmPayment(orderId, outcome);
    await confirmPayment(orderId, outcome);
    await confirmPayment(orderId, { ...outcome, status: "FAILED" }); // a late failure can't undo it
    expect(await db.payment.count({ where: { status: "SUCCESS" } })).toBe(1);
    expect(await status(0)).toBe("PAID");
  });

  it("parallel deliveries of one confirmation settle it once", async () => {
    const { orderId } = await startPayment(member, months[0].id);
    await Promise.all(Array.from({ length: 5 }, () => confirmPayment(orderId, { status: "SUCCESS", gatewayPaymentId: "CF-1", amount: 2_000_00 })));
    expect(await db.payment.count({ where: { status: "SUCCESS" } })).toBe(1);
  });

  it("two orders for the same month: the second payment is flagged for refund, not counted", async () => {
    const first = await startPayment(member, months[0].id);
    const second = await startPayment(member, months[0].id);
    await confirmPayment(first.orderId, { status: "SUCCESS", gatewayPaymentId: "CF-1", amount: 2_000_00 });
    const dup = await confirmPayment(second.orderId, { status: "SUCCESS", gatewayPaymentId: "CF-2", amount: 2_000_00 });
    expect(dup.status).toBe("DUPLICATE");
    expect(await db.payment.count({ where: { status: "SUCCESS" } })).toBe(1);
  });

  it("refuses a success whose amount doesn't match the order", async () => {
    const { orderId } = await startPayment(member, months[0].id);
    await failsWith(confirmPayment(orderId, { status: "SUCCESS", gatewayPaymentId: "CF-1", amount: 1 }), "AMOUNT_MISMATCH");
    expect(await status(0)).toBe("DUE");
  });

  it("one gateway payment can't settle two orders", async () => {
    const a = await startPayment(member, months[0].id);
    await confirmPayment(a.orderId, { status: "SUCCESS", gatewayPaymentId: "CF-1", amount: 2_000_00 });
    const b = await startPayment(member, months[1].id);
    await failsWith(confirmPayment(b.orderId, { status: "SUCCESS", gatewayPaymentId: "CF-1", amount: 2_000_00 }), "CONFLICT");
    expect(await status(1)).toBe("DUE");
  });
});

describe("cash collected by the agent", () => {
  let admin: SessionUser;
  beforeEach(async () => {
    admin = await makeUser("ADMIN", "9000000001");
  });
  const view = async () => (await listMyEnrolments(member))[0].summary;

  it("pending cash does not count as paid until an admin verifies it", async () => {
    const cash = await recordCash(agent, months[0].id);
    expect(cash).toMatchObject({ status: "PENDING", method: "CASH", amount: 2_000_00, collectedById: agent.id });
    expect(await status(0)).toBe("DUE");
    expect(await view()).toMatchObject({ paidCount: 0, paidTotal: 0, pendingCount: 1, pendingTotal: 2_000_00 });

    await verifyCash(admin, cash.id);
    expect(await status(0)).toBe("PAID");
    expect(await view()).toMatchObject({ paidCount: 1, paidTotal: 2_000_00, pendingCount: 0 });
    expect(await db.auditLog.findFirstOrThrow({ where: { entityId: cash.id } })).toMatchObject({ actorId: admin.id, action: "cash.verify" });
  });

  it("rejected cash leaves the month unpaid, and the member can pay it", async () => {
    const cash = await recordCash(agent, months[0].id);
    await rejectCash(admin, cash.id);
    expect(await status(0)).toBe("DUE");
    await failsWith(verifyCash(admin, cash.id), "CASH_NOT_PENDING");
    await pay(0);
    expect(await status(0)).toBe("PAID");
  });

  it("the same month can't be recorded twice or paid online while its cash is being checked", async () => {
    await recordCash(agent, months[0].id);
    await failsWith(recordCash(agent, months[0].id), "CASH_PENDING");
    await failsWith(startPayment(member, months[0].id), "CASH_PENDING");
    // ...but the next month can be paid online meanwhile
    await pay(1);
    expect(await status(1)).toBe("PAID");
  });

  it("two taps at once record the cash once", async () => {
    const results = await Promise.allSettled([recordCash(agent, months[0].id), recordCash(agent, months[0].id)]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(await db.payment.count({ where: { status: "PENDING" } })).toBe(1);
  });

  it("verifying twice at once counts the cash once", async () => {
    const cash = await recordCash(agent, months[0].id);
    const results = await Promise.allSettled([verifyCash(admin, cash.id), verifyCash(admin, cash.id)]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(await db.payment.count({ where: { status: "SUCCESS" } })).toBe(1);
  });

  it("only the enrolling agent records cash; only admins verify or reject", async () => {
    const otherAgent = await makeUser("AGENT", "9800000002");
    await failsWith(recordCash(otherAgent, months[0].id), "NOT_FOUND");
    await failsWith(recordCash(member, months[0].id), "FORBIDDEN");
    const cash = await recordCash(agent, months[0].id);
    await failsWith(verifyCash(agent, cash.id), "FORBIDDEN");
    await failsWith(rejectCash(member, cash.id), "FORBIDDEN");
    await failsWith(listPendingCash(agent), "FORBIDDEN");
    expect(await status(0)).toBe("DUE");
  });

  it("an online order id can't be used to verify cash, and cash can't go through the gateway path", async () => {
    const online = await startPayment(member, months[0].id);
    await failsWith(verifyCash(admin, online.paymentId), "NOT_FOUND");
    const cash = await recordCash(agent, months[0].id); // an unfinished online order doesn't block cash
    await failsWith(confirmPayment(cash.orderId, { status: "SUCCESS", gatewayPaymentId: "X", amount: cash.amount }), "NOT_FOUND");
    expect(await status(0)).toBe("DUE");
  });
});

describe("commission", () => {
  const setRule = (commissionRule: object) => db.scheme.updateMany({ data: { commissionRule } });
  const lines = () => db.commission.findMany();

  it("the enrolling agent earns commission when a payment is confirmed: ₹50 flat (Manpasand)", async () => {
    await setRule({ type: "FLAT", amount: 50_00 });
    const p = await pay(0);
    expect(await lines()).toEqual([expect.objectContaining({ agentId: agent.id, paymentId: p.id, amount: 50_00, ruleMissing: false, status: "EARNED" })]);
  });

  it("1% of the installment (Gold)", async () => {
    await setRule({ type: "PERCENT", bps: 100 });
    await pay(0);
    expect((await lines())[0].amount).toBe(20_00);
  });

  it("Upahar: ₹0 and flagged until the tier table arrives", async () => {
    await setRule({ type: "TIER", tiers: [] });
    await pay(0);
    expect((await lines())[0]).toMatchObject({ amount: 0, ruleMissing: true });
  });

  it("nothing for failed, unfinished or duplicate payments, or for cash until it is verified", async () => {
    await setRule({ type: "FLAT", amount: 50_00 });
    const failed = await startPayment(member, months[0].id);
    await simulateTestPayment(member, failed.paymentId, "FAILED");
    await startPayment(member, months[0].id); // left unfinished
    const cash = await recordCash(agent, months[0].id);
    expect(await lines()).toHaveLength(0);

    await verifyCash(await makeUser("ADMIN", "9000000001"), cash.id);
    expect(await lines()).toHaveLength(1);

    const a = await startPayment(member, months[1].id);
    const b = await startPayment(member, months[1].id);
    await confirmPayment(a.orderId, { status: "SUCCESS", gatewayPaymentId: "CF-A", amount: 2_000_00 });
    await confirmPayment(b.orderId, { status: "SUCCESS", gatewayPaymentId: "CF-B", amount: 2_000_00 }); // duplicate
    await confirmPayment(a.orderId, { status: "SUCCESS", gatewayPaymentId: "CF-A", amount: 2_000_00 }); // webhook retry
    expect(await lines()).toHaveLength(2);
  });

  it("an agent sees only their own commission", async () => {
    await setRule({ type: "FLAT", amount: 50_00 });
    await pay(0);
    expect((await listMyCommission(agent)).earned).toBe(50_00);
    expect((await listMyCommission(await makeUser("AGENT", "9800000002"))).lines).toHaveLength(0);
    await failsWith(listMyCommission(member), "FORBIDDEN");
  });
});

describe("access control and switches", () => {
  it("members can't pay, simulate or read another member's payments", async () => {
    await failsWith(startPayment(other, months[0].id), "NOT_FOUND");
    const { paymentId } = await startPayment(member, months[0].id);
    await failsWith(simulateTestPayment(other, paymentId, "SUCCESS"), "NOT_FOUND");
    await failsWith(getPayment(other, paymentId), "NOT_FOUND");
    expect(await status(0)).toBe("DUE");
  });

  it("the enrolling agent can read the receipt; another agent can't", async () => {
    const { paymentId } = await startPayment(member, months[0].id);
    await expect(getPayment(agent, paymentId)).resolves.toMatchObject({ id: paymentId });
    await failsWith(getPayment(await makeUser("AGENT", "9800000002"), paymentId), "NOT_FOUND");
  });

  it("with no provider configured, online payment and the test checkout are off", async () => {
    const { paymentId } = await startPayment(member, months[0].id);
    vi.stubEnv("PAYMENT_PROVIDER", "");
    await failsWith(startPayment(member, months[1].id), "PAYMENTS_DISABLED");
    await failsWith(simulateTestPayment(member, paymentId, "SUCCESS"), "PAYMENTS_DISABLED");
    vi.stubEnv("PAYMENT_PROVIDER", "cashfree");
    await failsWith(simulateTestPayment(member, paymentId, "SUCCESS"), "PAYMENTS_DISABLED");
    expect(await status(0)).toBe("DUE");
  });
});
