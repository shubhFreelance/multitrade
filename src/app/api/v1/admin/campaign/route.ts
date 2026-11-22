import { handle, ok, readJson } from "@/lib/api";
import { campaignOverview, updateCampaign } from "@/server/campaign";
import { getCurrentUser } from "@/server/session";

export const GET = () => handle(async () => ok(await campaignOverview(await getCurrentUser())));
export const PUT = (req: Request) => handle(async () => ok(await updateCampaign(await getCurrentUser(), await readJson(req))));
