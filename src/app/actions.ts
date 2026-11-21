"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ZodError } from "zod";
import { logout, requestOtp, verifyOtp } from "@/server/auth";
import { AppError } from "@/server/errors";
import { clearSessionCookie, getRequestToken, setSessionCookie } from "@/server/session";
import { homeFor, requestOtpInput, verifyOtpInput } from "@/shared/auth";

type ActionResult = { error?: string };

const errorCode = (e: unknown) => {
  if (e instanceof AppError) return e.code;
  if (e instanceof ZodError) return "VALIDATION";
  console.error(e);
  return "INTERNAL";
};

export async function sendOtpAction(phone: string): Promise<ActionResult> {
  try {
    await requestOtp(requestOtpInput.parse({ phone }).phone);
    return {};
  } catch (e) {
    return { error: errorCode(e) };
  }
}

export async function verifyOtpAction(phone: string, code: string): Promise<ActionResult> {
  let home: string;
  try {
    const input = verifyOtpInput.parse({ phone, code, device: "web" });
    const result = await verifyOtp(input.phone, input.code, input.device);
    await setSessionCookie(result);
    home = homeFor(result.user.role);
  } catch (e) {
    return { error: errorCode(e) };
  }
  redirect(home); // outside try: redirect works by throwing
}

export async function logoutAction() {
  const token = await getRequestToken();
  if (token) await logout(token);
  await clearSessionCookie();
  redirect("/login");
}

export async function setLocaleAction(locale: string) {
  (await cookies()).set("locale", locale === "en" ? "en" : "hi", { path: "/", maxAge: 365 * 24 * 60 * 60 });
}
