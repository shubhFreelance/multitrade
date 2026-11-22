import { handle, ok, readJson } from "@/lib/api";
import { listDrawBatches, runMonthlyDraw } from "@/server/draws";
import { getCurrentUser } from "@/server/session";

export const GET = () => handle(async () => ok(await listDrawBatches(await getCurrentUser())));
export const POST = (req: Request) => handle(async () => ok(await runMonthlyDraw(await getCurrentUser(), await readJson(req)), 201));
