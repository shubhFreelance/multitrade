import { handle, ok, readJson } from "@/lib/api";
import { createBatch, listBatches } from "@/server/catalog";
import { getCurrentUser } from "@/server/session";

export const GET = () => handle(async () => ok(await listBatches(await getCurrentUser())));

export const POST = (req: Request) =>
  handle(async () => ok(await createBatch(await getCurrentUser(), await readJson(req)), 201));
