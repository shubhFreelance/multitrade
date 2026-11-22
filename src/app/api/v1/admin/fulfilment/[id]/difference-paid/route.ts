import { handle, ok, readJson } from "@/lib/api";
import { recordDifferencePaid } from "@/server/fulfilment";
import { getCurrentUser } from "@/server/session";

export const POST = (req: Request, { params }: RouteContext<"/api/v1/admin/fulfilment/[id]/difference-paid">) =>
  handle(async () => ok(await recordDifferencePaid(await getCurrentUser(), (await params).id, await readJson(req))));
