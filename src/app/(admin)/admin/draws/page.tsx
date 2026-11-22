import { Trophy } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { ActionForm } from "@/components/action-form";
import { toneAt } from "@/components/glass";
import { BonusDrawAdmin } from "@/components/bonus-draw-admin";
import { formatDay } from "@/lib/dates";
import { bonusOverview } from "@/server/bonus";
import { listDrawBatches } from "@/server/draws";
import { requirePageUser } from "@/server/session";
import { adminRoles } from "@/shared/auth";
import { todayInIndia } from "@/shared/tracker";
import { PageHeader } from "@/components/ui-bits";
import { runDrawAction } from "../actions";

export default async function DrawsPage() {
  const t = await getTranslations("draws");
  const locale = await getLocale();
  const user = await requirePageUser(adminRoles);
  const [batches, bonus] = await Promise.all([listDrawBatches(user), bonusOverview(user)]);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader tone="violet" icon={Trophy} title={t("adminTitle")} />
      <BonusDrawAdmin prizes={bonus} />
      <div>
        <h2 className="text-lg font-semibold">{t("monthlyTitle")}</h2>
        <p className="text-muted-foreground">{t("adminIntro")}</p>
      </div>
      <div className="grid items-start gap-4 lg:grid-cols-2 lg:gap-6 2xl:grid-cols-3">
      {batches.map((b, bi) => (
        <section key={b.id} className="overflow-hidden rounded-[28px] bg-card">
          {/* Each batch has its own colour; each of its past draws takes the next ones, so no two neighbours match. */}
          <header className={`glass-${toneAt(bi)} flex flex-col gap-1 px-5 pt-5 pb-4 text-white`}>
            <h2 className="flex flex-wrap items-center gap-2 text-[22px] leading-tight font-semibold tracking-tight">
              {locale === "hi" ? b.scheme.nameHi : b.scheme.nameEn}
              <span className="rounded-full bg-white/20 px-3 py-0.5 text-[14px] tracking-wide ring-1 ring-white/30">{b.label}</span>
            </h2>
            <p className="text-white/85">{t("batchLine", { members: b.members, winners: b.winnersPerDraw })}</p>
          </header>
          <div className="flex flex-col gap-3 p-5">
            {b.nextMonth === null ? (
              <p className="text-muted-foreground">{t("allDone")}</p>
            ) : b.canRun ? (
              <ActionForm
                action={runDrawAction.bind(null, b.id, b.nextMonth)}
                submitLabel={t("run", { month: b.nextMonth })}
                confirm={t("confirmRun", { month: b.nextMonth, batch: b.label })}
              />
            ) : (
              <p className="text-muted-foreground">
                {b.winnersPerDraw === 0 ? t("noWinnersSet") : t("opensOn", { month: b.nextMonth, day: formatDay(b.opensOn!, locale) })}
              </p>
            )}
            {b.draws.length > 0 && (
              <ol className="flex flex-col gap-2.5">
                {b.draws.map((d, di) => (
                  <li key={d.id} className={`tint-${toneAt(bi + di + 1)} flex flex-col gap-2 rounded-2xl p-4`}>
                    <p className="flex flex-wrap items-baseline gap-x-2">
                      <span className="text-tint font-semibold">{t("monthDraw", { month: d.monthNo })}</span>
                      <span className="text-[15px] text-foreground/70">{t("ranOn", { day: formatDay(todayInIndia(d.createdAt), locale), eligible: d.eligibleCount })}</span>
                    </p>
                    <ul className="flex flex-wrap gap-1.5">
                      {d.winners.map((w) => (
                        <li key={w} className="text-tint rounded-full bg-white px-3 py-0.5 text-[14px] font-semibold tracking-wide">
                          {w}
                        </li>
                      ))}
                    </ul>
                    <p className="text-[13px] break-all text-foreground/60">
                      {t("seed")} {d.seed}
                    </p>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </section>
      ))}
      </div>
    </div>
  );
}
