import { BookOpen } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { ActionForm } from "@/components/action-form";
import { Field } from "@/components/field";
import { formatPaise, paiseToRupees } from "@/lib/money";
import { listSchemes } from "@/server/catalog";
import { requirePageUser } from "@/server/session";
import { adminRoles } from "@/shared/auth";
import { PageHeader } from "@/components/ui-bits";
import { schemeTone } from "@/components/glass";
import { updateSchemeAction } from "../actions";

type Rule = { type: "TIER" } | { type: "FLAT"; amount: number } | { type: "PERCENT"; bps: number };

export default async function SchemesPage() {
  const t = await getTranslations("admin.schemes");
  const tc = await getTranslations("common");
  const schemes = await listSchemes(await requirePageUser(adminRoles));

  return (
    <div className="flex flex-col gap-6">
      <PageHeader tone="violet" icon={BookOpen} title={t("title")} />
      {schemes.map((s) => {
        const rule = s.commissionRule as Rule;
        return (
          <section key={s.id} className="flex flex-col gap-3 overflow-hidden rounded-[28px] bg-card p-5">
            <h2 className={`glass-${schemeTone[s.code] ?? "violet"} -mx-5 -mt-5 mb-1 px-5 pt-6 pb-4 text-[22px] leading-tight font-semibold tracking-tight text-white`}>
              {s.nameEn} <span className="font-normal text-white/85">{s.nameHi}</span>
            </h2>
            <p className="text-sm text-muted-foreground">
              {t("commission")}:{" "}
              {rule.type === "FLAT"
                ? t("rule.FLAT", { amount: formatPaise(rule.amount) })
                : rule.type === "PERCENT"
                  ? t("rule.PERCENT", { percent: rule.bps / 100 })
                  : t("rule.TIER")}
            </p>
            <ActionForm action={updateSchemeAction.bind(null, s.id)} submitLabel={tc("save")}>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label={t("nameEn")} name="nameEn" defaultValue={s.nameEn} required />
                <Field label={t("nameHi")} name="nameHi" defaultValue={s.nameHi} required />
                <Field
                  label={t("installment")}
                  name="installment"
                  inputMode="decimal"
                  defaultValue={paiseToRupees(s.installmentAmount)}
                  required
                />
                <Field label={t("tenure")} name="tenureMonths" type="number" min={1} max={60} defaultValue={s.tenureMonths} required />
              </div>
            </ActionForm>
          </section>
        );
      })}
    </div>
  );
}
