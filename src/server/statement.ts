// An agent's statement: every commission line and every payout (paid invoice), as CSV for the agent or the office.
// Labels come from messages/*.json (namespace "statement") in the viewer's language.
import { getLocale, getTranslations } from "next-intl/server";
import { formatMonthYear } from "@/lib/dates";
import { toCsv } from "@/lib/csv";
import { db } from "@/lib/db";
import type { SessionUser } from "@/shared/auth";
import { todayInIndia } from "@/shared/tracker";
import { requireRole } from "./auth";
import { AppError } from "./errors";

/** Paise as a plain rupee number for spreadsheets: 123450 → "1234.50". */
const rupees = (paise: number) => (paise / 100).toFixed(2);

/** The agent's own statement, or any agent's for the super admin. */
export async function agentStatementCsv(user: SessionUser | null, agentId?: string) {
  const u = requireRole(user, ["AGENT", "SUPER_ADMIN"]);
  const id = u.role === "AGENT" ? u.id : agentId;
  const agent = id ? await db.user.findFirst({ where: { id, role: "AGENT" } }) : null;
  if (!agent) throw new AppError("NOT_FOUND", "Not found", 404);

  // shortcut: the whole history in one file; add a date range when an agent has tens of thousands of lines.
  const [lines, payouts, locale, t] = await Promise.all([
    db.commission.findMany({
      where: { agentId: agent.id },
      include: {
        invoice: { select: { number: true } },
        payment: { select: { member: { select: { name: true } }, installment: { select: { dueDate: true, enrolment: { select: { tokenNumber: true } } } } } },
      },
      orderBy: { createdAt: "asc" },
    }),
    db.agentInvoice.findMany({ where: { agentId: agent.id, status: "PAID" }, orderBy: { paidAt: "asc" } }),
    getLocale(),
    getTranslations("statement"),
  ]);

  type Row = { at: Date; cells: (string | number | null)[] };
  const rows: Row[] = [
    ...lines.map((c) => ({
      at: c.createdAt,
      cells: [
        todayInIndia(c.createdAt),
        c.type === "BONUS" ? t("bonus") : t("commission"),
        c.type === "BONUS" ? (c.campaign ?? "") : (c.payment?.member.name ?? ""),
        c.payment?.installment.enrolment.tokenNumber ?? "",
        c.payment ? formatMonthYear(c.payment.installment.dueDate.toISOString().slice(0, 10), locale) : "",
        rupees(c.amount),
        c.invoice?.number ?? "",
        "",
        "",
        "",
        "",
        c.ruleMissing ? t("rateMissing") : t(`status.${c.status}`),
      ],
    })),
    ...payouts.map((i) => ({
      at: i.paidAt!,
      cells: [todayInIndia(i.paidAt!), t("payout"), "", "", formatMonthYear(`${i.period}-01`, locale), "", i.number, rupees(i.gross), rupees(i.tds), rupees(i.net), i.utr ?? "", t("status.PAID")],
    })),
  ].sort((a, b) => a.at.getTime() - b.at.getTime());

  const head = ["date", "type", "member", "token", "month", "commission", "invoice", "gross", "tds", "net", "utr", "status"].map((k) => t(`col.${k}`));
  return { name: `statement-${agent.phone}-${todayInIndia()}`, csv: toCsv([head, ...rows.map((r) => r.cells)]) };
}
