import { handle, ok, readJson } from "@/lib/api";
import { bonusOverview, runBonusDraw } from "@/server/bonus";
import { getCurrentUser } from "@/server/session";

export const GET = () => handle(async () => ok(await bonusOverview(await getCurrentUser())));
export const POST = (req: Request) =>
  handle(async () => {
    const body = (await readJson(req)) as { prize?: unknown } | null;
    return ok(await runBonusDraw(await getCurrentUser(), body?.prize), 201);
  });
