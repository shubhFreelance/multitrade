import { handle, ok } from "@/lib/api";
import { invoiceOverview } from "@/server/invoices";
import { getCurrentUser } from "@/server/session";

export const GET = (req: Request) =>
  handle(async () => ok(await invoiceOverview(await getCurrentUser(), new URL(req.url).searchParams.get("q") ?? undefined)));
