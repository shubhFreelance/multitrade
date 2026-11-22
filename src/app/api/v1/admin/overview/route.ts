import { handle, ok } from "@/lib/api";
import { adminOverview } from "@/server/overview";
import { getCurrentUser } from "@/server/session";

export const GET = () => handle(async () => ok(await adminOverview(await getCurrentUser())));
