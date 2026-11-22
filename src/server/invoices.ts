// Invoices: one per counted member payment (numbered in payments.ts), and monthly agent commission invoices
// that the super admin creates, marks paid or cancels.
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import type { SessionUser } from "@/shared/auth";
import { tdsFor } from "@/shared/commission";
import { invoicePeriodInput, markPaidInput } from "@/shared/invoices";
import { todayInIndia } from "@/shared/tracker";
import { audit } from "./audit";
import { requireRole } from "./auth";
import { getConfigInt } from "./config";
import { AppError } from "./errors";

type Tx = Prisma.TransactionClient;
const SUPER = ["SUPER_ADMIN"] as const;

/** Indian financial year (April–March) of a moment, e.g. "2026-27". */
export function financialYear(d: Date): string {
  const [y, m] = todayInIndia(d).split("-").map(Number);
  const start = m >= 4 ? y : y - 1;
  return `${start}-${String((start + 1) % 100).padStart(2, "0")}`;
}

/** Next number in a series. Inside the caller's transaction, so a rolled-back invoice doesn't leave a gap. */
async function nextNumber(tx: Tx, series: string): Promise<number> {
  const [row] = await tx.$queryRaw<{ last: number }[]>`
    insert into "InvoiceCounter" (series, last) values (${series}, 1)
    on conflict (series) do update set last = "InvoiceCounter".last + 1
    returning last`;
  return row.last;
}

/** SM/2026-27/000123 */
export async function nextMemberInvoiceNo(tx: Tx, at: Date) {
  const fy = financialYear(at);
  return `SM/${fy}/${String(await nextNumber(tx, `M/${fy}`)).padStart(6, "0")}`;
}

/** UTC moment when an Indian calendar month ends ("2026-11" → 1 Dec 2026 00:00 IST). */
const periodEnd = (period: string) => {
  const [y, m] = period.split("-").map(Number);
  return new Date(Date.UTC(y, m, 1) - 330 * 60_000);
};

/**
 * Creates one invoice per agent for `period` ("YYYY-MM", a month that has ended), covering every earned,
 * not-yet-invoiced commission up to the end of that month. Agents who already have a live invoice for the
 * period are skipped; anything earned later goes on their next invoice.
 */
export async function createAgentInvoices(user: SessionUser | null, input: unknown) {
  const admin = requireRole(user, SUPER);
  const { period } = invoicePeriodInput.parse(input);
  if (period >= todayInIndia().slice(0, 7)) throw new AppError("PERIOD_NOT_OVER", "Invoices can only be created for a month that has ended", 409);
  const tdsBps = await getConfigInt("tdsBps", 200);

  return db.$transaction(async (tx) => {
    // One invoice run at a time, so two admins can't invoice the same commission twice.
    await tx.$executeRaw`select pg_advisory_xact_lock(hashtext('agent-invoices'))`;
    const open = await tx.commission.findMany({
      where: { invoiceId: null, status: "EARNED", ruleMissing: false, amount: { gt: 0 }, createdAt: { lt: periodEnd(period) } },
      select: { id: true, agentId: true, amount: true },
    });
    const done = new Set(
      (await tx.agentInvoice.findMany({ where: { period, status: { not: "CANCELLED" } }, select: { agentId: true } })).map((i) => i.agentId),
    );
    const byAgent = new Map<string, typeof open>();
    for (const c of open) if (!done.has(c.agentId)) byAgent.set(c.agentId, [...(byAgent.get(c.agentId) ?? []), c]);

    const fy = financialYear(new Date());
    const created = [];
    for (const [agentId, lines] of byAgent) {
      const gross = lines.reduce((t, l) => t + l.amount, 0);
      const tds = tdsFor(gross, tdsBps);
      const number = `SMC/${fy}/${String(await nextNumber(tx, `A/${fy}`)).padStart(4, "0")}`;
      const invoice = await tx.agentInvoice.create({ data: { number, agentId, period, gross, tdsBps, tds, net: gross - tds, createdById: admin.id } });
      await tx.commission.updateMany({ where: { id: { in: lines.map((l) => l.id) } }, data: { invoiceId: invoice.id } });
      await audit(tx, admin.id, "agentInvoice.create", "AgentInvoice", invoice.id, { number, period, gross, tds, lines: lines.length });
      created.push(invoice);
    }
    return created;
  });
}

export async function markAgentInvoicePaid(user: SessionUser | null, id: string, input: unknown) {
  const admin = requireRole(user, SUPER);
  const { utr } = markPaidInput.parse(input);
  return db.$transaction(async (tx) => {
    await tx.$queryRaw`select id from "AgentInvoice" where id = ${id} for update`;
    const inv = await tx.agentInvoice.findUniqueOrThrow({ where: { id } });
    if (inv.status !== "ISSUED") throw new AppError("INVOICE_NOT_ISSUED", "Only an issued invoice can be marked paid", 409);
    const paid = await tx.agentInvoice.update({ where: { id }, data: { status: "PAID", paidAt: new Date(), utr } });
    await tx.commission.updateMany({ where: { invoiceId: id }, data: { status: "PAID" } });
    await audit(tx, admin.id, "agentInvoice.paid", "AgentInvoice", id, { utr, net: inv.net });
    return paid;
  });
}

/** Cancels an unpaid invoice; its commission lines become available for the next invoice. */
export async function cancelAgentInvoice(user: SessionUser | null, id: string) {
  const admin = requireRole(user, SUPER);
  return db.$transaction(async (tx) => {
    await tx.$queryRaw`select id from "AgentInvoice" where id = ${id} for update`;
    const inv = await tx.agentInvoice.findUniqueOrThrow({ where: { id } });
    if (inv.status !== "ISSUED") throw new AppError("INVOICE_NOT_ISSUED", "Only an unpaid invoice can be cancelled", 409);
    await tx.commission.updateMany({ where: { invoiceId: id }, data: { invoiceId: null } });
    const cancelled = await tx.agentInvoice.update({ where: { id }, data: { status: "CANCELLED", cancelledAt: new Date() } });
    await audit(tx, admin.id, "agentInvoice.cancel", "AgentInvoice", id, { number: inv.number });
    return cancelled;
  });
}

const invoiceInclude = {
  agent: { select: { name: true, phone: true, agentProfile: { select: { panchayat: true, pan: true } } } },
  commissions: {
    include: {
      payment: {
        select: {
          paidAt: true,
          member: { select: { name: true } },
          installment: { select: { monthNo: true, dueDate: true, enrolment: { select: { tokenNumber: true } } } },
        },
      },
    },
    orderBy: { createdAt: "asc" },
  },
} satisfies Prisma.AgentInvoiceInclude;

/** One agent invoice with its lines. The super admin sees any; an agent sees their own. */
export async function getAgentInvoice(user: SessionUser | null, id: string) {
  const u = requireRole(user, ["AGENT", ...SUPER]);
  const inv = await db.agentInvoice.findFirst({ where: { id, ...(u.role === "AGENT" ? { agentId: u.id } : {}) }, include: invoiceInclude });
  if (!inv) throw new AppError("NOT_FOUND", "Not found", 404);
  return inv;
}

export async function listMyInvoices(user: SessionUser | null) {
  const agent = requireRole(user, ["AGENT"]);
  return db.agentInvoice.findMany({ where: { agentId: agent.id, status: { not: "CANCELLED" } }, orderBy: { createdAt: "desc" } });
}

/** Everything the super admin's Invoices screen needs. `q` searches member invoices. */
export async function invoiceOverview(user: SessionUser | null, q?: string) {
  requireRole(user, SUPER);
  const search = q?.trim();
  const [agentInvoices, uninvoiced, awaitingRate, memberInvoices] = await Promise.all([
    db.agentInvoice.findMany({ include: { agent: { select: { name: true } } }, orderBy: { createdAt: "desc" }, take: 100 }),
    db.commission.aggregate({ where: { invoiceId: null, status: "EARNED", ruleMissing: false }, _sum: { amount: true }, _count: true }),
    db.commission.count({ where: { ruleMissing: true } }),
    db.payment.findMany({
      where: {
        invoiceNo: { not: null },
        ...(search && {
          OR: [
            { invoiceNo: { contains: search, mode: "insensitive" } },
            { member: { phone: { contains: search } } },
            { member: { name: { contains: search, mode: "insensitive" } } },
            { installment: { enrolment: { tokenNumber: { contains: search, mode: "insensitive" } } } },
          ],
        }),
      },
      include: { member: { select: { name: true } }, installment: { select: { enrolment: { select: { tokenNumber: true } } } } },
      orderBy: { paidAt: "desc" },
      take: 50,
    }),
  ]);
  return { agentInvoices, uninvoicedTotal: uninvoiced._sum.amount ?? 0, uninvoicedCount: uninvoiced._count, awaitingRate, memberInvoices };
}
