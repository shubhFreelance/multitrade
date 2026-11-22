import { handle, ok } from "@/lib/api";
import { listFulfilments } from "@/server/fulfilment";
import { getCurrentUser } from "@/server/session";

export const GET = () => handle(async () => ok(await listFulfilments(await getCurrentUser())));
