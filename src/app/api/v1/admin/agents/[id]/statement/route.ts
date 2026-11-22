import { handle } from "@/lib/api";
import { csvResponse } from "@/lib/csv";
import { getCurrentUser } from "@/server/session";
import { agentStatementCsv } from "@/server/statement";

/** Super admin: one agent's statement as CSV. */
export const GET = (_req: Request, { params }: RouteContext<"/api/v1/admin/agents/[id]/statement">) =>
  handle(async () => {
    const { csv, name } = await agentStatementCsv(await getCurrentUser(), (await params).id);
    return csvResponse(csv, name);
  });
