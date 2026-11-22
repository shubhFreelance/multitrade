import { getLocale, getTranslations } from "next-intl/server";
import { confirmFulfilmentAction } from "@/app/(member)/member/actions";
import { ActionForm } from "@/components/action-form";
import { formatPaise } from "@/lib/money";
import type { listMyCompletions } from "@/server/completion";

type Completion = Awaited<ReturnType<typeof listMyCompletions>>[number];

/** Stays on the member's dashboard until they act: confirm the address, choose a product or book the gold purchase. */
export async function CompletionCard({ c }: { c: Completion }) {
  const t = await getTranslations("completion");
  const locale = await getLocale();
  const hi = locale === "hi";
  const scheme = hi ? c.scheme.nameHi : c.scheme.nameEn;
  const code = c.scheme.code;

  if (c.status === "CONFIRMED" || c.status === "ALLOCATED") {
    const g = c.priceDetails;
    return (
      <section className="rounded-[28px] bg-card p-5">
        <h2 className="text-lg font-semibold">{t("confirmedTitle", { scheme, token: c.tokenNumber })}</h2>
        <p>
          {code === "GOLD"
            ? t("confirmedGold")
            : code === "MANPASAND" && c.product
              ? t("confirmedProduct", { product: hi ? (c.product.nameHi ?? c.product.name) : c.product.name, address: c.address })
              : t("confirmedAddress", { address: c.address })}
        </p>
        {c.status === "CONFIRMED" && c.product && c.product.difference > 0 && (
          <p className="font-medium text-due-ink">{t("differenceDue", { amount: formatPaise(c.product.difference) })}</p>
        )}
        {c.status === "ALLOCATED" && (
          <div className="mt-2 flex flex-col gap-1">
            {g && <p>{t("goldPriced", { weight: (g.weightMg / 1000).toFixed(3), rate: formatPaise(g.ratePerGram), making: formatPaise(g.making), gst: formatPaise(g.gst) })}</p>}
            <p>{t("finalPrice", { price: formatPaise(c.price ?? 0), value: formatPaise(c.value) })}</p>
            {c.differenceDue && !c.differencePaid ? (
              <p className="font-semibold text-due-ink">{t("payBeforeDelivery", { amount: formatPaise(c.differenceDue) })}</p>
            ) : (
              <p className="font-medium text-paid">{c.differenceDue ? t("differenceReceived") : t("nothingToPay")}</p>
            )}
          </div>
        )}
        <p className="text-muted-foreground">{t("officeWillCall")}</p>
      </section>
    );
  }

  const address = (
    <label className="flex flex-col gap-1.5">
      <span className="font-medium">{t("address")}</span>
      <textarea name="address" defaultValue={c.address} required minLength={5} maxLength={300} rows={3} className="rounded-2xl border border-input bg-card px-3.5 py-2.5 text-base" />
    </label>
  );

  return (
    <section aria-labelledby={`c-${c.id}`} className="overflow-hidden rounded-[28px] bg-card">
      <header className="glass-sunrise px-5 pt-6 pb-5 text-white">
        <h2 id={`c-${c.id}`} className="text-[26px] leading-tight font-semibold tracking-tight">
          {c.reason === "WON" ? t("wonTitle", { scheme }) : t("maturedTitle", { scheme })}
        </h2>
        <p className="mt-2 inline-block rounded-full bg-white/20 px-3 py-1 text-[14px] font-semibold tracking-wide ring-1 ring-white/30">{c.tokenNumber}</p>
      </header>
      <div className="flex flex-col gap-3 p-5">
        <p>{t(`ask.${code}`, { value: formatPaise(c.value) })}</p>
        {c.goldRate && <p className="font-medium">{t("todayGoldRate", { rate: formatPaise(c.goldRate.ratePerGram), purity: c.goldRate.purity })}</p>}
        <ActionForm action={confirmFulfilmentAction.bind(null, c.id)} submitLabel={t(`submit.${code}`)} buttonClassName="h-12 w-full text-base font-semibold">
          {code === "MANPASAND" &&
            (c.products.length === 0 ? (
              <p className="rounded-xl bg-mist p-3">{t("noProducts")}</p>
            ) : (
              <fieldset className="flex flex-col gap-2">
                <legend className="mb-1.5 font-medium">{t("chooseProduct")}</legend>
                {c.products.map((p) => (
                  <label key={p.id} className="flex cursor-pointer items-start gap-3 rounded-2xl bg-secondary p-4 has-checked:bg-card has-checked:ring-2 has-checked:ring-primary">
                    <input type="radio" name="productId" value={p.id} required className="mt-1 size-5 accent-primary" />
                    <span className="flex flex-1 flex-col">
                      <span className="flex justify-between gap-3 font-semibold">
                        {hi ? (p.nameHi ?? p.name) : p.name} <span className="tabular-nums">{formatPaise(p.price)}</span>
                      </span>
                      <span className={p.difference > 0 ? "text-due-ink" : "text-paid"}>
                        {p.difference > 0
                          ? t("payDifference", { amount: formatPaise(p.difference) })
                          : p.notRefunded > 0
                            ? t("coveredNotRefunded", { amount: formatPaise(p.notRefunded) })
                            : t("covered")}
                      </span>
                    </span>
                  </label>
                ))}
              </fieldset>
            ))}
          {code !== "GOLD" && address}
        </ActionForm>
      </div>
    </section>
  );
}
