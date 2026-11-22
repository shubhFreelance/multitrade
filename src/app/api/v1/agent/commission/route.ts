import { handle, ok } from "@/lib/api";
import { listMyCommission } from "@/server/commission";
import { getCurrentUser } from "@/server/session";

export const GET = () => handle(async () => ok(await listMyCommission(await getCurrentUser())));
