import { getLocale, getTranslations } from "next-intl/server";
import { BonusCard } from "@/components/bonus-card";
import { CompletionCard } from "@/components/completion-card";
import { DotRhythm } from "@/components/dot-rhythm";
import { Glass } from "@/components/glass";
import { EnrolmentCard } from "@/components/tracker/enrolment-card";
import { formatDay, formatMonthShort } from "@/lib/dates";
import { formatPaise } from "@/lib/money";
import { getMyBonus } from "@/server/bonus";
import { listMyCompletions } from "@/server/completion";
import { canPayOnline } from "@/server/payments";
import { requirePageUser } from "@/server/session";
import { listMyEnrolments } from "@/server/tracker";

export default async function MemberHome() {
  const t = await getTranslations("member");
  const th = await getTranslations("member.home");
  const locale = await getLocale();
  const user = await requirePageUser(["MEMBER"]);
  const [enrolments, bonus, completions] = await Promise.all([listMyEnrolments(user), getMyBonus(user), listMyCompletions(user)]);

  // Paid months across every scheme, one dot column per calendar month.
  const slots = enrolments.flatMap((e) => e.summary.slots);
  const months = [...new Set(slots.map((s) => s.dueDate.slice(0, 7)))].sort();
  const paidPerMonth = months.map((m) => slots.filter((s) => s.dueDate.startsWith(m) && s.state === "PAID").length);
  const paidTotal = enrolments.reduce((t, e) => t + e.summary.paidTotal, 0);
  const paidCount = enrolments.reduce((t, e) => t + e.summary.paidCount, 0);
  const dueNow = enrolments.reduce((t, e) => t + e.summary.dueNowTotal, 0);
  const overdue = slots.some((s) => s.state === "OVERDUE");
  const next = enrolments.map((e) => e.summary.next).filter((n) => n !== null).sort((a, b) => a!.dueDate.localeCompare(b!.dueDate))[0];
  const nextBonus = bonus.find((p) => !p.unlocked) ?? bonus.at(-1);
  const month = (m: string) => formatMonthShort(`${m}-01`, locale);

  return (
    <div className="flex flex-col gap-4 lg:gap-6">
      <div className="px-1">
        <h1 className="text-[30px] leading-tight font-semibold tracking-tight lg:text-[36px]">{t("greeting", { name: user.name })}</h1>
        <p className="text-muted-foreground">{t("title")}</p>
      </div>

      {completions.length > 0 && (
        <div className="grid items-start gap-4 lg:grid-cols-2 lg:gap-6">
          {completions.map((c) => (
            <CompletionCard key={c.id} c={c} />
          ))}
        </div>
      )}

      {enrolments.length === 0 ? (
        <Glass tone="peach" href="/member/join" linkLabel={th("joinCta")} className="flex min-h-56 flex-col justify-end lg:min-h-72 lg:p-8">
          <p className="max-w-2xl text-[28px] leading-tight font-semibold tracking-tight lg:text-[40px]">{t("empty")}</p>
          <p className="mt-1 text-white/90">{th("joinCta")}</p>
        </Glass>
      ) : (
        // Phones: one column in reading order. Desktop: the money and the schemes on the left, summaries on the right.
        <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-6 2xl:grid-cols-[minmax(0,1fr)_420px]">
          <Glass tone="violet" className="flex flex-col gap-4 lg:col-start-1 lg:row-start-1 lg:min-h-72 lg:justify-between lg:p-8">
            <div>
              <p className="text-[15px] text-white/85">{th("paidLabel")}</p>
              <p className="mt-1 flex flex-wrap items-baseline gap-x-3">
                <span className="text-[44px] leading-none font-semibold tracking-tight tabular-nums lg:text-[64px]">{formatPaise(paidTotal)}</span>
                <span className="text-white/85">{th("acrossPayments", { count: paidCount })}</span>
              </p>
            </div>
            {months.length > 0 && (
              <DotRhythm values={paidPerMonth} rows={Math.max(4, Math.min(8, enrolments.length * 3))} labels={[month(months[0]), month(months[Math.floor(months.length / 2)]), month(months.at(-1)!)]} />
            )}
          </Glass>

          <div className="grid grid-cols-2 gap-3 lg:col-start-2 lg:row-start-1 lg:h-full lg:grid-cols-1 lg:gap-4">
            <Glass tone={dueNow > 0 ? "coral" : "blue"} className="flex min-h-40 flex-col justify-end p-4 lg:p-5">
              <p className="text-[15px] text-white/85">{dueNow > 0 ? (overdue ? th("overdueNow") : th("dueNow")) : th("nextDue")}</p>
              <p className="text-[28px] leading-tight font-semibold tracking-tight tabular-nums lg:text-[34px]">{formatPaise(dueNow > 0 ? dueNow : (next?.amount ?? 0))}</p>
              <p className="text-[14px] text-white/85">{next ? formatDay(next.dueDate, locale) : th("allPaid")}</p>
            </Glass>
            {nextBonus && (
              <Glass tone="pink" href="#bonus" linkLabel={th("bonusLink")} className="flex min-h-40 flex-col justify-end p-4 lg:p-5">
                <p className="text-[15px] text-white/85">{th(nextBonus.prize)}</p>
                <p className="text-[28px] leading-tight font-semibold tracking-tight tabular-nums lg:text-[34px]">
                  {nextBonus.paid}/{nextBonus.needed}
                </p>
                <p className="text-[14px] text-white/85">{nextBonus.unlocked ? th("unlocked") : th("toUnlock", { count: nextBonus.remaining })}</p>
              </Glass>
            )}
          </div>

          <div className="grid items-start gap-4 lg:col-start-1 lg:row-start-2 lg:gap-6 xl:grid-cols-2">
            {enrolments.map((e) => (
              <EnrolmentCard key={e.id} e={e} canPay={canPayOnline()} />
            ))}
          </div>

          <div className="lg:sticky lg:top-6 lg:col-start-2 lg:row-start-2">
            <BonusCard prizes={bonus} />
          </div>
        </div>
      )}
    </div>
  );
}
