import { handle, ok, readJson } from "@/lib/api";
import { updateScheme } from "@/server/catalog";
import { getCurrentUser } from "@/server/session";

export const PATCH = (req: Request, { params }: RouteContext<"/api/v1/admin/schemes/[id]">) =>
  handle(async () => ok(await updateScheme(await getCurrentUser(), (await params).id, await readJson(req))));
