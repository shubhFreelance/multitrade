import { handle, ok } from "@/lib/api";
import { markDelivered } from "@/server/fulfilment";
import { getCurrentUser } from "@/server/session";

export const POST = (_req: Request, { params }: RouteContext<"/api/v1/admin/fulfilment/[id]/delivered">) =>
  handle(async () => ok(await markDelivered(await getCurrentUser(), (await params).id)));
