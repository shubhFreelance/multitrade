import { handle, ok } from "@/lib/api";
import { checkCronSecret, runDaily } from "@/server/reminders";

// Called once a day (e.g. 08:00 India time) by the host's scheduler: POST with `Authorization: Bearer <CRON_SECRET>`.
export const POST = (req: Request) =>
  handle(async () => {
    checkCronSecret(req.headers.get("authorization"));
    return ok(await runDaily());
  });
