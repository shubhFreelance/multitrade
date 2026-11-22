import { randomBytes } from "node:crypto";
import { db } from "@/lib/db";
import type { LoginResult, Role, SessionUser } from "@/shared/auth";
import { AppError } from "./errors";
import { sendCode, sha256, consumeCode } from "./otp";

const SESSION_TTL_MS = 30 * 24 * 60 * 60_000;

async function findActiveUser(phone: string) {
  const user = await db.user.findUnique({ where: { phone } });
  if (!user) throw new AppError("NOT_REGISTERED", "This mobile number is not registered", 404);
  if (user.status !== "ACTIVE") throw new AppError("ACCOUNT_SUSPENDED", "This account is suspended", 403);
  return user;
}

/** Texts a login code. `testCode` is set only while codes are shown on screen for testing (see otp.ts). */
export async function requestOtp(phone: string): Promise<{ testCode?: string }> {
  await findActiveUser(phone);
  return sendCode(phone, "LOGIN", "", (code) => `Saksham Multitrade login code: ${code}. Valid for 5 minutes. Do not share it.`);
}

export async function verifyOtp(phone: string, code: string, device?: string): Promise<LoginResult> {
  await consumeCode(phone, "LOGIN", code, "");
  return createSession(await findActiveUser(phone), device);
}

/** Logs the user in: a new session token (only its hash is stored). */
export async function createSession(user: { id: string; phone: string; name: string; role: Role; language: string }, device?: string): Promise<LoginResult> {
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
