import { handle, ok } from "@/lib/api";
import { listAgents } from "@/server/agents";
import { getCurrentUser } from "@/server/session";

export const GET = () => handle(async () => ok(await listAgents(await getCurrentUser())));
