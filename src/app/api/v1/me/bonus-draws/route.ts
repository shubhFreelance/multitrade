import { handle, ok } from "@/lib/api";
import { listBonusDraws } from "@/server/bonus";
import { getCurrentUser } from "@/server/session";

export const GET = () => handle(async () => ok(await listBonusDraws(await getCurrentUser())));
