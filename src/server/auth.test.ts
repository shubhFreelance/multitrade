import { beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import { resetDb } from "../../test/db";
import { getUserByToken, logout, requestOtp, requireRole, verifyOtp } from "./auth";
import { sendSms } from "./sms";

vi.mock("./sms", () => ({ sendSms: vi.fn() }));

const PHONE = "9876543210";

/** The 6-digit code from the last SMS sent. */
const lastCode = () => vi.mocked(sendSms).mock.calls.at(-1)![1].match(/\d{6}/)![0];
const wrongCode = (code: string) => (code === "000000" ? "111111" : "000000");
/** Lets a new code be requested without waiting 30 seconds. */
const skipResendWait = () => db.otpCode.update({ where: { phone: PHONE }, data: { createdAt: new Date(0) } });

beforeEach(async () => {
  vi.mocked(sendSms).mockClear();
  await resetDb();
  await db.user.create({ data: { phone: PHONE, name: "Asha", role: "MEMBER" } });
});

describe("OTP login", () => {
  it("logs in with the right code and returns a working token", async () => {
    await requestOtp(PHONE);
    const { token, user } = await verifyOtp(PHONE, lastCode(), "test");
    expect(user.phone).toBe(PHONE);
    expect((await getUserByToken(token))?.role).toBe("MEMBER");
  });

  it("stores only a hash of the token", async () => {
    await requestOtp(PHONE);
    const { token } = await verifyOtp(PHONE, lastCode());
    const session = await db.session.findFirstOrThrow();
    expect(session.tokenHash).not.toContain(token);
  });

  it("rejects unregistered and suspended numbers", async () => {
    await expect(requestOtp("9000000000")).rejects.toMatchObject({ code: "NOT_REGISTERED" });
    await db.user.update({ where: { phone: PHONE }, data: { status: "SUSPENDED" } });
    await expect(requestOtp(PHONE)).rejects.toMatchObject({ code: "ACCOUNT_SUSPENDED" });
  });

  it("blocks a resend within 30 seconds", async () => {
    await requestOtp(PHONE);
    await expect(requestOtp(PHONE)).rejects.toMatchObject({ code: "OTP_TOO_SOON" });
  });

  it("makes a code single-use", async () => {
    await requestOtp(PHONE);
    const code = lastCode();
    await verifyOtp(PHONE, code);
    await expect(verifyOtp(PHONE, code)).rejects.toMatchObject({ code: "INVALID_OTP" });
  });

  it("locks the code after 5 wrong attempts, even if the 6th is right", async () => {
    await requestOtp(PHONE);
    const code = lastCode();
    for (let i = 0; i < 5; i++) await expect(verifyOtp(PHONE, wrongCode(code))).rejects.toMatchObject({ code: "INVALID_OTP" });
    await expect(verifyOtp(PHONE, code)).rejects.toMatchObject({ code: "INVALID_OTP" });
  });

  it("rejects an expired code", async () => {
    await requestOtp(PHONE);
    await db.otpCode.update({ where: { phone: PHONE }, data: { expiresAt: new Date(Date.now() - 1000) } });
    await expect(verifyOtp(PHONE, lastCode())).rejects.toMatchObject({ code: "INVALID_OTP" });
  });

  it("a new code replaces the old one", async () => {
    await requestOtp(PHONE);
    const first = lastCode();
    await skipResendWait();
    await requestOtp(PHONE);
    if (first !== lastCode()) await expect(verifyOtp(PHONE, first)).rejects.toMatchObject({ code: "INVALID_OTP" });
    await expect(verifyOtp(PHONE, lastCode())).resolves.toBeTruthy();
  });
});

describe("sessions", () => {
  const login = async () => {
    await requestOtp(PHONE);
    return (await verifyOtp(PHONE, lastCode())).token;
  };

  it("logout ends the session", async () => {
    const token = await login();
    await logout(token);
    expect(await getUserByToken(token)).toBeNull();
  });

  it("expired sessions and suspended users are not signed in", async () => {
    const token = await login();
    await db.session.updateMany({ data: { expiresAt: new Date(Date.now() - 1000) } });
    expect(await getUserByToken(token)).toBeNull();

    const token2 = await login(); // a used code is deleted, so no resend wait
    await db.user.update({ where: { phone: PHONE }, data: { status: "SUSPENDED" } });
    expect(await getUserByToken(token2)).toBeNull();
  });

  it("an unknown token is not signed in", async () => {
    expect(await getUserByToken("not-a-real-token")).toBeNull();
  });
});

describe("requireRole", () => {
  const member = { id: "1", phone: PHONE, name: "Asha", role: "MEMBER" as const, language: "hi" };

  it("rejects anonymous users and wrong roles, allows the right role", () => {
    expect(() => requireRole(null, ["MEMBER"])).toThrow(expect.objectContaining({ code: "UNAUTHENTICATED", status: 401 }));
    expect(() => requireRole(member, ["ADMIN", "SUPER_ADMIN"])).toThrow(expect.objectContaining({ code: "FORBIDDEN", status: 403 }));
    expect(requireRole(member, ["MEMBER"])).toBe(member);
  });
});
