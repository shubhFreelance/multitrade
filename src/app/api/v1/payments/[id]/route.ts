import { handle, ok } from "@/lib/api";
import { getPayment } from "@/server/payments";
import { getCurrentUser } from "@/server/session";

export const GET = (_req: Request, { params }: RouteContext<"/api/v1/payments/[id]">) =>
  handle(async () => ok(await getPayment(await getCurrentUser(), (await params).id)));
