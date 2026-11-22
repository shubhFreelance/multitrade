import { beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import type { SessionUser } from "@/shared/auth";
import { failsWith, makeUser, resetDb } from "../../test/db";
import { requestOtp, verifyOtp } from "./auth";
import { confirmEnrolment, listOpenBatches, sendEnrolmentCode } from "./enrolment";
import { sendSms } from "./sms";

vi.mock("./sms", () => ({ sendSms: vi.fn() }));

/** The code from the last SMS sent to `phone`. */
const codeFor = (phone: string) => vi.mocked(sendSms).mock.calls.filter(([p]) => p === phone).at(-1)![1].match(/code: (\d{6})/i)![1];

let agent: SessionUser;
let batchId: string;

const makeBatch = async (size = 2500, number = 1) => {
  const scheme = await db.scheme.upsert({
    where: { code: "UPAHAR" },
    create: { code: "UPAHAR", nameEn: "Upahar Plan", nameHi: "उपहार योजना", installmentAmount: 2_000_00, tenureMonths: 12, commissionRule: {} },
    update: {},
  });
  return (await db.batch.create({ data: { schemeId: scheme.id, number, startMonth: new Date("2027-01-01"), size, winnersPerDraw: 10 } })).id;
};

const details = { name: "Geeta Sahu", village: "Kurud", address: "Ward 3, Kurud" };

/** Runs both steps for a new member. */
const enrol = async (phone: string, batch = batchId, who = agent) => {
  await sendEnrolmentCode(who, { phone, batchId: batch });
  return confirmEnrolment(who, { phone, batchId: batch, code: codeFor(phone), ...details });
};

beforeEach(async () => {
  vi.mocked(sendSms).mockClear();
  await resetDb();
  agent = await makeUser("AGENT", "9800000001");
  await db.agentProfile.create({ data: { userId: agent.id, panchayat: "Arang", approved: true } });
  batchId = await makeBatch();
});

describe("enrolment", () => {
  it("creates the member, a token number and 12 monthly installments", async () => {
    const res = await enrol("9700000001");
    expect(res.tokenNumber).toBe("UPH-B01-0001");

    const e = await db.enrolment.findUniqueOrThrow({ where: { id: res.id }, include: { member: { include: { memberProfile: true } }, installments: { orderBy: { monthNo: "asc" } } } });
    expect(e.agentId).toBe(agent.id);
    expect(e.member).toMatchObject({ phone: "9700000001", name: "Geeta Sahu", role: "MEMBER" });
    expect(e.member.memberProfile).toMatchObject({ village: "Kurud", address: "Ward 3, Kurud" });
    expect(e.installments).toHaveLength(12);
    expect(e.installments.every((i) => i.amount === 2_000_00 && i.status === "DUE")).toBe(true);
    expect(e.installments.map((i) => i.dueDate.toISOString().slice(0, 10))).toEqual(
      Array.from({ length: 12 }, (_, i) => `2027-${String(i + 1).padStart(2, "0")}-01`),
    );
  });

  it("numbers tokens in order and lets an existing member enrol again without re-entering details", async () => {
    const first = await enrol("9700000001");
    await enrol("9700000002");
    await sendEnrolmentCode(agent, { phone: "9700000001", batchId });
    const again = await confirmEnrolment(agent, { phone: "9700000001", batchId, code: codeFor("9700000001") });
    expect(again.tokenNumber).toBe("UPH-B01-0003");
    const memberId = (await db.enrolment.findUniqueOrThrow({ where: { id: first.id } })).memberId;
    expect(await db.enrolment.count({ where: { memberId } })).toBe(2);
  });

  it("tells the agent whether the phone is already a member", async () => {
    expect(await sendEnrolmentCode(agent, { phone: "9700000001", batchId })).toEqual({ existingMember: false });
    await makeUser("MEMBER", "9700000009");
    expect(await sendEnrolmentCode(agent, { phone: "9700000009", batchId })).toEqual({ existingMember: true });
  });

  it("the code only approves the batch it was sent for", async () => {
    const other = await makeBatch(2500, 2);
    await sendEnrolmentCode(agent, { phone: "9700000001", batchId });
    await failsWith(confirmEnrolment(agent, { phone: "9700000001", batchId: other, code: codeFor("9700000001"), ...details }), "INVALID_OTP");
    expect(await db.enrolment.count()).toBe(0);
  });

  it("asks for details of a new member before using up the code", async () => {
    await sendEnrolmentCode(agent, { phone: "9700000001", batchId });
    const code = codeFor("9700000001");
    await failsWith(confirmEnrolment(agent, { phone: "9700000001", batchId, code }), "MEMBER_DETAILS_REQUIRED");
    await expect(confirmEnrolment(agent, { phone: "9700000001", batchId, code, ...details })).resolves.toBeTruthy();
  });

  it("login codes and enrolment codes for one phone don't replace each other", async () => {
    await makeUser("MEMBER", "9700000001");
    await requestOtp("9700000001");
    const loginCode = codeFor("9700000001");
    await sendEnrolmentCode(agent, { phone: "9700000001", batchId });
    await confirmEnrolment(agent, { phone: "9700000001", batchId, code: codeFor("9700000001") });
    await expect(verifyOtp("9700000001", loginCode)).resolves.toBeTruthy();
  });
});

describe("batch rules", () => {
  it("refuses a full batch", async () => {
    const small = await makeBatch(1, 2);
    await enrol("9700000001", small);
    await failsWith(sendEnrolmentCode(agent, { phone: "9700000002", batchId: small }), "BATCH_FULL");
    expect((await listOpenBatches(agent)).map((b) => b.id)).toEqual([batchId]);
  });

  it("two agents filling the last seat at once: one gets it, the other is told the batch is full", async () => {
    const small = await makeBatch(1, 2);
    await sendEnrolmentCode(agent, { phone: "9700000001", batchId: small });
    await sendEnrolmentCode(agent, { phone: "9700000002", batchId: small });
    const results = await Promise.allSettled(
      ["9700000001", "9700000002"].map((phone) => confirmEnrolment(agent, { phone, batchId: small, code: codeFor(phone), ...details })),
    );
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(results.find((r) => r.status === "rejected")).toMatchObject({ reason: { code: "BATCH_FULL" } });
  });

  it("parallel enrolments get different token numbers", async () => {
    const phones = ["9700000001", "9700000002", "9700000003", "9700000004"];
    for (const phone of phones) await sendEnrolmentCode(agent, { phone, batchId });
    const res = await Promise.all(phones.map((phone) => confirmEnrolment(agent, { phone, batchId, code: codeFor(phone), ...details })));
    expect(new Set(res.map((r) => r.tokenNumber)).size).toBe(4);
  });

  it("refuses a batch that is not open", async () => {
    await db.batch.update({ where: { id: batchId }, data: { status: "RUNNING" } });
    await failsWith(sendEnrolmentCode(agent, { phone: "9700000001", batchId }), "BATCH_NOT_OPEN");
  });
});

describe("access control", () => {
  it("only approved agents can enrol", async () => {
    const pending = await makeUser("AGENT", "9800000002");
    await db.agentProfile.create({ data: { userId: pending.id, panchayat: "Tilda" } });
    await failsWith(sendEnrolmentCode(pending, { phone: "9700000001", batchId }), "AGENT_NOT_APPROVED");
    await failsWith(listOpenBatches(pending), "AGENT_NOT_APPROVED");
    for (const role of ["MEMBER", "ADMIN"] as const) {
      const u = await makeUser(role, role === "MEMBER" ? "9700000005" : "9000000001");
      await failsWith(sendEnrolmentCode(u, { phone: "9700000001", batchId }), "FORBIDDEN");
    }
  });

  it("staff phone numbers can't become members", async () => {
    await makeUser("ADMIN", "9000000001");
    await failsWith(sendEnrolmentCode(agent, { phone: "9000000001", batchId }), "PHONE_IN_USE");
    await failsWith(sendEnrolmentCode(agent, { phone: agent.phone, batchId }), "PHONE_IN_USE");
  });

  it("suspended members can't be enrolled", async () => {
    await db.user.create({ data: { phone: "9700000001", name: "X", status: "SUSPENDED" } });
    await failsWith(sendEnrolmentCode(agent, { phone: "9700000001", batchId }), "ACCOUNT_SUSPENDED");
  });
});
