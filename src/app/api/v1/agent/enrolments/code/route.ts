import { handle, ok, readJson } from "@/lib/api";
import { sendEnrolmentCode } from "@/server/enrolment";
import { getCurrentUser } from "@/server/session";

export const POST = (req: Request) => handle(async () => ok(await sendEnrolmentCode(await getCurrentUser(), await readJson(req))));
