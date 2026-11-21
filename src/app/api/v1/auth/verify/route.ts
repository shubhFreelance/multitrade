import { handle, ok, readJson } from "@/lib/api";
import { verifyOtp } from "@/server/auth";
import { verifyOtpInput } from "@/shared/auth";

// For the mobile app: returns the token to send as `Authorization: Bearer <token>`. The web app logs in via a server action that sets the cookie.
export const POST = (req: Request) =>
  handle(async () => {
    const { phone, code, device } = verifyOtpInput.parse(await readJson(req));
    return ok(await verifyOtp(phone, code, device));
  });
