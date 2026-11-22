import { handle, ok } from "@/lib/api";
import { markPrizeHandedOver } from "@/server/bonus";
import { getCurrentUser } from "@/server/session";

export const POST = (_req: Request, { params }: RouteContext<"/api/v1/admin/bonus-draws/winners/[id]/handed-over">) =>
  handle(async () => ok(await markPrizeHandedOver(await getCurrentUser(), (await params).id)));
