import { handle, ok, readJson } from "@/lib/api";
import { startPayment } from "@/server/payments";
import { getCurrentUser } from "@/server/session";
import { startPaymentInput } from "@/shared/payments";

export const POST = (req: Request) =>
  handle(async () => {
    const { installmentId } = startPaymentInput.parse(await readJson(req));
    return ok(await startPayment(await getCurrentUser(), installmentId), 201);
  });
