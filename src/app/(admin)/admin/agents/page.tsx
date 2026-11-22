import { getTranslations } from "next-intl/server";
import { ActionForm } from "@/components/action-form";
import { listAgents } from "@/server/agents";
import { requirePageUser } from "@/server/session";
import { adminRoles } from "@/shared/auth";
import { approveAgentAction, setAgentStatusAction } from "../actions";

export default async function AgentsPage() {
  const t = await getTranslations("admin.agents");
  const agents = await listAgents(await requirePageUser(adminRoles));

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold">{t("title")}</h1>
      {agents.length === 0 && <p className="text-sm text-muted-foreground">{t("empty")}</p>}
      <ul className="flex flex-col gap-3">
        {agents.map((a) => {
          const approved = a.agentProfile?.approved ?? false;
          const suspended = a.status === "SUSPENDED";
          return (
            <li key={a.id} className="flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="font-medium">{a.name}</p>
                <p className="text-sm text-muted-foreground">
                  {a.phone}
                  {a.agentProfile && ` · ${a.agentProfile.panchayat}`}
                </p>
                <p className="mt-1 text-sm">
                  {suspended ? t("suspended") : approved ? t("approved") : t("pending")}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {!approved && !suspended && <ActionForm action={approveAgentAction.bind(null, a.id)} submitLabel={t("approve")} />}
                {suspended ? (
                  <ActionForm action={setAgentStatusAction.bind(null, a.id, "ACTIVE")} submitLabel={t("reactivate")} />
                ) : (
                  <ActionForm
                    action={setAgentStatusAction.bind(null, a.id, "SUSPENDED")}
                    submitLabel={t("suspend")}
                    confirm={t("confirmSuspend", { name: a.name })}
                  />
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
