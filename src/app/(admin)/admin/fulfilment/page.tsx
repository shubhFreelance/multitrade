import { getLocale, getTranslations } from "next-intl/server";
import { ActionForm } from "@/components/action-form";
import { Field, SelectField } from "@/components/field";
import { formatDay } from "@/lib/dates";
import { formatPaise } from "@/lib/money";
import { listFulfilments } from "@/server/fulfilment";
import { requirePageUser } from "@/server/session";
import { adminRoles } from "@/shared/auth";
import type { GoldPrice } from "@/shared/fulfilment";
import { todayInIndia } from "@/shared/tracker";
import { allocateAction, deliveredAction, differencePaidAction, setGoldRateAction } from "../actions";

type Data = Awaited<ReturnType<typeof listFulfilments>>;
type Item = Data["items"][number];

export default async function FulfilmentPage() {
  const t = await getTranslations("admin.fulfilment");
  const tc = await getTranslations("completion");
  const locale = await getLocale();
  const hi = locale === "hi";
  const data = await listFulfilments(await requirePageUser(adminRoles));
  const groups = (["CONFIRMED", "ALLOCATED", "PENDING", "DELIVERED"] as const).map((s) => [s, data.items.filter((i) => i.status === s)] as const);
  const productName = (p: { name: string; nameHi: string | null }) => (hi ? (p.nameHi ?? p.name) : p.name);

  const breakdown = (f: Item) => {
    const g = f.priceDetails as GoldPrice | null;
    return (
      <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-0.5 rounded-lg bg-mist px-3 py-2 tabular-nums">
        {g && (
          <>
            <dt>{t("goldLine", { weight: (g.weightMg / 1000).toFixed(3), rate: formatPaise(g.ratePerGram) })}</dt>
            <dd className="text-right">{formatPaise(g.gold)}</dd>
            <dt>{t("making")}</dt>
            <dd className="text-right">{formatPaise(g.making)}</dd>
            <dt>{t("goldGst", { pct: g.goldGstBps / 100 })}</dt>
            <dd className="text-right">{formatPaise(g.goldGst)}</dd>
            <dt>{t("makingGst", { pct: g.makingGstBps / 100 })}</dt>
            <dd className="text-right">{formatPaise(g.makingGst)}</dd>
          </>
        )}
        <dt className="font-semibold">{t("price")}</dt>
        <dd className="text-right font-semibold">{formatPaise(f.price ?? 0)}</dd>
        <dt>{t("planValue")}</dt>
        <dd className="text-right">− {formatPaise(f.value)}</dd>
        <dt className="font-semibold">{t("difference")}</dt>
        <dd className={`text-right font-semibold ${f.differenceDue && !f.differencePaidAt ? "text-due-ink" : "text-paid"}`}>{formatPaise(f.differenceDue ?? 0)}</dd>
      </dl>
    );
  };

  const card = (f: Item) => {
    const e = f.enrolment;
    const code = e.batch.scheme.code;
    return (
      <li key={f.id} className="flex flex-col gap-3 rounded-xl bg-card p-4 ring-1 ring-border">
        <div>
          <p className="flex flex-wrap items-baseline justify-between gap-x-3">
            <span className="text-lg font-semibold">{e.member.name}</span>
            <span className="font-bold tracking-wider [font-stretch:75%]">{e.tokenNumber}</span>
          </p>
          <p className="text-muted-foreground">
            {hi ? e.batch.scheme.nameHi : e.batch.scheme.nameEn}, {t(`reason.${f.reason}`)}.{" "}
            <a href={`tel:+91${e.member.phone}`} className="underline underline-offset-4">
              {e.member.phone}
            </a>
            {e.agent && `. ${t("agent", { name: e.agent.name })}`}
          </p>
          {f.address && <p>{t("deliverTo", { address: f.address })}</p>}
          {f.product && <p className="font-medium">{t("product", { name: productName(f.product), price: formatPaise(f.product.price) })}</p>}
          <p className="text-muted-foreground">{t("worth", { value: formatPaise(f.value) })}</p>
        </div>

        {f.status === "CONFIRMED" && code === "UPAHAR" && (
          <ActionForm action={allocateAction.bind(null, f.id)} submitLabel={t("allocate")}>
            <SelectField label={t("chooseUpahar")} name="productId" required>
              {data.upaharProducts.map((p) => (
                <option key={p.id} value={p.id}>
                  {t("productOption", { name: productName(p), price: formatPaise(p.price), stock: p.stock })}
                </option>
              ))}
            </SelectField>
          </ActionForm>
        )}
        {f.status === "CONFIRMED" && code === "MANPASAND" && <ActionForm action={allocateAction.bind(null, f.id)} submitLabel={t("allocateChosen")} />}
        {f.status === "CONFIRMED" && code === "GOLD" &&
          (data.goldRate ? (
            <ActionForm action={allocateAction.bind(null, f.id)} submitLabel={t("priceGold")}>
              <div className="grid grid-cols-2 gap-3">
                <Field label={t("weight")} name="weight" inputMode="decimal" placeholder="10.000" required />
                <Field label={t("makingRupees")} name="making" inputMode="decimal" placeholder="1500" required />
              </div>
              <p className="text-[15px] text-muted-foreground">{t("usesRate", { rate: formatPaise(data.goldRate.ratePerGram), goldPct: data.goldGstBps / 100, makingPct: data.makingGstBps / 100 })}</p>
            </ActionForm>
          ) : (
            <p className="rounded-lg bg-mist p-3 text-due-ink">{t("needRate")}</p>
          ))}

        {(f.status === "ALLOCATED" || f.status === "DELIVERED") && breakdown(f)}
        {f.status === "ALLOCATED" && !!f.differenceDue && !f.differencePaidAt && (
          <ActionForm action={differencePaidAction.bind(null, f.id)} submitLabel={t("recordDifference", { amount: formatPaise(f.differenceDue) })}>
            <Field label={t("ref")} name="ref" required minLength={4} maxLength={40} />
          </ActionForm>
        )}
        {f.differencePaidAt && <p className="text-paid">{t("differencePaid", { ref: f.differenceRef ?? "", day: formatDay(todayInIndia(f.differencePaidAt), locale) })}</p>}
        {f.status === "ALLOCATED" && (!f.differenceDue || f.differencePaidAt) && (
          <ActionForm action={deliveredAction.bind(null, f.id)} submitLabel={t("deliver")} confirm={t("confirmDeliver", { name: e.member.name, token: e.tokenNumber })} />
        )}
        {f.status === "DELIVERED" && f.deliveredAt && <p className="font-medium text-paid">{t("deliveredOn", { day: formatDay(todayInIndia(f.deliveredAt), locale) })}</p>}
        {f.status === "PENDING" && <p className="text-muted-foreground">{tc(`ask.${code}`, { value: formatPaise(f.value) })}</p>}
      </li>
    );
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold">{t("title")}</h1>
        <p className="text-muted-foreground">{t("intro")}</p>
      </div>

      <section aria-labelledby="gold-rate" className="flex flex-col gap-3 rounded-xl bg-card p-4 ring-1 ring-border">
        <h2 id="gold-rate" className="text-lg font-semibold">
          {t("goldRate")}
        </h2>
        <p className={data.goldRate ? "" : "text-due-ink"}>
          {data.goldRate ? t("todayRate", { rate: formatPaise(data.goldRate.ratePerGram), purity: data.goldRate.purity }) : t("noRateToday")}
        </p>
        <ActionForm action={setGoldRateAction} submitLabel={data.goldRate ? t("correctRate") : t("saveRate")}>
          <Field label={t("ratePerGram")} name="rate" inputMode="decimal" placeholder="7200" required />
        </ActionForm>
        {data.recentRates.length > 0 && (
          <ul className="flex flex-wrap gap-x-4 gap-y-1 text-[15px] text-muted-foreground">
            {data.recentRates.map((r) => (
              <li key={r.id}>
                {formatDay(r.day.toISOString().slice(0, 10), locale)}: {formatPaise(r.ratePerGram)}
              </li>
            ))}
          </ul>
        )}
      </section>

      {groups.map(([status, items]) => (
        <section key={status} aria-labelledby={`g-${status}`} className="flex flex-col gap-3">
          <h2 id={`g-${status}`} className="border-b pb-1 text-lg font-semibold">
            {t(`group.${status}`, { count: items.length })}
          </h2>
          {items.length === 0 ? <p className="text-muted-foreground">{t("none")}</p> : <ul className="flex flex-col gap-3">{items.map(card)}</ul>}
        </section>
      ))}
    </div>
  );
}
