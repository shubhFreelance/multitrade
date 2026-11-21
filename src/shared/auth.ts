import { z } from "zod";

export const phoneSchema = z.string().trim().regex(/^[6-9]\d{9}$/, "Enter a 10-digit mobile number");
export const otpSchema = z.string().trim().regex(/^\d{6}$/, "Enter the 6-digit code");

export const requestOtpInput = z.object({ phone: phoneSchema });
export const verifyOtpInput = z.object({
  phone: phoneSchema,
  code: otpSchema,
  device: z.string().trim().max(100).optional(),
});

export const roles = ["MEMBER", "AGENT", "ADMIN", "SUPER_ADMIN"] as const;
export type Role = (typeof roles)[number];

export type SessionUser = {
  id: string;
  phone: string;
  name: string;
  role: Role;
  language: string;
};

export const homeFor = (role: Role) => (role === "MEMBER" ? "/member" : role === "AGENT" ? "/agent" : "/admin");

// POST /api/v1/auth/verify response
export type LoginResult = { token: string; expiresAt: string; user: SessionUser };
