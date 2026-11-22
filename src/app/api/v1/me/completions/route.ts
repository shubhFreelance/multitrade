import { handle, ok } from "@/lib/api";
import { listMyCompletions } from "@/server/completion";
import { getCurrentUser } from "@/server/session";

export const GET = () => handle(async () => ok(await listMyCompletions(await getCurrentUser())));
