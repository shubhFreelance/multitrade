import { handle, ok, readJson } from "@/lib/api";
import { markAgentInvoicePaid } from "@/server/invoices";
import { getCurrentUser } from "@/server/session";

export const POST = (req: Request, { params }: RouteContext<"/api/v1/admin/agent-invoices/[id]/paid">) =>
  handle(async () => ok(await markAgentInvoicePaid(await getCurrentUser(), (await params).id, await readJson(req))));
