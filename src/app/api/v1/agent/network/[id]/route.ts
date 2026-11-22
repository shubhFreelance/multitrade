import { handle, ok } from "@/lib/api";
import { getNetworkEnrolment } from "@/server/network";
import { getCurrentUser } from "@/server/session";

export const GET = (_: Request, { params }: RouteContext<"/api/v1/agent/network/[id]">) =>
  handle(async () => ok(await getNetworkEnrolment(await getCurrentUser(), (await params).id)));
