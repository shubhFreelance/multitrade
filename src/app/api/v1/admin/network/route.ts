import { handle, ok } from "@/lib/api";
import { networkOverview } from "@/server/network";
import { getCurrentUser } from "@/server/session";

export const GET = (req: Request) => handle(async () => ok(await networkOverview(await getCurrentUser(), new URL(req.url).searchParams.get("period"))));
