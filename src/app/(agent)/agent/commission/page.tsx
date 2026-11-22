import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { formatDay, formatMonthYear } from "@/lib/dates";
import { formatPaise } from "@/lib/money";
import { listMyCommission } from "@/server/commission";
import { listMyInvoices } from "@/server/invoices";
import { requirePageUser } from "@/server/session";
import { todayInIndia } from "@/shared/tracker";

export default async function CommissionPage() {
  const t = await getTranslations("agent.commission");
  const tc = await getTranslations("common");
  const locale = await getLocale();
  const user = await requirePageUser(["AGENT"]);
  const [{ lines, earned, awaitingRate }, invoices] = await Promise.all([listMyCommission(user), listMyInvoices(user)]);
  // What actually reached the agent: net of TDS, from paid invoices.
  const paidNet = invoices.filter((i) => i.status === "PAID").reduce((t, i) => t + i.net, 0);

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-6">
      <Link href="/agent" className="text-sm hover:underline">
        ← {tc("back")}
      </Link>
      <h1 className="text-[28px] leading-tight font-semibold">{t("title")}</h1>

      <dl className="grid grid-cols-2 overflow-hidden rounded-2xl bg-card ring-1 ring-border">
        <div className="p-4">
          <dt className="text-muted-foreground">{t("earned")}</dt>
          <dd className="text-3xl font-bold [font-stretch:80%]">{formatPaise(earned)}</dd>
        </div>
        <div className="border-l border-border p-4">
          <dt className="text-muted-foreground">{t("paid")}</dt>
          <dd className="text-3xl font-bold text-paid [font-stretch:80%]">{formatPaise(paidNet)}</dd>
        </div>
      </dl>
      {awaitingRate > 0 && <p className="rounded-xl p-3 text-due-ink ring-1 ring-due">{t("awaitingRate", { count: awaitingRate })}</p>}

      <section aria-labelledby="invoices">
        <h2 id="invoices" className="border-b-2 border-primary pb-1 text-lg font-semibold">
          {t("invoices")}
        </h2>
        {invoices.length === 0 ? (
          <p className="py-3 text-muted-foreground">{t("noInvoices")}</p>
        ) : (
          <ul className="divide-y divide-border">
            {invoices.map((inv) => (
              <li key={inv.id} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="font-medium">{formatMonthYear(`${inv.period}-01`, locale)}</p>
                  <p className="text-[15px] text-muted-foreground">
                    {t("invoiceLine", { number: inv.number, net: formatPaise(inv.net), tds: formatPaise(inv.tds) })}{" "}
                    <span className={inv.status === "PAID" ? "text-paid" : "text-due-ink"}>{t(`invoiceStatus.${inv.status}`)}</span>
                  </p>
                </div>
                <a href={`/api/v1/agent-invoices/${inv.id}/pdf`} download className="shrink-0 rounded-lg px-3 py-2 font-medium text-primary ring-1 ring-input hover:bg-mist">
                  {t("pdf")}
                </a>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="lines">
        <h2 id="lines" className="border-b-2 border-primary pb-1 text-lg font-semibold">
          {t("lines")}
        </h2>
        {lines.length === 0 ? (
          <p className="py-3 text-muted-foreground">{t("empty")}</p>
        ) : (
          <ul className="divide-y divide-border">
            {lines.map((l) => {
              const p = l.payment;
              return (
                <li key={l.id} className="flex items-baseline justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{p?.member.name}</p>
                    <p className="text-[15px] text-muted-foreground">
                      {p &&
                        t("line", {
                          token: p.installment.enrolment.tokenNumber,
                          month: formatMonthYear(p.installment.dueDate.toISOString().slice(0, 10), locale),
                          day: formatDay(p.paidAt ? todayInIndia(p.paidAt) : todayInIndia(l.createdAt), locale),
                        })}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="font-semibold tabular-nums">{l.ruleMissing ? t("rateMissing") : formatPaise(l.amount)}</p>
                    <p className={`text-[14px] ${l.status === "PAID" ? "text-paid" : "text-muted-foreground"}`}>{t(`status.${l.status}`)}</p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
