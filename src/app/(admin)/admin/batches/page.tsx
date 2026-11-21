import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ActionForm } from "@/components/action-form";
import { Field, SelectField } from "@/components/field";
import { listBatches, listSchemes } from "@/server/catalog";
import { getCurrentUser } from "@/server/session";
import { batchLabel } from "@/shared/catalog";
import { createBatchAction } from "../actions";

export default async function BatchesPage() {
  const t = await getTranslations("admin.batches");
  const user = await getCurrentUser();
  const [batches, schemes] = await Promise.all([listBatches(user), listSchemes(user)]);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold">{t("title")}</h1>

      <ul className="flex flex-col divide-y rounded-xl border">
        {batches.map((b) => (
          <li key={b.id}>
            <Link href={`/admin/batches/${b.id}`} className="flex items-center justify-between gap-2 p-4 hover:bg-muted">
              <span>
                <span className="font-medium">{batchLabel(b.scheme.code, b.number)}</span>{" "}
                <span className="text-sm text-muted-foreground">
                  {b.scheme.nameEn} · {t("starts", { month: b.startMonth.toISOString().slice(0, 7) })}
                </span>
              </span>
              <span className="text-sm">{t(`statuses.${b.status}`)}</span>
            </Link>
          </li>
        ))}
      </ul>

      <section className="flex flex-col gap-3 rounded-xl border p-4">
        <h2 className="font-medium">{t("new")}</h2>
        <ActionForm action={createBatchAction} submitLabel={t("create")}>
          <div className="grid gap-3 sm:grid-cols-2">
            <SelectField label={t("scheme")} name="schemeId" required>
              {schemes.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nameEn}
                </option>
              ))}
            </SelectField>
            <Field label={t("startMonth")} name="startMonth" type="month" required />
            <Field label={t("size")} name="size" type="number" min={1} defaultValue={2500} required />
            <Field label={t("winnersPerDraw")} name="winnersPerDraw" type="number" min={0} defaultValue={10} required />
          </div>
        </ActionForm>
      </section>
    </div>
  );
}
