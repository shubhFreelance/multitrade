import { createHash, randomBytes, randomInt } from "node:crypto";
import { db } from "@/lib/db";
import type { LoginResult, Role, SessionUser } from "@/shared/auth";
import { AppError } from "./errors";
import { sendSms } from "./sms";

const OTP_TTL_MS = 5 * 60_000;
const OTP_RESEND_MS = 30_000;
const OTP_MAX_ATTEMPTS = 5;
const SESSION_TTL_MS = 30 * 24 * 60 * 60_000;

const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

async function findActiveUser(phone: string) {
  const user = await db.user.findUnique({ where: { phone } });
  if (!user) throw new AppError("NOT_REGISTERED", "This mobile number is not registered", 404);
  if (user.status !== "ACTIVE") throw new AppError("ACCOUNT_SUSPENDED", "This account is suspended", 403);
  return user;
}

export async function requestOtp(phone: string): Promise<void> {
  await findActiveUser(phone);

  const existing = await db.otpCode.findUnique({ where: { phone } });
  if (existing && Date.now() - existing.createdAt.getTime() < OTP_RESEND_MS) {
    throw new AppError("OTP_TOO_SOON", "Please wait 30 seconds before asking for a new code", 429);
  }

  const code = randomInt(0, 1_000_000).toString().padStart(6, "0");
  const data = { codeHash: sha256(phone + code), expiresAt: new Date(Date.now() + OTP_TTL_MS), attempts: 0, createdAt: new Date() };
  await db.otpCode.upsert({ where: { phone }, create: { phone, ...data }, update: data });
  await sendSms(phone, `Saksham Multitrade login code: ${code}. Valid for 5 minutes. Do not share it.`);
}

export async function verifyOtp(phone: string, code: string, device?: string): Promise<LoginResult> {
  const invalid = new AppError("INVALID_OTP", "The code is wrong or has expired", 401);

  // Count the attempt first, atomically, so parallel guesses can't exceed the limit.
  const counted = await db.otpCode.updateMany({
    where: { phone, attempts: { lt: OTP_MAX_ATTEMPTS }, expiresAt: { gt: new Date() } },
    data: { attempts: { increment: 1 } },
  });
  if (counted.count === 0) throw invalid;

  // Deleting by hash makes the code single-use even if two requests race.
  const used = await db.otpCode.deleteMany({ where: { phone, codeHash: sha256(phone + code) } });
  if (used.count === 0) throw invalid;

  const user = await findActiveUser(phone);
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await db.session.create({ data: { userId: user.id, tokenHash: sha256(token), expiresAt, device } });

  return { token, expiresAt: expiresAt.toISOString(), user: toSessionUser(user) };
}

export async function getUserByToken(token: string): Promise<SessionUser | null> {
  const session = await db.session.findUnique({ where: { tokenHash: sha256(token) }, include: { user: true } });
  if (!session || session.expiresAt < new Date() || session.user.status !== "ACTIVE") return null;
  return toSessionUser(session.user);
}

export async function logout(token: string): Promise<void> {
  await db.session.deleteMany({ where: { tokenHash: sha256(token) } });
}

/** Throws unless a user is signed in and has one of `allowed` roles. */
export function requireRole(user: SessionUser | null, allowed: readonly Role[]): SessionUser {
  if (!user) throw new AppError("UNAUTHENTICATED", "Please log in", 401);
  if (!allowed.includes(user.role)) throw new AppError("FORBIDDEN", "You are not allowed to do this", 403);
  return user;
}

function toSessionUser(u: { id: string; phone: string; name: string; role: Role; language: string }): SessionUser {
  return { id: u.id, phone: u.phone, name: u.name, role: u.role, language: u.language };
}
