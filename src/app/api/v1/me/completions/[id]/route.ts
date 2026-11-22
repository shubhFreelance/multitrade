import { handle, ok, readJson } from "@/lib/api";
import { confirmFulfilment } from "@/server/completion";
import { getCurrentUser } from "@/server/session";

export const POST = (req: Request, { params }: RouteContext<"/api/v1/me/completions/[id]">) =>
  handle(async () => ok(await confirmFulfilment(await getCurrentUser(), (await params).id, await readJson(req))));
