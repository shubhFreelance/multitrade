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
    <div className="mx-auto flex w-full max-w-xl flex-col gap-4">
      <h1 className="px-1 text-[30px] leading-tight font-semibold tracking-tight">{t("greeting", { name: user.name })}</h1>

      <Glass tone="violet" href="/agent/commission" linkLabel={t("commission.title")} className="flex flex-col gap-4">
        <p className="text-[15px] text-white/85">{th("commissionMonth")}</p>
        <p className="-mt-3 flex flex-wrap items-baseline gap-x-3">
          <span className="text-[44px] leading-none font-semibold tracking-tight tabular-nums">{formatPaise(rhythm.total)}</span>
          <span className="text-white/85">{th("fromPayments", { count: rhythm.count })}</span>
        </p>
        <DotRhythm values={rhythm.counts} rows={6} highlight={rhythm.today - 1} labels={["1", "15", String(days)]} />
      </Glass>

      <div className="grid grid-cols-2 gap-3">
        <Glass tone="blue" href="/agent/members" linkLabel={t("members.title")} className="flex min-h-40 flex-col justify-end p-4">
          <p className="text-[15px] text-white/85">{th("members")}</p>
          <p className="text-[36px] leading-none font-semibold tracking-tight tabular-nums">{people(enrolments)}</p>
          <p className="text-[14px] text-white/85">{th("schemes", { count: enrolments.length })}</p>
        </Glass>
        <Glass tone={owed > 0 ? "coral" : "blue"} href="/agent/members" linkLabel={t("members.title")} className="flex min-h-40 flex-col justify-end p-4">
          <p className="text-[15px] text-white/85">{th("toCollect")}</p>
          <p className="text-[28px] leading-tight font-semibold tracking-tight tabular-nums">{formatPaise(owed)}</p>
          <p className="text-[14px] text-white/85">{th("fromMembers", { count: people(owing) })}</p>
        </Glass>
      </div>

      {campaign && <CampaignCard c={campaign} />}

      <Link href="/agent/enrol" className="flex min-h-14 items-center justify-center gap-2 rounded-full bg-primary px-6 text-lg font-semibold text-primary-foreground hover:bg-primary/85">
        <UserPlus aria-hidden className="size-5" />
        {t("enrol.title")}
      </Link>
    </div>
  );
}
