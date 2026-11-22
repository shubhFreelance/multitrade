import { handle, ok } from "@/lib/api";
import { rejectCash } from "@/server/payments";
import { getCurrentUser } from "@/server/session";

export const POST = (_req: Request, { params }: RouteContext<"/api/v1/admin/cash/[id]/reject">) =>
  handle(async () => ok(await rejectCash(await getCurrentUser(), (await params).id)));
