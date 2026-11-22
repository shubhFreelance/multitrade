import { getLocale, getTranslations } from "next-intl/server";
import { prizeHandedOverAction, runBonusDrawAction } from "@/app/(admin)/admin/actions";
import { ActionForm } from "@/components/action-form";
import { formatDay } from "@/lib/dates";
import type { bonusOverview } from "@/server/bonus";
import { todayInIndia } from "@/shared/tracker";

/** Admin: one card per bonus prize: who can win it now, run it once, then the winners and hand-over. */
export async function BonusDrawAdmin({ prizes }: { prizes: Awaited<ReturnType<typeof bonusOverview>> }) {
  const t = await getTranslations("bonusDraw");
  const tb = await getTranslations("bonus");
  const locale = await getLocale();
  return (
    <section aria-labelledby="bonus-draws" className="flex flex-col gap-3">
      <div>
        <h2 id="bonus-draws" className="text-lg font-semibold">
          {t("adminTitle")}
        </h2>
        <p className="text-muted-foreground">{t("adminIntro")}</p>
      </div>
      {prizes.map((p) => (
        <article key={p.prize} className="flex flex-col gap-3 rounded-xl bg-card p-4 ring-1 ring-border">
          <div>
            <h3 className="text-lg font-semibold">{tb(p.prize, { count: p.count })}</h3>
            <p className="text-muted-foreground">{t("unlockAt", { months: p.needed, eligible: p.eligibleNow })}</p>
          </div>
          {!p.draw ? (
            p.eligibleNow > 0 && p.count > 0 ? (
              <ActionForm action={runBonusDrawAction.bind(null, p.prize)} submitLabel={t("run")} confirm={t("confirmRun", { prize: tb(p.prize, { count: p.count }), eligible: p.eligibleNow })} />
            ) : (
              <p className="text-muted-foreground">{t("nobodyYet")}</p>
            )
          ) : (
            <>
              <p>{t("ranOn", { day: formatDay(todayInIndia(p.draw.createdAt), locale), eligible: p.draw.eligibleCount })}</p>
              <ol className="flex flex-col divide-y divide-border border-y">
                {p.draw.winners.map((w) => (
                  <li key={w.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 py-2.5">
                    <div>
                      <p className="font-semibold">
                        {w.name} <span className="font-bold tracking-wider [font-stretch:75%]">{w.token}</span>
                      </p>
                      <a href={`tel:+91${w.phone}`} className="text-muted-foreground underline underline-offset-4">
                        {w.phone}
                      </a>
                    </div>
                    {w.handedOverAt ? (
                      <p className="text-paid">{t("handedOverOn", { day: formatDay(todayInIndia(w.handedOverAt), locale) })}</p>
                    ) : (
                      <ActionForm action={prizeHandedOverAction.bind(null, w.id)} submitLabel={t("handOver")} confirm={t("confirmHandOver", { name: w.name })} />
                    )}
                  </li>
                ))}
              </ol>
              <p className="text-[13px] break-all text-muted-foreground">
                {t("seed")} {p.draw.seed}
              </p>
            </>
          )}
        </article>
      ))}
    </section>
  );
}
