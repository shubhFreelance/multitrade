import { getTranslations } from "next-intl/server";
import { getMyAgentProfile } from "@/server/agents";
import { requirePageUser } from "@/server/session";

export default async function Page() {
  const t = await getTranslations("agent");
  const profile = await getMyAgentProfile(await requirePageUser(["AGENT"]));

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">{t("title")}</h1>
      {!profile?.approved && (
        <p role="status" className="rounded-xl border p-4">
          {t("awaitingApproval")}
        </p>
      )}
    </div>
  );
}
