import { beforeEach, describe, expect, it, vi } from "vitest";
import en from "../../messages/en.json";
import { db } from "@/lib/db";
import { toCsv } from "@/lib/csv";
import type { SessionUser } from "@/shared/auth";
import { failsWith, makeUser, resetDb } from "../../test/db";
import { agentStatementCsv } from "./statement";

// English labels, outside a Next request.
vi.mock("next-intl/server", () => ({
  getLocale: async () => "en",
  getTranslations: async (ns: string) => (key: string) => key.split(".").reduce<unknown>((o, k) => (o as Record<string, unknown>)[k], (en as Record<string, unknown>)[ns]) as string,
}));

let superAdmin: SessionUser, admin: SessionUser, agent: SessionUser, agent2: SessionUser, member: SessionUser;

beforeEach(async () => {
  await resetDb();
  [superAdmin, admin, agent, agent2, member] = await Promise.all([
    makeUser("SUPER_ADMIN", "9999999999"),
    makeUser("ADMIN", "9000000001"),
    makeUser("AGENT", "9800000001"),
    makeUser("AGENT", "9800000002"),
    makeUser("MEMBER", "9700000001"),
  ]);
  await db.user.update({ where: { id: member.id }, data: { name: 'Geeta "Sahu", Kurud' } });
  const scheme = await db.scheme.create({
    data: { code: "MANPASAND", nameEn: "Manpasand Plan", nameHi: "मनपसंद योजना", installmentAmount: 2_000_00, tenureMonths: 12, commissionRule: { type: "FLAT", amount: 50_00 } },
  });
  const batch = await db.batch.create({ data: { schemeId: scheme.id, number: 1, startMonth: new Date("2026-10-01"), size: 10, winnersPerDraw: 1 } });
  const e = await db.enrolment.create({
    data: {
      memberId: member.id,
      agentId: agent.id,
      batchId: batch.id,
      seq: 1,
      tokenNumber: "MAN-B01-0001",
      installments: { create: [{ monthNo: 1, dueDate: new Date("2026-10-01"), amount: 2_000_00, status: "PAID" }] },
    },
    include: { installments: true },
  });
  const p = await db.payment.create({
    data: { installmentId: e.installments[0].id, memberId: member.id, method: "ONLINE", provider: "TEST", amount: 2_000_00, orderId: "O-1", status: "SUCCESS", paidAt: new Date("2026-10-05T06:00:00Z") },
  });
  const inv = await db.agentInvoice.create({
    data: { number: "SMC/2026-27/0001", agentId: agent.id, period: "2026-10", gross: 1_550_00, tdsBps: 200, tds: 31_00, net: 1_519_00, status: "PAID", utr: "HDFC12345678", paidAt: new Date("2026-11-03T06:00:00Z"), createdById: superAdmin.id },
  });
  await db.commission.createMany({
    data: [
      { agentId: agent.id, paymentId: p.id, amount: 50_00, status: "PAID", invoiceId: inv.id, createdAt: new Date("2026-10-05T06:00:00Z") },
      { agentId: agent.id, type: "BONUS", amount: 1_500_00, campaign: "2026-09-01/2026-09-30", status: "PAID", invoiceId: inv.id, createdAt: new Date("2026-10-06T06:00:00Z") },
      { agentId: agent2.id, type: "BONUS", amount: 4_000_00, campaign: "2026-09-01/2026-09-30", createdAt: new Date("2026-10-06T06:00:00Z") },
    ],
  });
});

describe("agent statement", () => {
  it("lists commission, bonus and payout rows in date order, amounts in rupees", async () => {
    const { csv, name } = await agentStatementCsv(agent);
    expect(name).toMatch(/^statement-9800000001-/);
    const lines = csv.replace("﻿", "").trim().split("\r\n");
    expect(lines[0]).toBe("Date,Type,Member or campaign,Token,Month,Commission (₹),Invoice,Gross (₹),TDS (₹),Paid to you (₹),UTR,Status");
    expect(lines.slice(1)).toEqual([
      '2026-10-05,Commission,"Geeta ""Sahu"", Kurud",MAN-B01-0001,October 2026,50.00,SMC/2026-27/0001,,,,,Paid',
      "2026-10-06,Recruitment bonus,2026-09-01/2026-09-30,,,1500.00,SMC/2026-27/0001,,,,,Paid",
      "2026-11-03,Payout,,,October 2026,,SMC/2026-27/0001,1550.00,31.00,1519.00,HDFC12345678,Paid",
    ]);
  });

  it("agents get only their own; the super admin any agent's", async () => {
    expect((await agentStatementCsv(agent2, agent.id)).csv).not.toContain("Geeta"); // the id is ignored for agents
    expect((await agentStatementCsv(superAdmin, agent.id)).csv).toContain("HDFC12345678");
    await failsWith(agentStatementCsv(superAdmin, member.id), "NOT_FOUND");
    await failsWith(agentStatementCsv(admin, agent.id), "FORBIDDEN");
    await failsWith(agentStatementCsv(member), "FORBIDDEN");
  });

  it("keeps formulas out of spreadsheet cells", () => {
    expect(toCsv([["=HYPERLINK(1)", -5, "a,b"]])).toBe("﻿'=HYPERLINK(1),-5,\"a,b\"\r\n");
  });
});
