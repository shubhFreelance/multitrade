import { handle, ok, readJson } from "@/lib/api";
import { recordCash } from "@/server/payments";
import { getCurrentUser } from "@/server/session";
import { startPaymentInput } from "@/shared/payments";

// Agent records cash taken for one installment; it counts only after an admin verifies it.
export const POST = (req: Request) =>
  handle(async () => {
    const { installmentId } = startPaymentInput.parse(await readJson(req));
    return ok(await recordCash(await getCurrentUser(), installmentId), 201);
  });
