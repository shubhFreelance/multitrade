import { handle } from "@/lib/api";
import { csvResponse } from "@/lib/csv";
import { getCurrentUser } from "@/server/session";
import { agentStatementCsv } from "@/server/statement";

/** The signed-in agent's statement (commission lines and payouts) as CSV. */
export const GET = () =>
  handle(async () => {
    const { csv, name } = await agentStatementCsv(await getCurrentUser());
    return csvResponse(csv, name);
  });
