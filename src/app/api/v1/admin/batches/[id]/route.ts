import { handle, ok, readJson } from "@/lib/api";
import { getBatch, updateBatch } from "@/server/catalog";
import { getCurrentUser } from "@/server/session";

type Ctx = RouteContext<"/api/v1/admin/batches/[id]">;

export const GET = (_req: Request, { params }: Ctx) =>
  handle(async () => ok(await getBatch(await getCurrentUser(), (await params).id)));

export const PATCH = (req: Request, { params }: Ctx) =>
  handle(async () => ok(await updateBatch(await getCurrentUser(), (await params).id, await readJson(req))));
