import { handle, ok } from "@/lib/api";
import { verifyCash } from "@/server/payments";
import { getCurrentUser } from "@/server/session";

export const POST = (_req: Request, { params }: RouteContext<"/api/v1/admin/cash/[id]/verify">) =>
  handle(async () => ok(await verifyCash(await getCurrentUser(), (await params).id)));
