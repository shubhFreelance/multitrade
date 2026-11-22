import { getLocale, getTranslations } from "next-intl/server";
import { ActionForm } from "@/components/action-form";
import { Field } from "@/components/field";
import { formatDay } from "@/lib/dates";
import { formatPaise, paiseToRupees } from "@/lib/money";
import { campaignOverview } from "@/server/campaign";
import { requirePageUser } from "@/server/session";
import { awardCampaignAction, updateCampaignAction } from "../actions";

export default async function CampaignPage() {
  const t = await getTranslations("campaign");
  const locale = await getLocale();
  const o = await campaignOverview(await requirePageUser(["SUPER_ADMIN"]));
  const c = o.campaign;
  const toAward = o.agents.filter((a) => a.reached && a.awarded === null).length;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold">{t("adminTitle")}</h1>
        <p className="text-muted-foreground">{t("adminIntro")}</p>
      </div>

      {c && (
        <section aria-labelledby="standings" className="flex flex-col gap-3">
          <h2 id="standings" className="text-lg font-semibold">
            {t("standings", { start: formatDay(c.start, locale), end: formatDay(c.end, locale) })}
          </h2>
          <ul className="divide-y divide-border rounded-xl bg-card px-4 ring-1 ring-border">
            {o.agents.map((a) => (
              <li key={a.id} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-3">
                <span>
                  <span className="font-semibold">{a.name}</span> <span className="text-muted-foreground">{a.panchayat}</span>
                </span>
                <span className="tabular-nums">
                  {t("agentCount", { count: a.count })}
                  {a.awarded !== null ? (
                    <span className="ml-3 font-semibold text-paid">{t("awardedShort", { amount: formatPaise(a.awarded) })}</span>
                  ) : a.reached ? (
                    <span className="ml-3 font-semibold">{formatPaise(a.reached.bonus)}</span>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
          {o.ended ? (
            toAward > 0 ? (
              <ActionForm action={awardCampaignAction} submitLabel={t("award", { count: toAward })} confirm={t("confirmAward", { count: toAward })} />
            ) : (
              <p className="text-muted-foreground">{t("nothingToAward")}</p>
            )
          ) : (
            <p className="text-muted-foreground">{t("awardAfter", { end: formatDay(c.end, locale) })}</p>
          )}
        </section>
      )}

      <section aria-labelledby="settings" className="flex flex-col gap-3 rounded-xl bg-card p-4 ring-1 ring-border">
        <h2 id="settings" className="text-lg font-semibold">
          {t("settings")}
        </h2>
        <ActionForm action={updateCampaignAction} submitLabel={t("save")}>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t("start")} name="start" type="date" defaultValue={c?.start} required />
            <Field label={t("end")} name="end" type="date" defaultValue={c?.end} required />
          </div>
          <Field label={t("countsAfter")} name="countsAfter" type="number" min={1} max={12} defaultValue={c?.countsAfterPaidInstallments ?? 1} required />
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 font-medium">{t("tiers")}</legend>
            {[0, 1, 2, 3, 4].map((i) => {
              const tier = c?.tiers[i];
              return (
                <div key={i} className="grid grid-cols-2 gap-3">
                  <Field label={t("tierCount")} name={`tierCount${i}`} type="number" min={1} defaultValue={tier?.enrolments} />
                  <Field label={t("tierBonus")} name={`tierBonus${i}`} inputMode="decimal" defaultValue={tier ? paiseToRupees(tier.bonus) : undefined} />
                </div>
              );
            })}
          </fieldset>
          <p className="text-[15px] text-muted-foreground">{t("settingsHint")}</p>
        </ActionForm>
      </section>
    </div>
  );
}
