// One-time SMS codes, shared by login and enrolment confirmation.
import { createHash, randomInt } from "node:crypto";
import type { OtpPurpose } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { AppError } from "./errors";
import { sendSms } from "./sms";

const OTP_TTL_MS = 5 * 60_000;
const OTP_RESEND_MS = 30_000;
const OTP_MAX_ATTEMPTS = 5;

export const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

/**
 * Texts a new 6-digit code, replacing any earlier one for this phone and purpose.
 * `context` is what the code approves (e.g. a batch id); `consumeCode` must be given the same value.
 */
export async function sendCode(phone: string, purpose: OtpPurpose, context: string, message: (code: string) => string) {
  const key = { phone_purpose: { phone, purpose } };
  const existing = await db.otpCode.findUnique({ where: key });
  if (existing && Date.now() - existing.createdAt.getTime() < OTP_RESEND_MS) {
    throw new AppError("OTP_TOO_SOON", "Please wait 30 seconds before asking for a new code", 429);
  }

  const code = randomInt(0, 1_000_000).toString().padStart(6, "0");
  const data = { codeHash: sha256(phone + code), context, expiresAt: new Date(Date.now() + OTP_TTL_MS), attempts: 0, createdAt: new Date() };
  await db.otpCode.upsert({ where: key, create: { phone, purpose, ...data }, update: data });
  await sendSms(phone, message(code));
}

/** Consumes the code, or throws INVALID_OTP (wrong, expired, used, for another context, or after 5 wrong tries). */
export async function consumeCode(phone: string, purpose: OtpPurpose, code: string, context: string) {
  // Count the attempt first, atomically, so parallel guesses can't exceed the limit.
  const counted = await db.otpCode.updateMany({
    where: { phone, purpose, attempts: { lt: OTP_MAX_ATTEMPTS }, expiresAt: { gt: new Date() } },
    data: { attempts: { increment: 1 } },
  });
  // Deleting by hash and context makes the code single-use even if two requests race.
  const used =
    counted.count > 0 && (await db.otpCode.deleteMany({ where: { phone, purpose, context, codeHash: sha256(phone + code) } })).count > 0;
  if (!used) throw new AppError("INVALID_OTP", "The code is wrong or has expired", 401);
}
