import { handle, ok } from "@/lib/api";
import { listOpenBatches } from "@/server/enrolment";
import { getCurrentUser } from "@/server/session";

export const GET = () => handle(async () => ok(await listOpenBatches(await getCurrentUser())));
