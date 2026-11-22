import { handle, ok, readJson } from "@/lib/api";
import { setGoldRate } from "@/server/fulfilment";
import { getCurrentUser } from "@/server/session";

export const POST = (req: Request) => handle(async () => ok(await setGoldRate(await getCurrentUser(), await readJson(req))));
