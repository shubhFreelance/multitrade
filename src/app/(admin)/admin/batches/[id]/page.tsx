import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ActionForm } from "@/components/action-form";
import { Field, SelectField } from "@/components/field";
import { getBatch } from "@/server/catalog";
import { getCurrentUser } from "@/server/session";
import { batchLabel, batchStatuses } from "@/shared/catalog";
import { updateBatchAction } from "../../actions";

export default async function BatchPage({ params }: PageProps<"/admin/batches/[id]">) {
  const t = await getTranslations("admin.batches");
  const tc = await getTranslations("common");
  const b = await getBatch(await getCurrentUser(), (await params).id);
  const open = b.status === "OPEN";
  const nextStatuses = batchStatuses.slice(batchStatuses.indexOf(b.status));

  return (
    <div className="flex flex-col gap-4">
      <Link href="/admin/batches" className="text-sm hover:underline">
        ← {tc("back")}
      </Link>
      <h1 className="text-xl font-semibold">
        {batchLabel(b.scheme.code, b.number)} · {b.scheme.nameEn}
      </h1>
      {!open && <p className="text-sm text-muted-foreground">{t("locked")}</p>}

      <ActionForm action={updateBatchAction.bind(null, b.id)} submitLabel={tc("save")}>
        <div className="grid gap-3 sm:grid-cols-2">
          {open ? (
            <>
              <Field label={t("startMonth")} name="startMonth" type="month" defaultValue={b.startMonth.toISOString().slice(0, 7)} required />
              <Field label={t("size")} name="size" type="number" min={1} defaultValue={b.size} required />
              <Field label={t("winnersPerDraw")} name="winnersPerDraw" type="number" min={0} defaultValue={b.winnersPerDraw} required />
            </>
          ) : (
            <dl className="text-sm sm:col-span-2">
              <dt className="text-muted-foreground">{t("startMonth")}</dt>
              <dd>{b.startMonth.toISOString().slice(0, 7)}</dd>
              <dt className="mt-2 text-muted-foreground">{t("size")}</dt>
              <dd>{b.size}</dd>
              <dt className="mt-2 text-muted-foreground">{t("winnersPerDraw")}</dt>
              <dd>{b.winnersPerDraw}</dd>
            </dl>
          )}
          <SelectField label={t("status")} name="status" defaultValue={b.status}>
            {nextStatuses.map((s) => (
              <option key={s} value={s}>
                {t(`statuses.${s}`)}
              </option>
            ))}
          </SelectField>
        </div>
      </ActionForm>
    </div>
  );
}
