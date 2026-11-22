import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { homeFor, type LoginResult, type Role, type SessionUser } from "@/shared/auth";
import { getUserByToken } from "./auth";

export const SESSION_COOKIE = "session";

/** Session token from `Authorization: Bearer` (mobile) or the httpOnly cookie (web). */
export async function getRequestToken(): Promise<string | undefined> {
  const auth = (await headers()).get("authorization");
  if (auth?.startsWith("Bearer ")) return auth.slice(7).trim();
  return (await cookies()).get(SESSION_COOKIE)?.value;
}

// cache(): a layout and its page render at the same time; they share one session lookup per request.
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const token = await getRequestToken();
  return token ? getUserByToken(token) : null;
});

/** For pages: the signed-in user, or a redirect to /login (or to their own home if the role doesn't match). */
export async function requirePageUser(allowed: readonly Role[]): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!allowed.includes(user.role)) redirect(homeFor(user.role));
  return user;
}

export async function setSessionCookie({ token, expiresAt, user }: LoginResult) {
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: new Date(expiresAt),
  });
  store.set("locale", user.language, { path: "/", maxAge: 365 * 24 * 60 * 60 });
}

export async function clearSessionCookie() {
  (await cookies()).delete(SESSION_COOKIE);
}
