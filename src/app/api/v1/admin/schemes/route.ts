import { handle, ok } from "@/lib/api";
import { listSchemes } from "@/server/catalog";
import { getCurrentUser } from "@/server/session";

export const GET = () => handle(async () => ok(await listSchemes(await getCurrentUser())));
