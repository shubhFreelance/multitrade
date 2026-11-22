import { handle, ok } from "@/lib/api";
import { awardCampaignBonuses } from "@/server/campaign";
import { getCurrentUser } from "@/server/session";

export const POST = () => handle(async () => ok(await awardCampaignBonuses(await getCurrentUser()), 201));
