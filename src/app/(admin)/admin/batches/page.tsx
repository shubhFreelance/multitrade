import { Layers } from "lucide-react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ActionForm } from "@/components/action-form";
import { Field, SelectField } from "@/components/field";
import { listBatches, listSchemes } from "@/server/catalog";
import { requirePageUser } from "@/server/session";
import { adminRoles } from "@/shared/auth";
import { batchLabel } from "@/shared/catalog";
import { Chip, IconChip, PageHeader } from "@/components/ui-bits";
import { schemeTone } from "@/components/glass";
import { createBatchAction } from "../actions";

export default async function BatchesPage() {
  const t = await getTranslations("admin.batches");
  const user = await requirePageUser(adminRoles);
  const [batches, schemes] = await Promise.all([listBatches(user), listSchemes(user)]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader tone="violet" icon={Layers} title={t("title")} />

      <ul className="flex flex-col divide-y divide-border overflow-hidden rounded-[28px] bg-card">
        {batches.map((b) => (
          <li key={b.id}>
            <Link href={`/admin/batches/${b.id}`} className="flex items-center justify-between gap-3 px-5 py-4 hover:bg-secondary">
              <span className="flex items-center gap-3">
                <IconChip icon={Layers} tint={schemeTone[b.scheme.code] ?? "violet"} />
                <span>
                  <span className="block font-semibold">{batchLabel(b.scheme.code, b.number)}</span>
                  <span className="text-[15px] text-muted-foreground">
                    {b.scheme.nameEn}, {t("starts", { month: b.startMonth.toISOString().slice(0, 7) })}
                  </span>
                </span>
              </span>
              <Chip tint={b.status === "OPEN" ? "sunrise" : b.status === "RUNNING" ? "blue" : "amber"}>{t(`statuses.${b.status}`)}</Chip>
            </Link>
          </li>
        ))}
      </ul>

      <section className="flex flex-col gap-3 rounded-[28px] bg-card p-5">
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
