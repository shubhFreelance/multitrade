import { handle, ok, readJson } from "@/lib/api";
import { createAgentInvoices } from "@/server/invoices";
import { getCurrentUser } from "@/server/session";

export const POST = (req: Request) => handle(async () => ok(await createAgentInvoices(await getCurrentUser(), await readJson(req)), 201));
