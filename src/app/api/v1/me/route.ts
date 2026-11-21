import { handle, ok } from "@/lib/api";
import { requireRole } from "@/server/auth";
import { getCurrentUser } from "@/server/session";
import { roles } from "@/shared/auth";

export const GET = () => handle(async () => ok(requireRole(await getCurrentUser(), roles)));
