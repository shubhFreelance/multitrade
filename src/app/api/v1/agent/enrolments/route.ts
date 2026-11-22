import { handle, ok, readJson } from "@/lib/api";
import { confirmEnrolment } from "@/server/enrolment";
import { getCurrentUser } from "@/server/session";
import { listAgentEnrolments } from "@/server/tracker";

export const GET = () => handle(async () => ok(await listAgentEnrolments(await getCurrentUser())));

export const POST = (req: Request) => handle(async () => ok(await confirmEnrolment(await getCurrentUser(), await readJson(req)), 201));
