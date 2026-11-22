import { handle, ok } from "@/lib/api";
import { getMyBonus } from "@/server/bonus";
import { getCurrentUser } from "@/server/session";

export const GET = () => handle(async () => ok(await getMyBonus(await getCurrentUser())));
