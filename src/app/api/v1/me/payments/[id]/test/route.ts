import { handle, ok, readJson } from "@/lib/api";
import { simulateTestPayment } from "@/server/payments";
import { getCurrentUser } from "@/server/session";
import { testOutcomeInput } from "@/shared/payments";

// Test provider only (PAYMENT_PROVIDER=test): the member decides whether the payment succeeds.
export const POST = (req: Request, { params }: RouteContext<"/api/v1/me/payments/[id]/test">) =>
  handle(async () => {
    const { status } = testOutcomeInput.parse(await readJson(req));
    return ok(await simulateTestPayment(await getCurrentUser(), (await params).id, status));
  });
