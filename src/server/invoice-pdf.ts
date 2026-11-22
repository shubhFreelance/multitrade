// The two invoice documents. Labels come from messages/*.json (namespace "invoicePdf") in the viewer's language.
import { getLocale, getTranslations } from "next-intl/server";
import { formatDay, formatMonthYear } from "@/lib/dates";
import { formatPaise } from "@/lib/money";
import { todayInIndia } from "@/shared/tracker";
import { getCompany } from "./config";
import type { getAgentInvoice } from "./invoices";
import type { getPayment } from "./payments";
import { renderPdf } from "./pdf";

const day = (d: Date, locale: string) => formatDay(todayInIndia(d), locale);

async function setup() {
  const [locale, t, company] = await Promise.all([getLocale(), getTranslations("invoicePdf"), getCompany()]);
  const lines = [company.cin && `CIN ${company.cin}`, company.address, ...company.registrations].filter(Boolean) as string[];
  return { locale, t, company: { name: company.name, lines } };
}

export async function memberInvoicePdf(p: Awaited<ReturnType<typeof getPayment>>) {
  const { locale, t, company } = await setup();
  const e = p.installment.enrolment;
  const scheme = e.batch.scheme;
  const month = formatMonthYear(p.installment.dueDate.toISOString().slice(0, 10), locale);
  const method = p.method === "CASH" ? t("cash", { agent: p.collectedBy?.name ?? "" }) : p.provider === "TEST" ? t("testPayment") : t("online");

  return renderPdf({
    company,
    title: t("memberTitle"),
    meta: [p.invoiceNo!, t("date", { day: day(p.paidAt!, locale) })],
    stamp: { text: t("paid"), tone: "paid" },
    blocks: [
      {
        kind: "kv",
        rows: [
          [t("billedTo"), p.member.name],
          [t("phone"), p.member.phone],
          [t("token"), e.tokenNumber],
          [t("scheme"), locale === "hi" ? scheme.nameHi : scheme.nameEn],
        ],
      },
      {
        kind: "table",
        head: [t("description"), t("amount")],
        widths: [380, 119],
        right: [false, true],
        rows: [[t("installmentLine", { n: p.installment.monthNo, total: scheme.tenureMonths, month }), formatPaise(p.amount)]],
      },
      { kind: "totals", rows: [[t("total"), formatPaise(p.amount), true]] },
      { kind: "kv", rows: [[t("paidBy"), method], [t("orderId"), p.orderId], ...(p.gatewayPaymentId ? [[t("reference"), p.gatewayPaymentId] as [string, string]] : [])] },
      ...(p.provider === "TEST" ? [{ kind: "note" as const, text: t("testNote"), tone: "warn" as const }] : []),
    ],
    footer: t("footer"),
  });
}

export async function agentInvoicePdf(inv: Awaited<ReturnType<typeof getAgentInvoice>>) {
  const { locale, t, company } = await setup();
  const profile = inv.agent.agentProfile;
  const stamp =
    inv.status === "PAID"
      ? { text: t("paid"), tone: "paid" as const }
      : inv.status === "CANCELLED"
        ? { text: t("cancelled"), tone: "void" as const }
        : { text: t("unpaid"), tone: "warn" as const };

  return renderPdf({
    company,
    title: t("agentTitle"),
    meta: [inv.number, t("date", { day: day(inv.createdAt, locale) }), t("period", { month: formatMonthYear(`${inv.period}-01`, locale) })],
    stamp,
    blocks: [
      {
        kind: "kv",
        rows: [
          [t("agent"), inv.agent.name],
          [t("phone"), inv.agent.phone],
          ...(profile ? [[t("panchayat"), profile.panchayat] as [string, string]] : []),
          ...(profile?.pan ? [[t("pan"), profile.pan] as [string, string]] : []),
        ],
      },
      {
        kind: "table",
        head: [t("paidOn"), t("member"), t("token"), t("month"), t("commission")],
        widths: [80, 140, 110, 95, 74],
        right: [false, false, false, false, true],
        rows: inv.commissions.map((c) => {
          const p = c.payment;
          return [
            p?.paidAt ? day(p.paidAt, locale) : "",
            p?.member.name ?? "",
            p?.installment.enrolment.tokenNumber ?? "",
            p ? formatMonthYear(p.installment.dueDate.toISOString().slice(0, 10), locale) : "",
            formatPaise(c.amount),
          ];
        }),
      },
      {
        kind: "totals",
        rows: [
          [t("gross"), formatPaise(inv.gross)],
          [t("tds", { percent: inv.tdsBps / 100 }), `− ${formatPaise(inv.tds)}`],
          [t("net"), formatPaise(inv.net), true],
        ],
      },
      ...(inv.status === "PAID" ? [{ kind: "kv" as const, rows: [[t("paidOnDate"), day(inv.paidAt!, locale)], [t("utr"), inv.utr ?? ""]] as [string, string][] }] : []),
    ],
    footer: t("footer"),
  });
}
