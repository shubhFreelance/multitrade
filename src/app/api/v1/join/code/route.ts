import { handle, ok, readJson } from "@/lib/api";
import { sendJoinCode } from "@/server/enrolment";

export const POST = (req: Request) => handle(async () => ok(await sendJoinCode(await readJson(req))));
