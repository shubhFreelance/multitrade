import { handle, ok } from "@/lib/api";
import { listMyInvoices } from "@/server/invoices";
import { getCurrentUser } from "@/server/session";

export const GET = () => handle(async () => ok(await listMyInvoices(await getCurrentUser())));
