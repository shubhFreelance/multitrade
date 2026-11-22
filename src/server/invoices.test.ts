import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import hi from "../../messages/hi.json";
import { db } from "@/lib/db";
import type { SessionUser } from "@/shared/auth";
import { todayInIndia } from "@/shared/tracker";
import { failsWith, makeUser, resetDb } from "../../test/db";
import { agentInvoicePdf, memberInvoicePdf } from "./invoice-pdf";
import { cancelAgentInvoice, createAgentInvoices, financialYear, getAgentInvoice, invoiceOverview, listMyInvoices, markAgentInvoicePaid } from "./invoices";
import { getPayment, simulateTestPayment, startPayment } from "./payments";

// Render PDFs with the real Hindi labels, outside a Next request.
vi.mock("next-intl/server", () => ({
  getLocale: async () => "hi",
  getTranslations: async (ns: string) => (key: string, vals: Record<string, unknown> = {}) =>
    String((hi as unknown as Record<string, Record<string, string>>)[ns][key]).replace(/\{(\w+)\}/g, (_, k) => String(vals[k])),
}));

let superAdmin: SessionUser, admin: SessionUser, agent: SessionUser, agent2: SessionUser, member: SessionUser, member2: SessionUser;
let months: { id: string }[], months2: { id: string }[];

/** "YYYY-MM" of the month before this one (India). */
const lastMonth = () => {
  const [y, m] = todayInIndia().split("-").map(Number);
  return new Date(Date.UTC(y, m - 2, 1)).toISOString().slice(0, 7);
};

async function enrol(m: SessionUser, a: SessionUser, batchId: string, seq: number) {
  const e = await db.enrolment.create({
    data: {
      memberId: m.id,
      agentId: a.id,
      batchId,
      seq,
      tokenNumber: `MAN-B01-000${seq}`,
      installments: { create: Array.from({ length: 12 }, (_, i) => ({ monthNo: i + 1, dueDate: new Date(Date.UTC(2027, i, 1)), amount: 2_000_00 })) },
    },
    include: { installments: { orderBy: { monthNo: "asc" } } },
  });
  return e.installments;
}

const pay = async (m: SessionUser, installmentId: string) => {
  const { paymentId } = await startPayment(m, installmentId);
  return simulateTestPayment(m, paymentId, "SUCCESS");
};

/** Pretends existing commission was earned last month, so last month's invoice run picks it up. */
const backdateCommission = () => db.commission.updateMany({ data: { createdAt: new Date(`${lastMonth()}-15T06:00:00Z`) } });

beforeEach(async () => {
  vi.stubEnv("PAYMENT_PROVIDER", "test");
  await resetDb();
  [superAdmin, admin, agent, agent2, member, member2] = await Promise.all([
    makeUser("SUPER_ADMIN", "9999999999"),
    makeUser("ADMIN", "9000000001"),
    makeUser("AGENT", "9800000001"),
    makeUser("AGENT", "9800000002"),
    makeUser("MEMBER", "9700000001"),
    makeUser("MEMBER", "9700000002"),
  ]);
  await db.agentProfile.create({ data: { userId: agent.id, panchayat: "Arang", pan: "ABCDE1234F" } });
  await db.config.create({ data: { key: "tdsBps", value: 200 } });
  const scheme = await db.scheme.create({
    data: { code: "MANPASAND", nameEn: "Manpasand Plan", nameHi: "मनपसंद योजना", installmentAmount: 2_000_00, tenureMonths: 12, commissionRule: { type: "FLAT", amount: 50_00 } },
  });
  const batch = await db.batch.create({ data: { schemeId: scheme.id, number: 1, startMonth: new Date("2027-01-01"), size: 10, winnersPerDraw: 1 } });
  months = await enrol(member, agent, batch.id, 1);
  months2 = await enrol(member2, agent2, batch.id, 2);
});
afterEach(() => vi.unstubAllEnvs());

describe("member invoices", () => {
  it("every counted payment gets the next number in the financial year's series", async () => {
    const a = await pay(member, months[0].id);
    const b = await pay(member, months[1].id);
    const fy = financialYear(new Date());
    expect([a.invoiceNo, b.invoiceNo]).toEqual([`SM/${fy}/000001`, `SM/${fy}/000002`]);
  });

  it("parallel payments never share a number", async () => {
    const orders = await Promise.all([startPayment(member, months[0].id), startPayment(member2, months2[0].id)]);
    const paid = await Promise.all([simulateTestPayment(member, orders[0].paymentId, "SUCCESS"), simulateTestPayment(member2, orders[1].paymentId, "SUCCESS")]);
    expect(new Set(paid.map((p) => p.invoiceNo)).size).toBe(2);
  });

  it("failed payments get no invoice", async () => {
    const { paymentId } = await startPayment(member, months[0].id);
    expect((await simulateTestPayment(member, paymentId, "FAILED")).invoiceNo).toBeNull();
  });

  it("the financial year turns over at midnight on 31 March, India time", () => {
    expect(financialYear(new Date("2027-03-31T18:29:00Z"))).toBe("2026-27"); // 23:59 IST
    expect(financialYear(new Date("2027-03-31T18:30:00Z"))).toBe("2027-28"); // 00:00 IST, 1 April
  });

  it("renders a Hindi PDF", async () => {
    const p = await pay(member, months[0].id);
    const pdf = await memberInvoicePdf(await getPayment(member, p.id));
    expect(Buffer.from(pdf.slice(0, 5)).toString()).toBe("%PDF-");
  });
});

describe("agent commission invoices", () => {
  it("one invoice per agent for last month, with TDS and net exact to the paisa", async () => {
    await pay(member, months[0].id);
    await pay(member, months[1].id);
    await pay(member2, months2[0].id);
    await backdateCommission();

    const created = await createAgentInvoices(superAdmin, { period: lastMonth() });
    expect(created).toHaveLength(2);
    const mine = created.find((i) => i.agentId === agent.id)!;
    expect(mine).toMatchObject({ gross: 100_00, tdsBps: 200, tds: 2_00, net: 98_00, status: "ISSUED" });
    expect(mine.number).toMatch(/^SMC\/\d{4}-\d{2}\/\d{4}$/);
    expect(await db.commission.count({ where: { invoiceId: mine.id } })).toBe(2);

    // Running it again for the same month creates nothing new.
    expect(await createAgentInvoices(superAdmin, { period: lastMonth() })).toHaveLength(0);
  });

  it("commission earned after the month ends waits for the next invoice", async () => {
    await pay(member, months[0].id); // earned now, i.e. this month
    expect(await createAgentInvoices(superAdmin, { period: lastMonth() })).toHaveLength(0);
  });

  it("Upahar lines without a rate are left off", async () => {
    await db.scheme.updateMany({ data: { commissionRule: { type: "TIER", tiers: [] } } });
    await pay(member, months[0].id);
    await backdateCommission();
    expect(await createAgentInvoices(superAdmin, { period: lastMonth() })).toHaveLength(0);
    expect((await invoiceOverview(superAdmin)).awaitingRate).toBe(1);
  });

  it("refuses the current or a future month", async () => {
    await failsWith(createAgentInvoices(superAdmin, { period: todayInIndia().slice(0, 7) }), "PERIOD_NOT_OVER");
    await failsWith(createAgentInvoices(superAdmin, { period: "2099-01" }), "PERIOD_NOT_OVER");
  });

  it("marking paid records the UTR and marks every line paid; a paid invoice can't be cancelled", async () => {
    await pay(member, months[0].id);
    await backdateCommission();
    const [inv] = await createAgentInvoices(superAdmin, { period: lastMonth() });
    await failsWith(markAgentInvoicePaid(superAdmin, inv.id, { utr: "x" }), "VALIDATION");
    await markAgentInvoicePaid(superAdmin, inv.id, { utr: "HDFC12345678" });
    expect(await db.agentInvoice.findUniqueOrThrow({ where: { id: inv.id } })).toMatchObject({ status: "PAID", utr: "HDFC12345678" });
    expect(await db.commission.findMany({ where: { invoiceId: inv.id } })).toEqual([expect.objectContaining({ status: "PAID" })]);
    await failsWith(cancelAgentInvoice(superAdmin, inv.id), "INVOICE_NOT_ISSUED");
    await failsWith(markAgentInvoicePaid(superAdmin, inv.id, { utr: "HDFC12345678" }), "INVOICE_NOT_ISSUED");
  });

  it("cancelling puts the lines back, and a fresh invoice can be made", async () => {
    await pay(member, months[0].id);
    await backdateCommission();
    const [first] = await createAgentInvoices(superAdmin, { period: lastMonth() });
    await cancelAgentInvoice(superAdmin, first.id);
    expect(await db.commission.count({ where: { invoiceId: null } })).toBe(1);
    const [second] = await createAgentInvoices(superAdmin, { period: lastMonth() });
    expect(second.number).not.toBe(first.number);
    expect(await listMyInvoices(agent)).toEqual([expect.objectContaining({ id: second.id })]);
  });

  it("renders a Hindi PDF with the agent's lines", async () => {
    await pay(member, months[0].id);
    await backdateCommission();
    const [inv] = await createAgentInvoices(superAdmin, { period: lastMonth() });
    const pdf = await agentInvoicePdf(await getAgentInvoice(agent, inv.id));
    expect(Buffer.from(pdf.slice(0, 5)).toString()).toBe("%PDF-");
  });
});

describe("access control", () => {
  it("only the super admin manages invoices", async () => {
    for (const u of [admin, agent, member]) {
      await failsWith(createAgentInvoices(u, { period: lastMonth() }), "FORBIDDEN");
      await failsWith(invoiceOverview(u), "FORBIDDEN");
    }
  });

  it("an agent can read only their own invoice; members can't read agent invoices", async () => {
    await pay(member, months[0].id);
    await backdateCommission();
    const [inv] = await createAgentInvoices(superAdmin, { period: lastMonth() });
    await expect(getAgentInvoice(agent, inv.id)).resolves.toMatchObject({ id: inv.id });
    await failsWith(getAgentInvoice(agent2, inv.id), "NOT_FOUND");
    await failsWith(getAgentInvoice(member, inv.id), "FORBIDDEN");
  });
});
