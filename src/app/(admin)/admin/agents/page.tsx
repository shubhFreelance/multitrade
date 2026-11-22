import { Users } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { ActionForm } from "@/components/action-form";
import { listAgents } from "@/server/agents";
import { requirePageUser } from "@/server/session";
import { adminRoles } from "@/shared/auth";
import { Avatar, Chip, PageHeader } from "@/components/ui-bits";
import { approveAgentAction, setAgentStatusAction } from "../actions";

export default async function AgentsPage() {
  const t = await getTranslations("admin.agents");
  const agents = await listAgents(await requirePageUser(adminRoles));

  return (
    <div className="flex flex-col gap-6">
      <PageHeader tone="blue" icon={Users} title={t("title")} />
      {agents.length === 0 && <p className="text-sm text-muted-foreground">{t("empty")}</p>}
      <ul className="grid items-start gap-3 lg:grid-cols-2 lg:gap-4 2xl:grid-cols-3">
        {agents.map((a) => {
          const approved = a.agentProfile?.approved ?? false;
          const suspended = a.status === "SUSPENDED";
          return (
            <li key={a.id} className="flex flex-col gap-3 rounded-[28px] bg-card p-5 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex gap-3">
                <Avatar name={a.name} tint={suspended ? "coral" : approved ? "violet" : "amber"} />
                <div>
                  <p className="text-lg leading-tight font-semibold">{a.name}</p>
                  <p className="text-[15px] text-muted-foreground">
                    {a.phone}
                    {a.agentProfile && `, ${a.agentProfile.panchayat}`}
                  </p>
                  <Chip tint={suspended ? "coral" : approved ? "sunrise" : "amber"} className="mt-1.5">
                    {suspended ? t("suspended") : approved ? t("approved") : t("pending")}
                  </Chip>
                </div>
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
                    buttonClassName="tint-coral text-tint h-11 self-start px-6 font-semibold hover:brightness-95"
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
