import { handle, ok } from "@/lib/api";
import { getCurrentUser } from "@/server/session";
import { listMyEnrolments } from "@/server/tracker";

export const GET = () => handle(async () => ok(await listMyEnrolments(await getCurrentUser())));
