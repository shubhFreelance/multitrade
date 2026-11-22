import { handle, pdfResponse } from "@/lib/api";
import { AppError } from "@/server/errors";
import { memberInvoicePdf } from "@/server/invoice-pdf";
import { getPayment } from "@/server/payments";
import { getCurrentUser } from "@/server/session";

/** The member invoice for a counted payment, as a PDF download. */
export const GET = (_req: Request, { params }: RouteContext<"/api/v1/payments/[id]/invoice">) =>
  handle(async () => {
    const p = await getPayment(await getCurrentUser(), (await params).id);
    if (p.status !== "SUCCESS" || !p.invoiceNo) throw new AppError("NOT_FOUND", "No invoice for this payment", 404);
    return pdfResponse(await memberInvoicePdf(p), p.invoiceNo);
  });

