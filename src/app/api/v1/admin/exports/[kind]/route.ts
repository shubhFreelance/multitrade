import { handle } from "@/lib/api";
import { csvResponse } from "@/lib/csv";
import { exportCsv } from "@/server/exports";
import { getCurrentUser } from "@/server/session";

export const GET = (req: Request, { params }: RouteContext<"/api/v1/admin/exports/[kind]">) =>
  handle(async () => {
    const q = new URL(req.url).searchParams;
    const { csv, name } = await exportCsv(await getCurrentUser(), { kind: (await params).kind, from: q.get("from") || undefined, to: q.get("to") || undefined });
    return csvResponse(csv, name);
  });
