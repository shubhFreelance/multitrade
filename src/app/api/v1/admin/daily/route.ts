import { handle, ok } from "@/lib/api";
import { runDailyAsAdmin } from "@/server/reminders";
import { getCurrentUser } from "@/server/session";

export const POST = () => handle(async () => ok(await runDailyAsAdmin(await getCurrentUser())));
