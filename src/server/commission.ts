// What agents have earned. Commission rows are created by payments.ts when a payment is counted.
import { db } from "@/lib/db";
import type { SessionUser } from "@/shared/auth";
import { requireRole } from "./auth";

/** The signed-in agent's commission lines (newest first) and totals in paise. */
export async function listMyCommission(user: SessionUser | null) {
  const agent = requireRole(user, ["AGENT"]);
  // shortcut: loads every line; fine for a few thousand per agent, paginate beyond that.
  const lines = await db.commission.findMany({
    where: { agentId: agent.id },
    include: {
      payment: {
        select: {
          paidAt: true,
          method: true,
          member: { select: { name: true } },
          installment: { select: { monthNo: true, dueDate: true, enrolment: { select: { tokenNumber: true } } } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });
  const sum = (status: string) => lines.filter((l) => l.status === status).reduce((t, l) => t + l.amount, 0);
  return {
    lines,
    earned: sum("EARNED"), // not paid out yet, before TDS
    paid: sum("PAID"), // commission settled by paid invoices, before TDS
    awaitingRate: lines.filter((l) => l.ruleMissing).length, // Upahar payments waiting for the tier table
  };
}
