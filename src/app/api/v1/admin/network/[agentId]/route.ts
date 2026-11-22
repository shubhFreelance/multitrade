import { handle, ok } from "@/lib/api";
import { getAgentNetwork } from "@/server/network";
import { getCurrentUser } from "@/server/session";

export const GET = (req: Request, { params }: RouteContext<"/api/v1/admin/network/[agentId]">) =>
  handle(async () => ok(await getAgentNetwork(await getCurrentUser(), (await params).agentId, new URL(req.url).searchParams.get("period"))));
