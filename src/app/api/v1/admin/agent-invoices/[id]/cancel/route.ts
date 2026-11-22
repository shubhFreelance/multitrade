import { handle, ok } from "@/lib/api";
import { cancelAgentInvoice } from "@/server/invoices";
import { getCurrentUser } from "@/server/session";

export const POST = (_req: Request, { params }: RouteContext<"/api/v1/admin/agent-invoices/[id]/cancel">) =>
  handle(async () => ok(await cancelAgentInvoice(await getCurrentUser(), (await params).id)));
