import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { CampaignCard } from "@/components/campaign-card";
import { formatPaise } from "@/lib/money";
import { getMyAgentProfile } from "@/server/agents";
import { getMyCampaign } from "@/server/campaign";
import { requirePageUser } from "@/server/session";
import { listAgentEnrolments } from "@/server/tracker";

export default async function AgentHome() {
  const t = await getTranslations("agent");
  const user = await requirePageUser(["AGENT"]);
  const profile = await getMyAgentProfile(user);

  if (!profile?.approved) {
    return (
      <div className="mx-auto flex w-full max-w-xl flex-col gap-4">
        <h1 className="text-[28px] leading-tight font-semibold">{t("title")}</h1>
        <p role="status" className="rounded-2xl bg-card p-4 ring-1 ring-border">
          {t("awaitingApproval")}
        </p>
      </div>
    );
  }

  const [enrolments, campaign] = await Promise.all([listAgentEnrolments(user), getMyCampaign(user)]);
  const owing = enrolments.filter((e) => e.summary.dueNowCount > 0);
  const owed = owing.reduce((sum, e) => sum + e.summary.dueNowTotal, 0);
  // A member can hold several enrolments; count people, not enrolments.
  const people = (list: typeof enrolments) => new Set(list.map((e) => e.member.phone)).size;

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-4">
      <h1 className="text-[28px] leading-tight font-semibold">{t("greeting", { name: user.name })}</h1>
      <Link href="/agent/members" className="flex flex-col gap-1 rounded-2xl bg-card p-4 ring-1 ring-border hover:ring-primary">
        <span className="text-lg font-semibold">{t("members.title")}</span>
        <span className="text-muted-foreground">
          {owing.length > 0
            ? t("summaryOwing", { members: people(enrolments), owing: people(owing), amount: formatPaise(owed) })
            : t("summaryClear", { members: people(enrolments) })}
        </span>
      </Link>
      {campaign && <CampaignCard c={campaign} />}
      <Link href="/agent/commission" className="flex flex-col gap-1 rounded-2xl bg-card p-4 ring-1 ring-border hover:ring-primary">
        <span className="text-lg font-semibold">{t("commission.title")}</span>
        <span className="text-muted-foreground">{t("commission.cardHint")}</span>
      </Link>
      <Link href="/agent/enrol" className="flex min-h-14 items-center justify-center rounded-xl bg-primary px-6 text-lg font-semibold text-primary-foreground hover:bg-primary/90">
        {t("enrol.title")}
      </Link>
    </div>
  );
}
