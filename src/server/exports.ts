// Super admin CSV exports for accounts and records: enrolments, payments, commission, agents.
// Column names are English (accounting files); names and places stay as entered. Amounts are plain rupees.
import { toCsv } from "@/lib/csv";
import { db } from "@/lib/db";
import type { SessionUser } from "@/shared/auth";
import { exportInput } from "@/shared/exports";
import { todayInIndia } from "@/shared/tracker";
import { requireRole } from "./auth";

const rupees = (paise: number) => (paise / 100).toFixed(2);
const day = (d: Date | null | undefined) => (d ? todayInIndia(d) : "");
const month = (d: Date) => d.toISOString().slice(0, 7);

/** [from, to) as instants for India dates; default this month. */
function range(from: string | undefined, to: string | undefined) {
  const today = todayInIndia();
  const f = from ?? `${today.slice(0, 8)}01`;
  const t = to ?? today;
  return { f, t, gte: new Date(`${f}T00:00:00+05:30`), lt: new Date(new Date(`${t}T00:00:00+05:30`).getTime() + 864e5) };
}

// shortcut: each export builds the whole file in memory; fine for tens of thousands of rows, stream it beyond that.
export async function exportCsv(user: SessionUser | null, input: unknown) {
  requireRole(user, ["SUPER_ADMIN"]);
  const { kind, from, to } = exportInput.parse(input);
  const r = range(from, to);

  switch (kind) {
    case "enrolments": {
      const rows = await db.enrolment.findMany({
        include: {
          batch: { include: { scheme: true } },
          member: { include: { memberProfile: true } },
          agent: { select: { name: true, phone: true } },
          installments: { select: { status: true, amount: true } },
        },
        orderBy: { tokenNumber: "asc" },
      });
      return {
        name: `enrolments-${todayInIndia()}`,
        csv: toCsv([
          ["Token", "Scheme", "Batch start", "Member", "Phone", "Village", "Address", "Nominee", "Agent", "Agent phone", "Status", "Joined", "Months paid", "Paid (Rs)", "Months waived"],
          ...rows.map((e) => {
            const paid = e.installments.filter((i) => i.status === "PAID");
            return [
              e.tokenNumber,
              e.batch.scheme.nameEn,
              month(e.batch.startMonth),
              e.member.name,
              e.member.phone,
              e.member.memberProfile?.village,
              e.member.memberProfile?.address,
              e.member.memberProfile?.nominee,
              e.agent?.name ?? "Joined directly",
              e.agent?.phone,
              e.status,
              day(e.createdAt),
              paid.length,
              rupees(paid.reduce((t, i) => t + i.amount, 0)),
              e.installments.filter((i) => i.status === "WAIVED").length,
            ];
          }),
        ]),
      };
    }
    case "payments": {
      // Money received in the range (by the day it counted), plus anything still open that was started in it.
      const rows = await db.payment.findMany({
        where: { OR: [{ paidAt: { gte: r.gte, lt: r.lt } }, { paidAt: null, createdAt: { gte: r.gte, lt: r.lt } }] },
        include: {
          member: { select: { name: true, phone: true } },
          collectedBy: { select: { name: true } },
          verifiedBy: { select: { name: true } },
          installment: { select: { dueDate: true, enrolment: { select: { tokenNumber: true } } } },
        },
        orderBy: { createdAt: "asc" },
      });
      return {
        name: `payments-${r.f}-to-${r.t}`,
        csv: toCsv([
          ["Date", "Invoice", "Member", "Phone", "Token", "Month", "Amount (Rs)", "Method", "Provider", "Status", "Order", "Gateway payment", "Cash collected by", "Checked by"],
          ...rows.map((p) => [
            day(p.paidAt ?? p.createdAt),
            p.invoiceNo,
            p.member.name,
            p.member.phone,
            p.installment.enrolment.tokenNumber,
            month(p.installment.dueDate),
            rupees(p.amount),
            p.method,
            p.provider,
            p.status,
            p.orderId,
            p.gatewayPaymentId,
            p.collectedBy?.name,
            p.verifiedBy?.name,
          ]),
        ]),
      };
    }
    case "commission": {
      const rows = await db.commission.findMany({
        where: { createdAt: { gte: r.gte, lt: r.lt } },
        include: {
          agent: { select: { name: true, phone: true } },
          invoice: { select: { number: true } },
          payment: { select: { member: { select: { name: true } }, installment: { select: { dueDate: true, enrolment: { select: { tokenNumber: true } } } } } },
        },
        orderBy: { createdAt: "asc" },
      });
      return {
        name: `commission-${r.f}-to-${r.t}`,
        csv: toCsv([
          ["Date", "Agent", "Agent phone", "Type", "Member or campaign", "Token", "Month", "Amount (Rs)", "Rate pending", "Status", "Invoice"],
          ...rows.map((c) => [
            day(c.createdAt),
            c.agent.name,
            c.agent.phone,
            c.type,
            c.type === "BONUS" ? c.campaign : c.payment?.member.name,
            c.payment?.installment.enrolment.tokenNumber,
            c.payment ? month(c.payment.installment.dueDate) : "",
            rupees(c.amount),
            c.ruleMissing ? "yes" : "",
            c.status,
            c.invoice?.number,
          ]),
        ]),
      };
    }
    case "agents": {
      const rows = await db.user.findMany({
        where: { role: "AGENT" },
        include: { agentProfile: true, _count: { select: { agentEnrolments: true } } },
        orderBy: { name: "asc" },
      });
      return {
        name: `agents-${todayInIndia()}`,
        csv: toCsv([
          ["Name", "Phone", "Panchayat", "PAN", "Approved", "Account", "Enrolments", "Joined"],
          ...rows.map((a) => [a.name, a.phone, a.agentProfile?.panchayat, a.agentProfile?.pan, a.agentProfile?.approved ? "yes" : "no", a.status, a._count.agentEnrolments, day(a.createdAt)]),
        ]),
      };
    }
  }
}
