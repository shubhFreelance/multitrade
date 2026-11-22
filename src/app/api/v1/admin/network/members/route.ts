import { handle, ok } from "@/lib/api";
import { membersOverview } from "@/server/network";
import { getCurrentUser } from "@/server/session";

export const GET = (req: Request) =>
  handle(async () => {
    const q = new URL(req.url).searchParams;
    return ok(await membersOverview(await getCurrentUser(), q.get("period"), q.get("source")));
  });
