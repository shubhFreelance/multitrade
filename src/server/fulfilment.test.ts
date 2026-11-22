import { beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import type { SessionUser } from "@/shared/auth";
import { differenceDue, goldPrice, gramsToMg } from "@/shared/fulfilment";
import { failsWith, makeUser, resetDb } from "../../test/db";
import { confirmFulfilment, listMyCompletions } from "./completion";
import { allocate, listFulfilments, markDelivered, recordDifferencePaid, setGoldRate } from "./fulfilment";

vi.mock("./sms", () => ({ sendSms: vi.fn() }));

let admin: SessionUser, agent: SessionUser, member: SessionUser;

/** A matured 12-month enrolment worth ₹24,000 with its completion answered (CONFIRMED) by the member. */
async function completed(code: "UPAHAR" | "MANPASAND" | "GOLD", answer: { address?: string; productId?: string } = {}) {
  const scheme = await db.scheme.create({
    data: { code, nameEn: code, nameHi: code, installmentAmount: 2_000_00, tenureMonths: 12, commissionRule: { type: "FLAT", amount: 0 } },
  });
  const batch = await db.batch.create({ data: { schemeId: scheme.id, number: 1, startMonth: new Date("2026-01-01"), size: 10, winnersPerDraw: 1 } });
  const e = await db.enrolment.create({
    data: {
      memberId: member.id,
      agentId: agent.id,
      batchId: batch.id,
      seq: 1,
      status: "MATURED",
      tokenNumber: `${code}-B01-0001`,
      installments: { create: Array.from({ length: 12 }, (_, i) => ({ monthNo: i + 1, dueDate: new Date(Date.UTC(2026, i, 1)), amount: 2_000_00, status: "PAID" as const })) },
      fulfilment: { create: { reason: "MATURED" } },
    },
    include: { fulfilment: true },
  });
  await confirmFulfilment(member, e.fulfilment!.id, answer);
  return e.fulfilment!.id;
}

beforeEach(async () => {
  await resetDb();
  [admin, agent, member] = await Promise.all([makeUser("ADMIN", "9000000001"), makeUser("AGENT", "9800000001"), makeUser("MEMBER", "9700000001")]);
});

describe("price maths, exact to the paisa", () => {
  it("gold: rate × weight + making + 3% GST on both", () => {
    // ₹7,234.56/g × 10.255 g = ₹74,190.4128 → ₹74,190.41; making ₹1,500.00; GST 3% of ₹75,690.41 = ₹2,270.7123 → ₹2,270.71.
    const p = goldPrice({ ratePerGram: 7_234_56, weightMg: 10_255, making: 1_500_00, gstBps: 300 });
    expect(p).toMatchObject({ gold: 74_190_41, making: 1_500_00, gst: 2_270_71, total: 77_961_12 });
    expect(p.gold + p.making + p.gst).toBe(p.total);
  });
  it("difference is the price above the plan value, never negative", () => {
    expect(differenceDue(77_961_12, 24_000_00)).toBe(53_961_12);
    expect(differenceDue(25_999_99, 24_000_00)).toBe(1_999_99);
    expect(differenceDue(18_500_00, 24_000_00)).toBe(0);
  });
  it("reads grams with up to 3 decimals", () => {
    expect([gramsToMg("10"), gramsToMg("10.5"), gramsToMg("10.255"), gramsToMg("10.2555"), gramsToMg("-1")]).toEqual([10_000, 10_500, 10_255, null, null]);
  });
});

describe("fulfilment", () => {
  it("Manpasand: the member's product, difference due, paid, delivered; stock goes down", async () => {
    const tv = await db.product.create({ data: { name: "TV", price: 25_999_99, schemes: ["MANPASAND"], stock: 2 } });
    const id = await completed("MANPASAND", { address: "Ward 3, Kurud", productId: tv.id });
    const f = await allocate(admin, id, {});
    expect(f).toMatchObject({ status: "ALLOCATED", price: 25_999_99, differenceDue: 1_999_99 });
    expect((await db.product.findUniqueOrThrow({ where: { id: tv.id } })).stock).toBe(1);

    await failsWith(markDelivered(admin, id), "DIFFERENCE_UNPAID");
    await failsWith(recordDifferencePaid(admin, id, { ref: "x" }), "VALIDATION");
    await recordDifferencePaid(admin, id, { ref: "UPI-123456" });
    await failsWith(recordDifferencePaid(admin, id, { ref: "UPI-123456" }), "ALREADY_PAID");
    expect(await markDelivered(admin, id)).toMatchObject({ status: "DELIVERED" });
    await failsWith(markDelivered(admin, id), "WRONG_STEP");
    expect(await listMyCompletions(member)).toEqual([]); // delivered: the prompt is gone
  });

  it("Upahar: the office picks the product; nothing to pay; out of stock refused", async () => {
    const id = await completed("UPAHAR", { address: "Ward 3, Kurud" });
    const gone = await db.product.create({ data: { name: "Cooker", price: 3_000_00, schemes: ["UPAHAR"], stock: 0 } });
    const mixer = await db.product.create({ data: { name: "Mixer", price: 4_500_00, schemes: ["UPAHAR"], stock: 1 } });
    await failsWith(allocate(admin, id, {}), "PRODUCT_UNAVAILABLE");
    await failsWith(allocate(admin, id, { productId: gone.id }), "OUT_OF_STOCK");
    expect(await allocate(admin, id, { productId: mixer.id })).toMatchObject({ productId: mixer.id, differenceDue: 0 });
    expect(await markDelivered(admin, id)).toMatchObject({ status: "DELIVERED" });
  });

  it("Gold: needs today's rate; priced with it; shown to the member", async () => {
    const id = await completed("GOLD");
    await failsWith(allocate(admin, id, { weightMg: 10_255, making: 1_500_00 }), "NO_GOLD_RATE");
    await setGoldRate(admin, { ratePerGram: 7_000_00 });
    await setGoldRate(admin, { ratePerGram: 7_234_56 }); // corrected the same day
    await failsWith(allocate(admin, id, {}), "VALIDATION");
    const f = await allocate(admin, id, { weightMg: 10_255, making: 1_500_00 });
    expect(f).toMatchObject({ price: 77_961_12, differenceDue: 53_961_12, priceDetails: expect.objectContaining({ ratePerGram: 7_234_56, gst: 2_270_71 }) });
    expect((await listMyCompletions(member))[0]).toMatchObject({ status: "ALLOCATED", price: 77_961_12, differenceDue: 53_961_12, differencePaid: false });
  });

  it("can't allocate before the member answers", async () => {
    const id = await completed("UPAHAR", { address: "Ward 3, Kurud" });
    await db.fulfilment.update({ where: { id }, data: { status: "PENDING" } });
    await failsWith(allocate(admin, id, {}), "WRONG_STEP");
  });

  it("only admins run fulfilment and set the gold rate", async () => {
    const id = await completed("UPAHAR", { address: "Ward 3, Kurud" });
    for (const u of [agent, member]) {
      await failsWith(listFulfilments(u), "FORBIDDEN");
      await failsWith(allocate(u, id, {}), "FORBIDDEN");
      await failsWith(markDelivered(u, id), "FORBIDDEN");
      await failsWith(setGoldRate(u, { ratePerGram: 1 }), "FORBIDDEN");
    }
  });
});
