import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import type { SessionUser } from "@/shared/auth";
import { failsWith, makeUser, resetDb } from "../../test/db";
import { exportCsv } from "./exports";
import { adminOverview } from "./overview";
import { recordCash, simulateTestPayment, startPayment } from "./payments";

let superAdmin: SessionUser, admin: SessionUser, agent: SessionUser, member: SessionUser, direct: SessionUser;
let months: { id: string }[];

beforeEach(async () => {
  vi.stubEnv("PAYMENT_PROVIDER", "test");
  await resetDb();
  [superAdmin, admin, agent, member, direct] = await Promise.all([
    makeUser("SUPER_ADMIN", "9999999999"),
    makeUser("ADMIN", "9000000001"),
    makeUser("AGENT", "9800000001"),
    makeUser("MEMBER", "9700000001"),
    makeUser("MEMBER", "9700000002"),
  ]);
  await db.agentProfile.create({ data: { userId: agent.id, panchayat: "Arang", pan: "ABCDE1234F", approved: true } });
  await db.memberProfile.create({ data: { userId: member.id, village: "Kurud", address: "Ward 3, Kurud" } });
  const scheme = await db.scheme.create({
    data: { code: "MANPASAND", nameEn: "Manpasand Plan", nameHi: "मनपसंद योजना", installmentAmount: 2_000_00, tenureMonths: 12, commissionRule: { type: "FLAT", amount: 50_00 } },
  });
  // Started two months ago: months 1–3 are due now.
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 2, 1));
  const batch = await db.batch.create({ data: { schemeId: scheme.id, number: 1, startMonth: start, size: 10, winnersPerDraw: 1 } });
  const mk = (m: SessionUser, a: SessionUser | null, seq: number) =>
    db.enrolment.create({
      data: {
        memberId: m.id,
        agentId: a?.id ?? null,
        batchId: batch.id,
        seq,
        tokenNumber: `MAN-B01-000${seq}`,
        installments: { create: Array.from({ length: 12 }, (_, i) => ({ monthNo: i + 1, dueDate: new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + i, 1)), amount: 2_000_00 })) },
      },
      include: { installments: { orderBy: { monthNo: "asc" } } },
    });
  months = (await mk(member, agent, 1)).installments;
  await mk(direct, null, 2);
  await simulateTestPayment(member, (await startPayment(member, months[0].id)).paymentId, "SUCCESS");
  await recordCash(agent, months[1].id);
});
afterEach(() => vi.unstubAllEnvs());

describe("admin overview", () => {
  it("counts what needs doing; money only for the super admin", async () => {
    const o = await adminOverview(superAdmin);
    expect(o).toMatchObject({
      members: 2,
      enrolments: { ACTIVE: 2 },
      pendingCash: { count: 1, amount: 2_000_00 },
      dueNow: { count: 4, amount: 8_000_00 }, // member: month 3; direct: months 1–3. Month 2 has cash waiting.
      drawsReady: 1,
      money: { collectedMonth: 2_000_00, collectedAll: 2_000_00, commissionNotInvoiced: 50_00 },
    });
    expect((await adminOverview(admin)).money).toBeNull();
    await failsWith(adminOverview(agent), "FORBIDDEN");
  });
});

describe("exports", () => {
  it("enrolments show the agent or that the member joined directly", async () => {
    const { csv } = await exportCsv(superAdmin, { kind: "enrolments" });
    const lines = csv.trim().split("\r\n");
    expect(lines).toHaveLength(3);
    expect(lines[1]).toContain("MAN-B01-0001,Manpasand Plan");
    expect(lines[1]).toContain(",1,2000.00,0");
    expect(lines[2]).toContain("Joined directly");
  });

  it("payments and commission follow the date range", async () => {
    const today = new Date().toISOString().slice(0, 10);
    const pay = await exportCsv(superAdmin, { kind: "payments" });
    expect(pay.csv).toContain("SUCCESS");
    expect(pay.csv).toContain("PENDING"); // cash still waiting shows up too
    expect((await exportCsv(superAdmin, { kind: "payments", from: "2020-01-01", to: "2020-01-31" })).csv.trim().split("\r\n")).toHaveLength(1);
    expect((await exportCsv(superAdmin, { kind: "commission", from: "2020-01-01", to: today })).csv).toContain("50.00");
    expect((await exportCsv(superAdmin, { kind: "agents" })).csv).toContain("ABCDE1234F");
  });

  it("only the super admin exports; bad input is refused", async () => {
    for (const u of [admin, agent, member]) await failsWith(exportCsv(u, { kind: "payments" }), "FORBIDDEN");
    await failsWith(exportCsv(superAdmin, { kind: "passwords" }), "VALIDATION");
    await failsWith(exportCsv(superAdmin, { kind: "payments", from: "01-01-2026" }), "VALIDATION");
  });
});
