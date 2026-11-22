import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import type { SessionUser } from "@/shared/auth";
import { periodStart } from "@/shared/network";
import { failsWith, makeUser, resetDb } from "../../test/db";
import { getAgentNetwork, getMyNetwork, getNetworkEnrolment, membersOverview, networkOverview } from "./network";
import { simulateTestPayment, startPayment } from "./payments";

let superAdmin: SessionUser, admin: SessionUser, agent: SessionUser, agent2: SessionUser, m1: SessionUser, m2: SessionUser, direct: SessionUser;
let batchId: string;
const ids: Record<string, string[]> = {};

async function enrol(m: SessionUser, a: SessionUser | null, seq: number) {
  const e = await db.enrolment.create({
    data: {
      memberId: m.id,
      agentId: a?.id ?? null,
      batchId,
      seq,
      tokenNumber: `MAN-B01-000${seq}`,
      installments: { create: Array.from({ length: 12 }, (_, i) => ({ monthNo: i + 1, dueDate: new Date(Date.UTC(2027, i, 1)), amount: 2_000_00 })) },
    },
    include: { installments: { orderBy: { monthNo: "asc" } } },
  });
  ids[e.id] = e.installments.map((i) => i.id);
  return e.id;
}
const pay = async (m: SessionUser, enrolmentId: string, month: number) =>
  simulateTestPayment(m, (await startPayment(m, ids[enrolmentId][month])).paymentId, "SUCCESS");

beforeEach(async () => {
  vi.stubEnv("PAYMENT_PROVIDER", "test");
  await resetDb();
  [superAdmin, admin, agent, agent2, m1, m2, direct] = await Promise.all([
    makeUser("SUPER_ADMIN", "9999999999"),
    makeUser("ADMIN", "9000000001"),
    makeUser("AGENT", "9800000001"),
    makeUser("AGENT", "9800000002"),
    makeUser("MEMBER", "9700000001"),
    makeUser("MEMBER", "9700000002"),
    makeUser("MEMBER", "9700000003"),
  ]);
  const scheme = await db.scheme.create({
    data: { code: "MANPASAND", nameEn: "Manpasand Plan", nameHi: "मनपसंद योजना", installmentAmount: 2_000_00, tenureMonths: 12, commissionRule: { type: "FLAT", amount: 50_00 } },
  });
  batchId = (await db.batch.create({ data: { schemeId: scheme.id, number: 1, startMonth: new Date("2027-01-01"), size: 2500, winnersPerDraw: 10 } })).id;
});
afterEach(() => vi.unstubAllEnvs());

describe("periods", () => {
  it("weeks start on Monday and months on the 1st, at midnight India time", () => {
    expect(periodStart("week", "2026-11-22").toISOString()).toBe("2026-11-15T18:30:00.000Z"); // Sun 22 Nov → Mon 16 Nov IST
    expect(periodStart("week", "2026-11-16").toISOString()).toBe("2026-11-15T18:30:00.000Z");
    expect(periodStart("month", "2026-11-22").toISOString()).toBe("2026-10-31T18:30:00.000Z");
    expect(periodStart("all", "2026-11-22").getTime()).toBe(0);
  });
});

describe("agent network", () => {
  it("shows each member's commission, and the period filter leaves out older earnings", async () => {
    const e1 = await enrol(m1, agent, 1);
    const e2 = await enrol(m2, agent, 2);
    await enrol(direct, null, 3);
    await pay(m1, e1, 0);
    await pay(m1, e1, 1);
    await pay(m2, e2, 0);
    // m2's commission was earned long ago.
    await db.commission.updateMany({ where: { payment: { memberId: m2.id } }, data: { createdAt: new Date("2020-01-01") } });

    const month = await getMyNetwork(agent, "month");
    expect(month.totals).toMatchObject({ people: 2, enrolments: 2, joined: 2, commission: 100_00 });
    expect(month.members.map((m) => [m.tokenNumber, m.commission])).toEqual([
      ["MAN-B01-0001", { period: 100_00, total: 100_00 }],
      ["MAN-B01-0002", { period: 0, total: 50_00 }],
    ]);
    expect((await getMyNetwork(agent, "all")).totals.commission).toBe(150_00);
    expect((await getMyNetwork(agent, "nonsense")).period).toBe("month");

    const detail = await getNetworkEnrolment(agent, e1);
    expect(detail.commission).toHaveLength(2);
    expect(detail.summary.paidCount).toBe(2);
  });

  it("super admin sees every agent, members who joined directly, and totals", async () => {
    const e1 = await enrol(m1, agent, 1);
    const d = await enrol(direct, null, 2);
    await pay(m1, e1, 0);
    await pay(direct, d, 0);
    const o = await networkOverview(superAdmin, "all");
    expect(o.agents.find((a) => a.id === agent.id)).toMatchObject({ members: 1, joined: 1, collected: 2_000_00, commission: 50_00, unpaid: 50_00, paidOut: 0 });
    expect(o.agents.find((a) => a.id === agent2.id)).toMatchObject({ members: 0, collected: 0 });
    expect(o.direct).toMatchObject({ members: 1, collected: 2_000_00, commission: 0 });
    expect(o.totals).toMatchObject({ members: 2, collected: 4_000_00, commission: 50_00 });
    expect((await getAgentNetwork(superAdmin, agent.id, "all")).members).toHaveLength(1);
  });
});

describe("members overview", () => {
  it("splits members who joined directly from those an agent enrolled, and counts both", async () => {
    const e1 = await enrol(m1, agent, 1);
    await enrol(m2, agent2, 2);
    const d = await enrol(direct, null, 3);
    await pay(m1, e1, 0);
    await pay(direct, d, 0);

    const viaAgents = await membersOverview(admin, "month", "agent");
    expect(viaAgents.totals).toMatchObject({ people: 3, joined: 3, direct: 1, throughAgents: 2, collected: 4_000_00 });
    expect(viaAgents.members.map((m) => [m.tokenNumber, m.agent?.phone])).toEqual(
      expect.arrayContaining([["MAN-B01-0001", agent.phone], ["MAN-B01-0002", agent2.phone]]),
    );
    expect(viaAgents.members).toHaveLength(2);
    expect(viaAgents.joinedSeries.counts.reduce((a, b) => a + b, 0)).toBe(3);

    const directOnly = await membersOverview(admin, "month", "direct");
    expect(directOnly.members.map((m) => [m.tokenNumber, m.agent])).toEqual([["MAN-B01-0003", null]]);
    expect((await membersOverview(admin, "month", "nonsense")).source).toBe("direct");
  });

  it("agents overview charts collections through agents and counts agents who joined", async () => {
    const e1 = await enrol(m1, agent, 1);
    const d = await enrol(direct, null, 2);
    await pay(m1, e1, 0);
    await pay(direct, d, 0); // joined directly: not collected "through agents"
    const o = await networkOverview(admin, "week");
    expect(o.collectedSeries.totals.reduce((a, b) => a + b, 0)).toBe(2_000_00);
    expect(o.collectedSeries.keys).toHaveLength(7);
    expect(o.agentsJoined).toBe(2);
  });
});

describe("access control", () => {
  it("agents see only their own members; only the super admin sees everyone", async () => {
    const e1 = await enrol(m1, agent, 1);
    expect((await getMyNetwork(agent2, "all")).members).toEqual([]);
    await failsWith(getNetworkEnrolment(agent2, e1), "NOT_FOUND");
    await expect(getNetworkEnrolment(superAdmin, e1)).resolves.toMatchObject({ id: e1 });
    // Admins see it too (client, Nov 2026); agents and members don't.
    await expect(networkOverview(admin, "all")).resolves.toMatchObject({ period: "all" });
    for (const u of [agent, m1]) {
      await failsWith(networkOverview(u, "all"), "FORBIDDEN");
      await failsWith(getAgentNetwork(u, agent.id, "all"), "FORBIDDEN");
      await failsWith(membersOverview(u, "all", "direct"), "FORBIDDEN");
    }
    await failsWith(getMyNetwork(m1, "all"), "FORBIDDEN");
    await failsWith(getNetworkEnrolment(m1, e1), "FORBIDDEN");
  });
});
