import { handle, ok, readJson } from "@/lib/api";
import { allocate } from "@/server/fulfilment";
import { getCurrentUser } from "@/server/session";

export const POST = (req: Request, { params }: RouteContext<"/api/v1/admin/fulfilment/[id]/allocate">) =>
  handle(async () => ok(await allocate(await getCurrentUser(), (await params).id, await readJson(req))));
