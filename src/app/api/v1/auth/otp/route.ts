import { handle, ok, readJson } from "@/lib/api";
import { requestOtp } from "@/server/auth";
import { requestOtpInput } from "@/shared/auth";

export const POST = (req: Request) =>
  handle(async () => {
    const { phone } = requestOtpInput.parse(await readJson(req));
    return ok({ sent: true, ...(await requestOtp(phone)) }); // testCode only while SHOW_OTP_ON_SCREEN is on (never in production)
  });
