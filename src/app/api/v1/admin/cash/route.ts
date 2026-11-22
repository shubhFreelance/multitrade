import { handle, ok } from "@/lib/api";
import { listPendingCash } from "@/server/payments";
import { getCurrentUser } from "@/server/session";

export const GET = () => handle(async () => ok(await listPendingCash(await getCurrentUser())));
