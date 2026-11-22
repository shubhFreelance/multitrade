import { UserPlus } from "lucide-react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { CampaignCard } from "@/components/campaign-card";
import { DotRhythm } from "@/components/dot-rhythm";
import { Glass } from "@/components/glass";
import { formatPaise } from "@/lib/money";
import { getMyAgentProfile } from "@/server/agents";
import { getMyCampaign } from "@/server/campaign";
import { myCommissionRhythm } from "@/server/commission";
import { requirePageUser } from "@/server/session";
import { listAgentEnrolments } from "@/server/tracker";

export default async function AgentHome() {
  const t = await getTranslations("agent");
  const th = await getTranslations("agent.home");
  const user = await requirePageUser(["AGENT"]);
  const profile = await getMyAgentProfile(user);

  if (!profile?.approved) {
    return (
      <div className="mx-auto flex w-full max-w-xl flex-col gap-4">
        <h1 className="px-1 text-[30px] leading-tight font-semibold tracking-tight">{t("title")}</h1>
        <Glass tone="peach" as="div" role="status" className="min-h-40 text-lg font-medium">
          {t("awaitingApproval")}
        </Glass>
      </div>
    );
  }

  const [enrolments, campaign, rhythm] = await Promise.all([listAgentEnrolments(user), getMyCampaign(user), myCommissionRhythm(user)]);
  const owing = enrolments.filter((e) => e.summary.dueNowCount > 0);
  const owed = owing.reduce((sum, e) => sum + e.summary.dueNowTotal, 0);
  // A member can hold several enrolments; count people, not enrolments.
  const people = (list: typeof enrolments) => new Set(list.map((e) => e.member.phone)).size;
  const days = rhythm.counts.length;

  return (
    <div className="flex flex-col gap-4 lg:gap-6">
      <h1 className="px-1 text-[30px] leading-tight font-semibold tracking-tight lg:text-[36px]">{t("greeting", { name: user.name })}</h1>

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-6 2xl:grid-cols-[minmax(0,1fr)_420px]">
        <Glass tone="violet" href="/agent/commission" linkLabel={t("commission.title")} className="flex flex-col gap-4 lg:col-start-1 lg:row-start-1 lg:min-h-80 lg:justify-between lg:p-8">
          <div>
            <p className="text-[15px] text-white/85">{th("commissionMonth")}</p>
            <p className="mt-1 flex flex-wrap items-baseline gap-x-3">
              <span className="text-[44px] leading-none font-semibold tracking-tight tabular-nums lg:text-[64px]">{formatPaise(rhythm.total)}</span>
              <span className="text-white/85">{th("fromPayments", { count: rhythm.count })}</span>
            </p>
          </div>
          <DotRhythm values={rhythm.counts} rows={8} highlight={rhythm.today - 1} labels={["1", "15", String(days)]} />
        </Glass>

        <div className="grid grid-cols-2 gap-3 lg:col-start-2 lg:row-start-1 lg:h-full lg:grid-cols-1 lg:gap-4">
          <Glass tone="blue" href="/agent/members" linkLabel={t("members.title")} className="flex min-h-40 flex-col justify-end p-4 lg:p-5">
            <p className="text-[15px] text-white/85">{th("members")}</p>
            <p className="text-[36px] leading-none font-semibold tracking-tight tabular-nums lg:text-[44px]">{people(enrolments)}</p>
            <p className="text-[14px] text-white/85">{th("schemes", { count: enrolments.length })}</p>
          </Glass>
          <Glass tone={owed > 0 ? "coral" : "blue"} href="/agent/members" linkLabel={t("members.title")} className="flex min-h-40 flex-col justify-end p-4 lg:p-5">
            <p className="text-[15px] text-white/85">{th("toCollect")}</p>
            <p className="text-[28px] leading-tight font-semibold tracking-tight tabular-nums lg:text-[34px]">{formatPaise(owed)}</p>
            <p className="text-[14px] text-white/85">{th("fromMembers", { count: people(owing) })}</p>
          </Glass>
        </div>

        {campaign && (
          <div className="lg:col-start-1 lg:row-start-2">
            <CampaignCard c={campaign} />
          </div>
        )}

        <Link
          href="/agent/enrol"
          className="flex min-h-14 items-center justify-center gap-2 rounded-full bg-primary px-6 text-lg font-semibold text-primary-foreground transition hover:-translate-y-0.5 hover:bg-primary/85 active:translate-y-0 lg:col-start-2 lg:row-start-2 lg:min-h-16"
        >
          <UserPlus aria-hidden className="size-5" />
          {t("enrol.title")}
        </Link>
      </div>
    </div>
  );
}
