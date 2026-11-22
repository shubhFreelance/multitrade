import { handle, ok } from "@/lib/api";
import { listMyDraws } from "@/server/draws";
import { getCurrentUser } from "@/server/session";

export const GET = () => handle(async () => ok(await listMyDraws(await getCurrentUser())));
