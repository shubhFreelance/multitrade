import { handle, ok, readJson } from "@/lib/api";
import { createProduct, listProducts } from "@/server/catalog";
import { getCurrentUser } from "@/server/session";

export const GET = () => handle(async () => ok(await listProducts(await getCurrentUser())));

export const POST = (req: Request) =>
  handle(async () => ok(await createProduct(await getCurrentUser(), await readJson(req)), 201));
