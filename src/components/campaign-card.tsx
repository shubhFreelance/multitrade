import { getLocale, getTranslations } from "next-intl/server";
import { formatDay } from "@/lib/dates";
import { formatPaise } from "@/lib/money";
import type { getMyCampaign } from "@/server/campaign";

/** The agent's progress in the recruitment campaign: a bar with a mark at each tier. Real counts only, no promises. */
export async function CampaignCard({ c }: { c: NonNullable<Awaited<ReturnType<typeof getMyCampaign>>> }) {
  const t = await getTranslations("campaign");
  const locale = await getLocale();
  const tiers = c.campaign.tiers;
  const top = tiers.at(-1)!.enrolments;
  const pct = (n: number) => `${Math.min(100, (n / top) * 100)}%`;

  return (
    <section aria-labelledby="campaign" className="glass glass-sunrise p-5">
      <h2 id="campaign" className="text-[22px] leading-tight font-semibold tracking-tight">
        {t("title")}
      </h2>
      <p className="mt-1 text-white/90">
        {t("window", { start: formatDay(c.campaign.start, locale), end: formatDay(c.campaign.end, locale), n: c.campaign.countsAfterPaidInstallments })}
      </p>

      <div className="relative mt-9 mb-9 h-3 rounded-full bg-white/25" role="img" aria-label={t("countLine", { count: c.count })}>
        <div className="h-full rounded-full bg-white" style={{ width: pct(c.count) }} />
        {tiers.map((tier) => {
          const hit = c.count >= tier.enrolments;
          const last = tier.enrolments === top; // its labels hang left so they stay inside the card
          return (
            <div key={tier.enrolments} className="absolute top-1/2 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center" style={{ left: pct(tier.enrolments) }}>
              <span className={`absolute -top-7 text-[13px] font-semibold whitespace-nowrap tabular-nums ${last ? "right-0" : ""}`}>{tier.enrolments}</span>
              <span className={`size-4 rounded-full ring-2 ring-white/60 ${hit ? "bg-white" : "bg-white/30"}`} />
              <span className={`absolute top-5 text-[13px] whitespace-nowrap tabular-nums ${last ? "right-0" : ""} ${hit ? "font-semibold" : "text-white/85"}`}>
                {formatPaise(tier.bonus)}
              </span>
            </div>
          );
        })}
      </div>

      <p className="text-[22px] font-semibold tracking-tight">{t("countLine", { count: c.count })}</p>
      {c.awarded !== null ? (
        <p className="font-medium text-white">{t("awarded", { amount: formatPaise(c.awarded) })}</p>
      ) : c.ended ? (
        <p>{c.reached ? t("endedReached", { amount: formatPaise(c.reached.bonus) }) : t("endedNone")}</p>
      ) : !c.started ? (
        <p>{t("notStarted", { start: formatDay(c.campaign.start, locale) })}</p>
      ) : (
        <>
          {c.reached && <p className="font-medium text-white">{t("reached", { amount: formatPaise(c.reached.bonus) })}</p>}
          {c.next && <p>{t("toNext", { more: c.toNext, amount: formatPaise(c.next.bonus) })}</p>}
        </>
      )}
    </section>
  );
}
