import { handle, ok } from "@/lib/api";
import { markAllRead } from "@/server/completion";
import { getCurrentUser } from "@/server/session";

export const POST = () =>
  handle(async () => {
    await markAllRead(await getCurrentUser());
    return ok(null);
  });
