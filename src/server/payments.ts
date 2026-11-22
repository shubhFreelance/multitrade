// Online installment payments. The provider (test simulator now, Cashfree later) only collects the money;
// `confirmPayment` is the one place that marks money as received.
import { randomBytes } from "node:crypto";
import { db } from "@/lib/db";
import { adminRoles, type SessionUser } from "@/shared/auth";
import { requireRole } from "./auth";
import { AppError } from "./errors";

export type PaymentProvider = "TEST" | "CASHFREE";

/** Set by PAYMENT_PROVIDER in the environment. Unset means online payment is switched off. */
export function paymentProvider(): PaymentProvider | null {
  const p = process.env.PAYMENT_PROVIDER?.trim().toLowerCase();
  return p === "test" ? "TEST" : p === "cashfree" ? "CASHFREE" : null;
}

// shortcut: only the test provider exists; wire Cashfree (create order, redirect, webhook calling confirmPayment) when the client sends sandbox keys.
export const canPayOnline = () => paymentProvider() === "TEST";

/** Member starts paying one installment: creates the order and returns where to send them. */
export async function startPayment(user: SessionUser | null, installmentId: string) {
  const member = requireRole(user, ["MEMBER"]);
  if (!canPayOnline()) throw new AppError("PAYMENTS_DISABLED", "Online payment is not available yet", 503);

  const inst = await db.installment.findFirst({ where: { id: installmentId, enrolment: { memberId: member.id } } });
  if (!inst) throw new AppError("NOT_FOUND", "Not found", 404);
  if (inst.status === "PAID" || inst.status === "WAIVED") throw new AppError("ALREADY_PAID", "This installment is already paid", 409);
  const oldest = await db.installment.findFirst({
    where: { enrolmentId: inst.enrolmentId, status: { in: ["DUE", "OVERDUE"] } },
    orderBy: { monthNo: "asc" },
  });
  if (oldest?.id !== inst.id) throw new AppError("PAY_OLDEST_FIRST", "Pay the oldest unpaid month first", 409);

  const payment = await db.payment.create({
    data: {
      installmentId,
      memberId: member.id,
      method: "ONLINE",
      provider: "TEST",
      amount: inst.amount,
      orderId: `SM-${Date.now().toString(36).toUpperCase()}-${randomBytes(3).toString("hex").toUpperCase()}`,
    },
  });
  return { paymentId: payment.id, orderId: payment.orderId, checkoutUrl: `/member/pay/${payment.id}` };
}

type Outcome = { status: "SUCCESS" | "FAILED"; gatewayPaymentId: string; amount: number };

/**
 * Records the gateway's verdict on an order. Safe to call any number of times (webhook retries):
 * only the first call for an order changes anything.
 */
export async function confirmPayment(orderId: string, outcome: Outcome) {
  return db.$transaction(async (tx) => {
    // Lock the order so two deliveries of the same webhook can't both settle it.
    await tx.$queryRaw`select id from "Payment" where "orderId" = ${orderId} for update`;
    const p = await tx.payment.findUnique({ where: { orderId } });
    if (!p) throw new AppError("NOT_FOUND", "Unknown order", 404);
    if (p.status !== "CREATED") return p;

    if (outcome.status === "FAILED") {
      return tx.payment.update({ where: { id: p.id }, data: { status: "FAILED", gatewayPaymentId: outcome.gatewayPaymentId } });
    }
    if (outcome.amount !== p.amount) {
      console.error(`Payment ${orderId}: gateway says ${outcome.amount} paise, order is ${p.amount}`);
      throw new AppError("AMOUNT_MISMATCH", "Paid amount does not match the order", 400);
    }

    await tx.$queryRaw`select id from "Installment" where id = ${p.installmentId} for update`;
    const inst = await tx.installment.findUniqueOrThrow({ where: { id: p.installmentId }, include: { enrolment: true } });
    // Money for an installment that another order already paid: keep the record, flag it for refund.
    const alreadyPaid = inst.status === "PAID" || inst.status === "WAIVED";
    const settled = await tx.payment.update({
      where: { id: p.id },
      data: { status: alreadyPaid ? "DUPLICATE" : "SUCCESS", gatewayPaymentId: outcome.gatewayPaymentId, paidAt: new Date() },
    });
    if (alreadyPaid) return settled;

    await tx.installment.update({ where: { id: inst.id }, data: { status: "PAID" } });
    const unpaid = await tx.installment.count({ where: { enrolmentId: inst.enrolmentId, status: { in: ["DUE", "OVERDUE"] } } });
    if (unpaid === 0 && inst.enrolment.status === "ACTIVE") {
      await tx.enrolment.update({ where: { id: inst.enrolmentId }, data: { status: "MATURED" } });
    }
    return settled;
  });
}

/** Test provider only: the member plays the gateway and decides how the payment ends. */
export async function simulateTestPayment(user: SessionUser | null, paymentId: string, status: "SUCCESS" | "FAILED") {
  const member = requireRole(user, ["MEMBER"]);
  if (paymentProvider() !== "TEST") throw new AppError("PAYMENTS_DISABLED", "Test payments are switched off", 503);
  const p = await db.payment.findFirst({ where: { id: paymentId, memberId: member.id, provider: "TEST" } });
  if (!p) throw new AppError("NOT_FOUND", "Not found", 404);
  return confirmPayment(p.orderId, { status, gatewayPaymentId: `TEST-${randomBytes(6).toString("hex").toUpperCase()}`, amount: p.amount });
}

/** A payment with what a receipt needs. Members see their own; agents those of members they enrolled; admins all. */
export async function getPayment(user: SessionUser | null, paymentId: string) {
  const u = requireRole(user, ["MEMBER", "AGENT", ...adminRoles]);
  const scope = u.role === "MEMBER" ? { memberId: u.id } : u.role === "AGENT" ? { installment: { enrolment: { agentId: u.id } } } : {};
  const p = await db.payment.findFirst({
    where: { id: paymentId, ...scope },
    include: {
      member: { select: { name: true, phone: true } },
      installment: { include: { enrolment: { include: { batch: { include: { scheme: true } } } } } },
    },
  });
  if (!p) throw new AppError("NOT_FOUND", "Not found", 404);
  return p;
}
