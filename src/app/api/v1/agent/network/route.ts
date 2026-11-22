import { handle, ok } from "@/lib/api";
import { getMyNetwork } from "@/server/network";
import { getCurrentUser } from "@/server/session";

export const GET = (req: Request) => handle(async () => ok(await getMyNetwork(await getCurrentUser(), new URL(req.url).searchParams.get("period"))));
