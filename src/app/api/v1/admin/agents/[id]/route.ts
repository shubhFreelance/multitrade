import { handle, ok, readJson } from "@/lib/api";
import { updateAgent } from "@/server/agents";
import { getCurrentUser } from "@/server/session";

export const PATCH = (req: Request, { params }: RouteContext<"/api/v1/admin/agents/[id]">) =>
  handle(async () => {
    await updateAgent(await getCurrentUser(), (await params).id, await readJson(req));
    return ok({ updated: true });
  });
