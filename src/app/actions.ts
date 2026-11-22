"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { logout, requestOtp, verifyOtp } from "@/server/auth";
import { confirmJoin, sendJoinCode } from "@/server/enrolment";
import { toAppError } from "@/server/errors";
import { clearSessionCookie, getRequestToken, setSessionCookie } from "@/server/session";
import { homeFor, requestOtpInput, verifyOtpInput } from "@/shared/auth";
import type { EnrolConfirm } from "@/shared/enrolment";

type ActionResult = { error?: string };

const errorCode = (e: unknown) => toAppError(e).code;

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

// ---- Joining directly on the website ----

export async function sendJoinCodeAction(phone: string, batchId: string) {
  try {
    return await sendJoinCode({ phone, batchId });
  } catch (e) {
    return { error: errorCode(e) };
  }
}

/** Creates the enrolment, logs the member in and opens their schemes. */
export async function confirmJoinAction(input: EnrolConfirm): Promise<ActionResult> {
  try {
    await setSessionCookie((await confirmJoin(input, "web")).login);
  } catch (e) {
    return { error: errorCode(e) };
  }
  redirect("/member");
}
