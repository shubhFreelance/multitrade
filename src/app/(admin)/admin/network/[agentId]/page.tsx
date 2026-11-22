import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Figures, MemberRow, PeriodTabs } from "@/components/network";
import { formatPaise } from "@/lib/money";
import { toAppError } from "@/server/errors";
import { getAgentNetwork } from "@/server/network";
import { PageHeader } from "@/components/ui-bits";
import { Download, Users } from "lucide-react";
import { requirePageUser } from "@/server/session";

export default async function AgentNetworkPage({ params, searchParams }: PageProps<"/admin/network/[agentId]">) {
  const t = await getTranslations("network");
  const tc = await getTranslations("common");
  const { agentId } = await params;
  const net = await getAgentNetwork(await requirePageUser(["SUPER_ADMIN"]), agentId, (await searchParams).period).catch((err) =>
    toAppError(err).code === "NOT_FOUND" ? notFound() : Promise.reject(err),
  );

  return (
    <div className="flex flex-col gap-5">
      <Link href={`/admin/network?period=${net.period}`} className="-my-2 inline-flex min-h-11 items-center self-start text-[15px] hover:underline">
        ← {tc("back")}
      </Link>
      <PageHeader tone="blue" icon={Users} title={net.agent.name} intro={t("agentLine", { panchayat: net.agent.panchayat, phone: net.agent.phone })}>
        <a
          href={`/api/v1/admin/agents/${net.agent.id}/statement`}
          download
          className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-full bg-white px-4 font-semibold text-[#3443b3] hover:bg-white/90"
        >
          <Download aria-hidden className="size-4" />
          {t("downloadStatement")}
        </a>
      </PageHeader>
      <PeriodTabs current={net.period} base={`/admin/network/${agentId}`} />
      <Figures
        items={[
          [t("people"), String(net.totals.people)],
          [t("schemes"), String(net.totals.enrolments)],
          [t("joinedIn", { period: net.period }), String(net.totals.joined)],
          [t("commissionIn", { period: net.period }), formatPaise(net.totals.commission)],
        ]}
      />
      {net.members.length === 0 ? (
        <p className="rounded-xl bg-card p-4">{t("noMembers")}</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {net.members.map((e) => (
            <MemberRow key={e.id} e={e} period={net.period} href={`/admin/network/members/${e.id}`} />
          ))}
        </ul>
      )}
    </div>
  );
}
