import { Trophy } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { ActionForm } from "@/components/action-form";
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
      {batches.map((b) => (
        <section key={b.id} className="overflow-hidden rounded-xl bg-card">
          <header className="flex flex-wrap items-baseline justify-between gap-x-4 border-b px-4 py-3">
            <h2 className="text-lg font-semibold">
              {locale === "hi" ? b.scheme.nameHi : b.scheme.nameEn} <span className="font-bold tracking-wider [font-stretch:75%]">{b.label}</span>
            </h2>
            <p className="text-muted-foreground">{t("batchLine", { members: b.members, winners: b.winnersPerDraw })}</p>
          </header>
          <div className="flex flex-col gap-3 p-4">
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
              <ol className="flex flex-col divide-y divide-border border-t">
                {b.draws.map((d) => (
                  <li key={d.id} className="flex flex-col gap-1 py-3">
                    <p className="font-semibold">
                      {t("monthDraw", { month: d.monthNo })}{" "}
                      <span className="font-normal text-muted-foreground">
                        {t("ranOn", { day: formatDay(todayInIndia(d.createdAt), locale), eligible: d.eligibleCount })}
                      </span>
                    </p>
                    <p className="font-bold tracking-wider [font-stretch:75%]">{d.winners.join(", ")}</p>
                    <p className="text-[13px] break-all text-muted-foreground">
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
  );
}
