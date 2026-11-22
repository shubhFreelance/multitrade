import { getTranslations } from "next-intl/server";
import { ActionForm } from "@/components/action-form";
import { Field } from "@/components/field";
import { formatPaise, paiseToRupees } from "@/lib/money";
import { listSchemes } from "@/server/catalog";
import { requirePageUser } from "@/server/session";
import { adminRoles } from "@/shared/auth";
import { updateSchemeAction } from "../actions";

type Rule = { type: "TIER" } | { type: "FLAT"; amount: number } | { type: "PERCENT"; bps: number };

export default async function SchemesPage() {
  const t = await getTranslations("admin.schemes");
  const tc = await getTranslations("common");
  const schemes = await listSchemes(await requirePageUser(adminRoles));

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold">{t("title")}</h1>
      {schemes.map((s) => {
        const rule = s.commissionRule as Rule;
        return (
          <section key={s.id} className="flex flex-col gap-3 rounded-xl border p-4">
            <h2 className="font-medium">
              {s.nameEn} · {s.nameHi}
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
