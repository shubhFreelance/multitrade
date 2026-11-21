import { handle, ok, readJson } from "@/lib/api";
import { requestOtp } from "@/server/auth";
import { requestOtpInput } from "@/shared/auth";

export const POST = (req: Request) =>
  handle(async () => {
    const { phone } = requestOtpInput.parse(await readJson(req));
    await requestOtp(phone);
    return ok({ sent: true });
  });
