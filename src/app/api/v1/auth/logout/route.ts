import { handle, ok } from "@/lib/api";
import { logout } from "@/server/auth";
import { clearSessionCookie, getRequestToken } from "@/server/session";

export const POST = () =>
  handle(async () => {
    const token = await getRequestToken();
    if (token) await logout(token);
    await clearSessionCookie();
    return ok({ loggedOut: true });
  });
