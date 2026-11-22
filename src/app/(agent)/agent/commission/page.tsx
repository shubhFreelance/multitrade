import { FileText, Megaphone, Wallet } from "lucide-react";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { formatDay, formatMonthYear } from "@/lib/dates";
import { formatPaise } from "@/lib/money";
import { listMyCommission } from "@/server/commission";
import { listMyInvoices } from "@/server/invoices";
import { requirePageUser } from "@/server/session";
import { IconChip, PageHeader, SectionTitle } from "@/components/ui-bits";
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
      <Link href="/agent" className="-my-2 inline-flex min-h-11 items-center self-start text-[15px] hover:underline">
        ← {tc("back")}
      </Link>
      <PageHeader tone="violet" icon={Wallet} title={t("title")} intro={t("cardHint")} />

      <dl className="grid grid-cols-2 gap-3">
        <div className="glass glass-blue flex min-h-36 flex-col-reverse justify-end gap-1 p-4">
          <dt className="text-[15px] text-white/90">{t("earned")}</dt>
          <dd className="text-[30px] leading-none font-semibold tracking-tight tabular-nums">{formatPaise(earned)}</dd>
        </div>
        <div className="glass glass-sunrise flex min-h-36 flex-col-reverse justify-end gap-1 p-4">
          <dt className="text-[15px] text-white/90">{t("paid")}</dt>
          <dd className="text-[30px] leading-none font-semibold tracking-tight tabular-nums">{formatPaise(paidNet)}</dd>
        </div>
      </dl>
      {awaitingRate > 0 && <p className="tint-amber text-tint rounded-2xl p-4 font-medium">{t("awaitingRate", { count: awaitingRate })}</p>}
      <a href="/api/v1/agent/statement" download className="tint-violet text-tint flex min-h-12 items-center justify-center gap-2 rounded-full font-semibold hover:brightness-95">
        {t("downloadStatement")}
      </a>

      <section aria-labelledby="invoices" className="flex flex-col gap-3">
        <SectionTitle id="invoices" tint="violet" count={invoices.length}>
          {t("invoices")}
        </SectionTitle>
        {invoices.length === 0 ? (
          <p className="py-3 text-muted-foreground">{t("noInvoices")}</p>
        ) : (
          <ul className="divide-y divide-border rounded-[28px] bg-card px-4">
            {invoices.map((inv) => (
              <li key={inv.id} className="flex items-center justify-between gap-3 py-3.5">
                <IconChip icon={FileText} tint={inv.status === "PAID" ? "sunrise" : "amber"} />
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{formatMonthYear(`${inv.period}-01`, locale)}</p>
                  <p className="text-[15px] text-muted-foreground">
                    {t("invoiceLine", { number: inv.number, net: formatPaise(inv.net), tds: formatPaise(inv.tds) })}{" "}
                    <span className={inv.status === "PAID" ? "text-paid" : "text-due-ink"}>{t(`invoiceStatus.${inv.status}`)}</span>
                  </p>
                </div>
                <a href={`/api/v1/agent-invoices/${inv.id}/pdf`} download className="tint-violet text-tint shrink-0 rounded-full px-4 py-2 font-semibold hover:brightness-95">
                  {t("pdf")}
                </a>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="lines" className="flex flex-col gap-3">
        <SectionTitle id="lines" tint="blue" count={lines.length}>
          {t("lines")}
        </SectionTitle>
        {lines.length === 0 ? (
          <p className="py-3 text-muted-foreground">{t("empty")}</p>
        ) : (
          <ul className="divide-y divide-border rounded-[28px] bg-card px-4">
            {lines.map((l) => {
              const p = l.payment;
              return (
                <li key={l.id} className="flex items-center justify-between gap-3 py-3.5">
                  <IconChip icon={l.type === "BONUS" ? Megaphone : Wallet} tint={l.type === "BONUS" ? "sunrise" : "blue"} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{l.type === "BONUS" ? t("bonusLine") : p?.member.name}</p>
                    <p className="text-[15px] text-muted-foreground">
                      {l.type === "BONUS" && l.campaign && t("bonusCampaign", { campaign: l.campaign.replace("/", " – ") })}
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
