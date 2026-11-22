// The admin home: what needs doing now, and (super admin only) where the money stands. Everything is counted from rows.
import { db } from "@/lib/db";
import { adminRoles, type SessionUser } from "@/shared/auth";
import { todayInIndia } from "@/shared/tracker";
import { requireRole } from "./auth";
import { listDrawBatches } from "./draws";

const sum = (r: { _sum: { amount: number | null } }) => r._sum.amount ?? 0;

export async function adminOverview(user: SessionUser | null) {
  const u = requireRole(user, adminRoles);
  const today = todayInIndia();
  const monthStart = new Date(`${today.slice(0, 8)}01T00:00:00+05:30`);

  const [members, enrolments, pendingCash, dueNow, overdue, fulfilment, agentsWaiting, batches] = await Promise.all([
    db.user.count({ where: { role: "MEMBER" } }),
    db.enrolment.groupBy({ by: ["status"], _count: true }),
    db.payment.aggregate({ where: { method: "CASH", status: "PENDING" }, _count: true, _sum: { amount: true } }),
    db.installment.aggregate({
      where: { status: { in: ["DUE", "OVERDUE"] }, dueDate: { lte: new Date(today) }, payments: { none: { status: "PENDING" } } },
      _count: true,
      _sum: { amount: true },
    }),
    db.installment.count({ where: { status: "OVERDUE" } }),
    db.fulfilment.groupBy({ by: ["status"], _count: true }),
    db.agentProfile.count({ where: { approved: false, user: { status: "ACTIVE" } } }),
    listDrawBatches(u),
  ]);
  const byStatus = Object.fromEntries(enrolments.map((e) => [e.status, e._count])) as Record<string, number>;
  const fulfilmentBy = Object.fromEntries(fulfilment.map((f) => [f.status, f._count])) as Record<string, number>;

  const ops = {
    members,
    enrolments: { ACTIVE: byStatus.ACTIVE ?? 0, MATURED: byStatus.MATURED ?? 0, WON: byStatus.WON ?? 0, DEFAULTED: byStatus.DEFAULTED ?? 0 },
    pendingCash: { count: pendingCash._count, amount: sum(pendingCash) },
    dueNow: { count: dueNow._count, amount: sum(dueNow) },
    overdueMonths: overdue,
    toAllocate: fulfilmentBy.CONFIRMED ?? 0,
    toDeliver: fulfilmentBy.ALLOCATED ?? 0,
    drawsReady: batches.filter((b) => b.canRun).length,
    agentsWaiting,
  };
  if (u.role !== "SUPER_ADMIN") return { ...ops, money: null };

  const [collectedMonth, collectedAll, unpaidCommission, unpaidInvoices] = await Promise.all([
    db.payment.aggregate({ where: { status: "SUCCESS", paidAt: { gte: monthStart } }, _sum: { amount: true } }),
    db.payment.aggregate({ where: { status: "SUCCESS" }, _sum: { amount: true } }),
    db.commission.aggregate({ where: { status: "EARNED", invoiceId: null }, _sum: { amount: true } }),
    db.agentInvoice.aggregate({ where: { status: "ISSUED" }, _sum: { net: true }, _count: true }),
  ]);
  return {
    ...ops,
    money: {
      collectedMonth: sum(collectedMonth),
      collectedAll: sum(collectedAll),
      commissionNotInvoiced: sum(unpaidCommission),
      invoicesUnpaid: { count: unpaidInvoices._count, net: unpaidInvoices._sum.net ?? 0 },
    },
  };
}
