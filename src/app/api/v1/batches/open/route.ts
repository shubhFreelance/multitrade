import { handle, ok } from "@/lib/api";
import { listJoinableBatches } from "@/server/enrolment";

// Public: what anyone can join.
export const GET = () => handle(async () => ok(await listJoinableBatches()));
