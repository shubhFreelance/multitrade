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
    <section aria-labelledby="campaign" className="rounded-2xl bg-card p-4 ring-1 ring-border">
      <h2 id="campaign" className="text-lg font-semibold">
        {t("title")}
      </h2>
      <p className="text-muted-foreground">
        {t("window", { start: formatDay(c.campaign.start, locale), end: formatDay(c.campaign.end, locale), n: c.campaign.countsAfterPaidInstallments })}
      </p>

      <div className="relative mt-8 mb-9 h-3 rounded-full bg-mist" role="img" aria-label={t("countLine", { count: c.count })}>
        <div className="h-full rounded-full bg-paid" style={{ width: pct(c.count) }} />
        {tiers.map((tier) => {
          const hit = c.count >= tier.enrolments;
          const last = tier.enrolments === top; // its labels hang left so they stay inside the card
          return (
            <div key={tier.enrolments} className="absolute top-1/2 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center" style={{ left: pct(tier.enrolments) }}>
              <span className={`absolute -top-7 text-[13px] font-semibold whitespace-nowrap tabular-nums ${last ? "right-0" : ""}`}>{tier.enrolments}</span>
              <span className={`size-4 rounded-full ring-2 ring-card ${hit ? "bg-paid" : "bg-input"}`} />
              <span className={`absolute top-5 text-[13px] whitespace-nowrap tabular-nums ${last ? "right-0" : ""} ${hit ? "font-semibold text-paid" : "text-muted-foreground"}`}>
                {formatPaise(tier.bonus)}
              </span>
            </div>
          );
        })}
      </div>

      <p className="text-lg font-semibold">{t("countLine", { count: c.count })}</p>
      {c.awarded !== null ? (
        <p className="font-medium text-paid">{t("awarded", { amount: formatPaise(c.awarded) })}</p>
      ) : c.ended ? (
        <p>{c.reached ? t("endedReached", { amount: formatPaise(c.reached.bonus) }) : t("endedNone")}</p>
      ) : !c.started ? (
        <p>{t("notStarted", { start: formatDay(c.campaign.start, locale) })}</p>
      ) : (
        <>
          {c.reached && <p className="font-medium text-paid">{t("reached", { amount: formatPaise(c.reached.bonus) })}</p>}
          {c.next && <p>{t("toNext", { more: c.toNext, amount: formatPaise(c.next.bonus) })}</p>}
        </>
      )}
    </section>
  );
}
