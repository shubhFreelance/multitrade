import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import type { SessionUser } from "@/shared/auth";
import { failsWith, makeUser, resetDb } from "../../test/db";
import { listAgentEnrolments, listMyEnrolments } from "./tracker";

let batchId: string;
let agentA: SessionUser, agentB: SessionUser, memberA: SessionUser, memberB: SessionUser;

/** An enrolment with 12 installments; the first `paid` are PAID. Months start Jan 2020 so all are already due. */
async function enrol(member: SessionUser, agent: SessionUser, seq: number, paid: number) {
  return db.enrolment.create({
    data: {
      memberId: member.id,
      agentId: agent.id,
      batchId,
      seq,
      tokenNumber: `UPH-B01-${String(seq).padStart(4, "0")}`,
      installments: {
        create: Array.from({ length: 12 }, (_, i) => ({
          monthNo: i + 1,
          dueDate: new Date(Date.UTC(2020, i, 1)),
          amount: 2_000_00,
          status: i < paid ? ("PAID" as const) : ("DUE" as const),
        })),
      },
    },
  });
}

beforeEach(async () => {
  await resetDb();
  const scheme = await db.scheme.create({
    data: { code: "UPAHAR", nameEn: "Upahar Plan", nameHi: "उपहार योजना", installmentAmount: 2_000_00, tenureMonths: 12, commissionRule: {} },
  });
  batchId = (await db.batch.create({ data: { schemeId: scheme.id, number: 1, startMonth: new Date("2020-01-01"), size: 10, winnersPerDraw: 1 } })).id;
  [agentA, agentB, memberA, memberB] = await Promise.all([
    makeUser("AGENT", "9800000001"),
    makeUser("AGENT", "9800000002"),
    makeUser("MEMBER", "9700000001"),
    makeUser("MEMBER", "9700000002"),
  ]);
});

describe("member view", () => {
  it("shows only the member's own enrolments, with paid totals", async () => {
    await enrol(memberA, agentA, 1, 4);
    await enrol(memberB, agentA, 2, 12);
    const mine = await listMyEnrolments(memberA);
    expect(mine.map((e) => e.tokenNumber)).toEqual(["UPH-B01-0001"]);
    expect(mine[0].summary).toMatchObject({ paidCount: 4, paidTotal: 8_000_00, dueNowCount: 8, dueNowTotal: 16_000_00 });
    expect(mine[0].agent?.phone).toBe(agentA.phone);
  });

  it("agents and admins can't use the member view", async () => {
    await failsWith(listMyEnrolments(agentA), "FORBIDDEN");
    await failsWith(listMyEnrolments(await makeUser("ADMIN", "9000000001")), "FORBIDDEN");
    await failsWith(listMyEnrolments(null), "UNAUTHENTICATED");
  });
});

describe("agent view", () => {
  it("shows only members this agent enrolled, those owing money first", async () => {
    await enrol(memberA, agentA, 1, 12); // fully paid
    await enrol(memberB, agentA, 2, 3); // owes 9 months
    await enrol(memberA, agentB, 3, 0); // another agent's
    const list = await listAgentEnrolments(agentA);
    expect(list.map((e) => e.tokenNumber)).toEqual(["UPH-B01-0002", "UPH-B01-0001"]);
    expect(list[0].member.phone).toBe(memberB.phone);
    expect((await listAgentEnrolments(agentB)).map((e) => e.tokenNumber)).toEqual(["UPH-B01-0003"]);
  });

  it("members can't use the agent view", async () => {
    await failsWith(listAgentEnrolments(memberA), "FORBIDDEN");
  });
});
