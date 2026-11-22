import { handle, ok, readJson } from "@/lib/api";
import { joinBatch } from "@/server/enrolment";
import { getCurrentUser } from "@/server/session";
import { listMyEnrolments } from "@/server/tracker";

export const GET = () => handle(async () => ok(await listMyEnrolments(await getCurrentUser())));
export const POST = (req: Request) => handle(async () => ok(await joinBatch(await getCurrentUser(), await readJson(req)), 201));
