import { handle, pdfResponse } from "@/lib/api";
import { agentInvoicePdf } from "@/server/invoice-pdf";
import { getAgentInvoice } from "@/server/invoices";
import { getCurrentUser } from "@/server/session";

/** An agent commission invoice as a PDF. The agent it belongs to, or the super admin. */
export const GET = (_req: Request, { params }: RouteContext<"/api/v1/agent-invoices/[id]/pdf">) =>
  handle(async () => {
    const inv = await getAgentInvoice(await getCurrentUser(), (await params).id);
    return pdfResponse(await agentInvoicePdf(inv), inv.number);
  });
