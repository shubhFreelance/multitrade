import { FileText } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { ActionForm } from "@/components/action-form";
import { Field, SelectField } from "@/components/field";
import { formatDay, formatMonthYear } from "@/lib/dates";
import { formatPaise } from "@/lib/money";
import { invoiceOverview } from "@/server/invoices";
import { requirePageUser } from "@/server/session";
import { todayInIndia } from "@/shared/tracker";
import { PageHeader, SectionTitle } from "@/components/ui-bits";
import { cancelAgentInvoiceAction, createAgentInvoicesAction, markAgentInvoicePaidAction } from "../actions";

/** The last 12 months that have ended, newest first, as "YYYY-MM". */
function pastMonths(): string[] {
  const [y, m] = todayInIndia().split("-").map(Number);
  return Array.from({ length: 12 }, (_, i) => new Date(Date.UTC(y, m - 2 - i, 1)).toISOString().slice(0, 7));
}

const statusTone = { ISSUED: "text-due-ink", PAID: "text-paid", CANCELLED: "text-muted-foreground line-through" } as const;

export default async function InvoicesPage({ searchParams }: PageProps<"/admin/invoices">) {
  const t = await getTranslations("admin.invoices");
  const locale = await getLocale();
  const q = (await searchParams).q;
  const o = await invoiceOverview(await requirePageUser(["SUPER_ADMIN"]), typeof q === "string" ? q : undefined);
  const months = pastMonths();

  return (
    <div className="flex flex-col gap-8">
      <PageHeader tone="violet" icon={FileText} title={t("title")} />

      <section aria-labelledby="agent-invoices" className="flex flex-col gap-4">
        <SectionTitle id="agent-invoices" tint="violet">
          {t("agentTitle")}
        </SectionTitle>
        <p>{t("uninvoiced", { amount: formatPaise(o.uninvoicedTotal), count: o.uninvoicedCount })}</p>
        {o.awaitingRate > 0 && <p className="rounded-xl p-3 text-due-ink ring-1 ring-due">{t("awaitingRate", { count: o.awaitingRate })}</p>}

        <div className="rounded-xl bg-card p-4">
          <ActionForm
            action={createAgentInvoicesAction}
            submitLabel={t("create")}
            confirm={t("confirmCreate")}
          >
            <SelectField label={t("period")} name="period" defaultValue={months[0]}>
              {months.map((m) => (
                <option key={m} value={m}>
                  {formatMonthYear(`${m}-01`, locale)}
                </option>
              ))}
            </SelectField>
            <p className="text-sm text-muted-foreground">{t("createHint")}</p>
          </ActionForm>
        </div>

        {o.agentInvoices.length === 0 ? (
          <p className="text-muted-foreground">{t("noAgentInvoices")}</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {o.agentInvoices.map((inv) => (
              <li key={inv.id} className="flex flex-col gap-3 rounded-xl bg-card p-4">
                <div className="flex flex-wrap items-baseline justify-between gap-x-4">
                  <p className="font-semibold">
                    {inv.agent.name} <span className="font-normal text-muted-foreground">{formatMonthYear(`${inv.period}-01`, locale)}</span>
                  </p>
                  <p className={`font-medium ${statusTone[inv.status]}`}>{t(`status.${inv.status}`)}</p>
                </div>
                <p className="text-[15px] text-muted-foreground">
                  {t("amounts", { number: inv.number, gross: formatPaise(inv.gross), tds: formatPaise(inv.tds), net: formatPaise(inv.net) })}
                  {inv.status === "PAID" && ` ${t("paidWith", { utr: inv.utr ?? "", day: formatDay(todayInIndia(inv.paidAt!), locale) })}`}
                </p>
                <div className="flex flex-wrap items-end gap-2">
                  <a href={`/api/v1/agent-invoices/${inv.id}/pdf`} download className="flex h-11 items-center rounded-lg px-4 font-medium text-primary ring-1 ring-input hover:bg-mist">
                    {t("download")}
                  </a>
                  {inv.status === "ISSUED" && (
                    <>
                      <ActionForm action={markAgentInvoicePaidAction.bind(null, inv.id)} submitLabel={t("markPaid")}>
                        <Field label={t("utr")} name={`utr`} id={`utr-${inv.id}`} required minLength={6} maxLength={30} autoComplete="off" />
                      </ActionForm>
                      <ActionForm
                        action={cancelAgentInvoiceAction.bind(null, inv.id)}
                        submitLabel={t("cancel")}
                        confirm={t("confirmCancel", { number: inv.number })}
                        buttonClassName="h-11 bg-card px-5 text-overdue ring-1 ring-overdue hover:bg-mist"
                      />
                    </>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="member-invoices" className="flex flex-col gap-4">
        <SectionTitle id="member-invoices" tint="blue">
          {t("memberTitle")}
        </SectionTitle>
        <form className="flex items-end gap-2" role="search">
          <div className="flex-1">
            <Field label={t("search")} name="q" defaultValue={typeof q === "string" ? q : ""} placeholder={t("searchHint")} />
          </div>
          <button type="submit" className="h-11 rounded-lg bg-primary px-5 font-medium text-primary-foreground">
            {t("find")}
          </button>
        </form>
        {o.memberInvoices.length === 0 ? (
          <p className="text-muted-foreground">{t("noMemberInvoices")}</p>
        ) : (
          <ul className="divide-y divide-border rounded-xl bg-card">
            {o.memberInvoices.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-3 p-3">
                <div className="min-w-0">
                  <p className="truncate font-medium">
                    {p.member.name} <span className="font-normal text-muted-foreground">{p.installment.enrolment.tokenNumber}</span>
                  </p>
                  <p className="text-[15px] text-muted-foreground">
                    {p.invoiceNo}, {formatPaise(p.amount)}, {formatDay(todayInIndia(p.paidAt!), locale)}
                  </p>
                </div>
                <a href={`/api/v1/payments/${p.id}/invoice`} download className="shrink-0 rounded-lg px-3 py-2 font-medium text-primary ring-1 ring-input hover:bg-mist">
                  {t("pdf")}
                </a>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
