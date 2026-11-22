import { beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import { failsWith, makeUser, resetDb } from "../../test/db";
import { getUserByToken } from "./auth";
import { confirmJoin, joinBatch, sendJoinCode } from "./enrolment";
import { simulateTestPayment, startPayment } from "./payments";
import { sendSms } from "./sms";

vi.mock("./sms", () => ({ sendSms: vi.fn() }));
const codeFor = (phone: string) => vi.mocked(sendSms).mock.calls.filter(([p]) => p === phone).at(-1)![1].match(/code: (\d{6})/i)![1];

let batchId: string;
const details = { name: "Geeta Sahu", village: "Kurud", address: "Ward 3, Kurud" };

beforeEach(async () => {
  vi.mocked(sendSms).mockClear();
  vi.stubEnv("PAYMENT_PROVIDER", "test");
  await resetDb();
  const scheme = await db.scheme.create({
    data: { code: "MANPASAND", nameEn: "Manpasand Plan", nameHi: "मनपसंद योजना", installmentAmount: 2_000_00, tenureMonths: 12, commissionRule: { type: "FLAT", amount: 50_00 } },
  });
  batchId = (await db.batch.create({ data: { schemeId: scheme.id, number: 1, startMonth: new Date("2027-01-01"), size: 2500, winnersPerDraw: 10 } })).id;
});

describe("joining directly", () => {
  it("a new person joins with a code, is logged in, has no agent, and payments earn no commission", async () => {
    expect(await sendJoinCode({ phone: "9700000001", batchId })).toEqual({ existingMember: false });
    const { enrolment, login } = await confirmJoin({ phone: "9700000001", batchId, code: codeFor("9700000001"), ...details });
    expect(enrolment.tokenNumber).toBe("MAN-B01-0001");
    const user = (await getUserByToken(login.token))!;
    expect(user).toMatchObject({ phone: "9700000001", role: "MEMBER", name: "Geeta Sahu" });
    expect(await db.enrolment.findUniqueOrThrow({ where: { id: enrolment.id } })).toMatchObject({ agentId: null });

    const inst = await db.installment.findFirstOrThrow({ where: { enrolmentId: enrolment.id, monthNo: 1 } });
    const { paymentId } = await startPayment(user, inst.id);
    expect((await simulateTestPayment(user, paymentId, "SUCCESS")).status).toBe("SUCCESS");
    expect(await db.commission.count()).toBe(0);
  });

  it("needs details for a new number and a right code", async () => {
    await sendJoinCode({ phone: "9700000001", batchId });
    await failsWith(confirmJoin({ phone: "9700000001", batchId, code: codeFor("9700000001") }), "MEMBER_DETAILS_REQUIRED");
    await failsWith(confirmJoin({ phone: "9700000001", batchId, code: "000000", ...details }), "INVALID_OTP");
    expect(await db.enrolment.count()).toBe(0);
  });

  it("staff numbers can't join as members", async () => {
    await makeUser("AGENT", "9800000001");
    await failsWith(sendJoinCode({ phone: "9800000001", batchId }), "PHONE_IN_USE");
  });

  it("a signed-in member joins another batch without a code", async () => {
    const member = await makeUser("MEMBER", "9700000002");
    const res = await joinBatch(member, { batchId });
    expect(await db.enrolment.findUniqueOrThrow({ where: { id: res.id } })).toMatchObject({ memberId: member.id, agentId: null });
    await failsWith(joinBatch(await makeUser("AGENT", "9800000002"), { batchId }), "FORBIDDEN");
  });

  it("a full or closed batch refuses", async () => {
    await db.batch.update({ where: { id: batchId }, data: { status: "CLOSED" } });
    await failsWith(joinBatch(await makeUser("MEMBER", "9700000003"), { batchId }), "BATCH_NOT_OPEN");
  });
});
