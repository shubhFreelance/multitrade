import { handle, ok } from "@/lib/api";
import { getMyCampaign } from "@/server/campaign";
import { getCurrentUser } from "@/server/session";

export const GET = () => handle(async () => ok(await getMyCampaign(await getCurrentUser())));
