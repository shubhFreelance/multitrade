import { handle, ok } from "@/lib/api";
import { listMyNotifications } from "@/server/completion";
import { getCurrentUser } from "@/server/session";

export const GET = () => handle(async () => ok(await listMyNotifications(await getCurrentUser())));
