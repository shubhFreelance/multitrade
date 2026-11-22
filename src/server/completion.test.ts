import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import type { SessionUser } from "@/shared/auth";
import { failsWith, makeUser, resetDb } from "../../test/db";
import { confirmFulfilment, countUnread, listMyCompletions, listMyNotifications, markAllRead, sendQueuedSms } from "./completion";
import { runMonthlyDraw } from "./draws";
import { simulateTestPayment, startPayment } from "./payments";
import { sendSms } from "./sms";

vi.mock("./sms", () => ({ sendSms: vi.fn() }));

let admin: SessionUser, agent: SessionUser, member: SessionUser, other: SessionUser;

/** A batch of `code` that started 3 months ago, with one enrolment for `m`; months 1–3 paid. */
async function setup(code: "UPAHAR" | "MANPASAND" | "GOLD", m = member, tenure = 12) {
  const scheme = await db.scheme.upsert({
    where: { code },
    create: { code, nameEn: `${code} Plan`, nameHi: `${code} योजना`, installmentAmount: 2_000_00, tenureMonths: tenure, commissionRule: { type: "FLAT", amount: 50_00 } },
    update: {},
  });
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 2, 1));
  const batch = await db.batch.create({ data: { schemeId: scheme.id, number: Math.floor(Math.random() * 1e6), startMonth: start, size: 10, winnersPerDraw: 1 } });
  return db.enrolment.create({
    data: {
      memberId: m.id,
      agentId: agent.id,
      batchId: batch.id,
      seq: 1,
      tokenNumber: `${code.slice(0, 3)}-${batch.number}-0001`,
      installments: {
        create: Array.from({ length: tenure }, (_, i) => ({
          monthNo: i + 1,
          dueDate: new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + i, 1)),
          amount: 2_000_00,
          status: i < Math.min(3, tenure - 1) ? ("PAID" as const) : ("DUE" as const),
        })),
      },
    },
    include: { installments: { orderBy: { monthNo: "asc" } } },
  });
}

/** Pays every unpaid month online, oldest first. */
async function payAll(m: SessionUser, e: { installments: { id: string; status: string }[] }) {
  for (const i of e.installments.filter((x) => x.status === "DUE")) {
    await simulateTestPayment(m, (await startPayment(m, i.id)).paymentId, "SUCCESS");
  }
}

beforeEach(async () => {
  vi.mocked(sendSms).mockReset();
  vi.stubEnv("PAYMENT_PROVIDER", "test");
  await resetDb();
  [admin, agent, member, other] = await Promise.all([
    makeUser("ADMIN", "9000000001"),
    makeUser("AGENT", "9800000001"),
    makeUser("MEMBER", "9700000001"),
    makeUser("MEMBER", "9700000002"),
  ]);
  await db.memberProfile.create({ data: { userId: member.id, address: "Ward 3", village: "Kurud" } });
});
afterEach(() => vi.unstubAllEnvs());

describe("prompts on completion", () => {
  it("the last payment matures the enrolment, creates the prompt and sends one SMS", async () => {
    const e = await setup("UPAHAR");
    await payAll(member, e);
    expect(await db.enrolment.findUniqueOrThrow({ where: { id: e.id } })).toMatchObject({ status: "MATURED" });
    expect(await listMyCompletions(member)).toEqual([
      expect.objectContaining({ reason: "MATURED", status: "PENDING", value: 24_000_00, address: "Ward 3, Kurud" }),
    ]);
    expect(vi.mocked(sendSms).mock.calls).toEqual([[member.phone, expect.stringContaining(`${e.tokenNumber}) की सारी किस्तें जमा`)]]); // members read Hindi by default
    await sendQueuedSms(); // nothing left to send
    expect(sendSms).toHaveBeenCalledTimes(1);
    expect(await countUnread(member)).toBe(1);
    expect((await listMyNotifications(member))[0]).toMatchObject({ type: "MATURED", tokenNumber: e.tokenNumber });
    await markAllRead(member);
    expect(await countUnread(member)).toBe(0);
  });

  it("a draw winner gets the prompt too", async () => {
    const e = await setup("GOLD");
    await runMonthlyDraw(admin, { batchId: e.batchId, monthNo: 1 });
    // Only what was paid (3 months) counts towards the gold, not the waived months.
    expect(await listMyCompletions(member)).toEqual([expect.objectContaining({ reason: "WON", value: 6_000_00, scheme: expect.objectContaining({ code: "GOLD" }) })]);
    expect(vi.mocked(sendSms).mock.calls[0][1]).toContain(`${e.tokenNumber} ने`);
  });

  it("a failed SMS doesn't undo the payment and is sent on the next try", async () => {
    vi.mocked(sendSms).mockRejectedValueOnce(new Error("provider down"));
    const e = await setup("UPAHAR", member, 4);
    await payAll(member, e);
    expect(await db.enrolment.findUniqueOrThrow({ where: { id: e.id } })).toMatchObject({ status: "MATURED" });
    expect(await db.notification.findFirstOrThrow()).toMatchObject({ smsSentAt: null });
    await sendQueuedSms();
    expect(await db.notification.findFirstOrThrow()).toMatchObject({ smsSentAt: expect.any(Date) });
    expect(sendSms).toHaveBeenCalledTimes(2);
  });
});

describe("answering the prompt", () => {
  const finish = async (code: "UPAHAR" | "MANPASAND" | "GOLD") => {
    const e = await setup(code, member, 4);
    await payAll(member, e);
    return (await listMyCompletions(member))[0].id;
  };

  it("Upahar needs an address", async () => {
    const id = await finish("UPAHAR");
    await failsWith(confirmFulfilment(member, id, {}), "ADDRESS_REQUIRED");
    await confirmFulfilment(member, id, { address: "Ward 3, Kurud, Raipur" });
    expect((await listMyCompletions(member))[0]).toMatchObject({ status: "CONFIRMED", address: "Ward 3, Kurud, Raipur" });
    await failsWith(confirmFulfilment(member, id, { address: "Ward 3, Kurud, Raipur" }), "ALREADY_CONFIRMED");
  });

  it("Manpasand needs an available Manpasand product, and shows what is left to pay", async () => {
    const id = await finish("MANPASAND"); // 4 months: worth ₹8,000
    const [tv, gone, gold, fan] = await Promise.all([
      db.product.create({ data: { name: "TV", price: 9_500_00, schemes: ["MANPASAND"], stock: 3 } }),
      db.product.create({ data: { name: "Fridge", price: 7_000_00, schemes: ["MANPASAND"], stock: 0 } }),
      db.product.create({ data: { name: "Coin", price: 7_000_00, schemes: ["GOLD"], stock: 3 } }),
      db.product.create({ data: { name: "Fan", price: 6_000_00, schemes: ["MANPASAND"], stock: 1 } }),
    ]);
    // Cheaper than what was paid: no refund, and the member is told how much (client, #4).
    expect((await listMyCompletions(member))[0].products).toEqual([
      expect.objectContaining({ id: fan.id, difference: 0, notRefunded: 2_000_00 }),
      expect.objectContaining({ id: tv.id, difference: 1_500_00, notRefunded: 0 }),
    ]);
    await failsWith(confirmFulfilment(member, id, { address: "Ward 3, Kurud" }), "PRODUCT_UNAVAILABLE");
    await failsWith(confirmFulfilment(member, id, { address: "Ward 3, Kurud", productId: gone.id }), "PRODUCT_UNAVAILABLE");
    await failsWith(confirmFulfilment(member, id, { address: "Ward 3, Kurud", productId: gold.id }), "PRODUCT_UNAVAILABLE");
    await confirmFulfilment(member, id, { address: "Ward 3, Kurud", productId: tv.id });
    expect((await listMyCompletions(member))[0]).toMatchObject({ status: "CONFIRMED", product: { name: "TV", difference: 1_500_00 } });
  });

  it("Gold just books; only the owner can answer", async () => {
    const id = await finish("GOLD");
    await failsWith(confirmFulfilment(other, id, {}), "NOT_FOUND");
    await failsWith(confirmFulfilment(agent, id, {}), "FORBIDDEN");
    await confirmFulfilment(member, id, {});
    expect((await listMyCompletions(member))[0]).toMatchObject({ status: "CONFIRMED" });
    expect(await listMyCompletions(other)).toEqual([]);
  });
});
