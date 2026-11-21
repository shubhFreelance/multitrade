import { handle, ok, readJson } from "@/lib/api";
import { getProduct, updateProduct } from "@/server/catalog";
import { getCurrentUser } from "@/server/session";

type Ctx = RouteContext<"/api/v1/admin/products/[id]">;

export const GET = (_req: Request, { params }: Ctx) =>
  handle(async () => ok(await getProduct(await getCurrentUser(), (await params).id)));

export const PATCH = (req: Request, { params }: Ctx) =>
  handle(async () => ok(await updateProduct(await getCurrentUser(), (await params).id, await readJson(req))));
