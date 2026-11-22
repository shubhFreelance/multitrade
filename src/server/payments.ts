// Installment payments, online and cash. Providers and agents only collect money;
// `settleSuccess` is the one place that counts money as received.
import { randomBytes } from "node:crypto";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { adminRoles, type SessionUser } from "@/shared/auth";
import { commissionFor } from "@/shared/commission";
import { audit } from "./audit";
import { requireRole } from "./auth";
import { AppError } from "./errors";
import { sendQueuedSmsSafely, startCompletion } from "./completion";
import { nextMemberInvoiceNo } from "./invoices";

type Tx = Prisma.TransactionClient;
export type PaymentProvider = "TEST" | "CASHFREE";

/** Set by PAYMENT_PROVIDER in the environment. Unset means online payment is switched off. */
export function paymentProvider(): PaymentProvider | null {
  const p = process.env.PAYMENT_PROVIDER?.trim().toLowerCase();
  return p === "test" ? "TEST" : p === "cashfree" ? "CASHFREE" : null;
}

// shortcut: only the test provider exists; wire Cashfree (create order, redirect, webhook calling confirmPayment) when the client sends sandbox keys.
export const canPayOnline = () => paymentProvider() === "TEST";

const newOrderId = (prefix: string) => `${prefix}-${Date.now().toString(36).toUpperCase()}-${randomBytes(3).toString("hex").toUpperCase()}`;

/**
 * Checks this installment is the one to pay next: not paid, and the oldest month that is neither paid
 * nor already covered by cash awaiting verification.
 */
async function checkPayable(client: Tx, installmentId: string, enrolmentId: string, status: string) {
  if (status === "PAID" || status === "WAIVED") throw new AppError("ALREADY_PAID", "This installment is already paid", 409);
  const pending = await client.payment.findFirst({ where: { installmentId, status: "PENDING" } });
  if (pending) throw new AppError("CASH_PENDING", "Cash for this month is waiting for the office to verify it", 409);
  const oldest = await client.installment.findFirst({
    where: { enrolmentId, status: { in: ["DUE", "OVERDUE"] }, payments: { none: { status: "PENDING" } } },
    orderBy: { monthNo: "asc" },
  });
  if (oldest?.id !== installmentId) throw new AppError("PAY_OLDEST_FIRST", "Pay the oldest unpaid month first", 409);
}

/**
 * Counts a received payment: the installment becomes PAID, the enrolling agent earns commission,
 * and the enrolment becomes MATURED after its last month.
 * Money for a month that is already paid is kept as DUPLICATE for the office to refund.
 * The caller must hold the payment row lock inside `tx`.
 */
async function settleSuccess(tx: Tx, paymentId: string, data: Prisma.PaymentUpdateInput) {
  const p = await tx.payment.findUniqueOrThrow({ where: { id: paymentId } });
  await tx.$queryRaw`select id from "Installment" where id = ${p.installmentId} for update`;
  const inst = await tx.installment.findUniqueOrThrow({
    where: { id: p.installmentId },
    include: { enrolment: { include: { batch: { include: { scheme: true } } } } },
  });
  const alreadyPaid = inst.status === "PAID" || inst.status === "WAIVED";
  const paidAt = new Date();
  const settled = await tx.payment.update({
    where: { id: p.id },
    data: {
      ...data,
      status: alreadyPaid ? "DUPLICATE" : "SUCCESS",
      paidAt,
      invoiceNo: alreadyPaid ? null : await nextMemberInvoiceNo(tx, paidAt),
    },
  });
  if (alreadyPaid) return settled;

  await tx.installment.update({ where: { id: inst.id }, data: { status: "PAID" } });
  const { amount, ruleMissing } = commissionFor(inst.enrolment.batch.scheme.commissionRule, p.amount);
  // Members who joined directly have no agent, so nobody earns commission.
  if (inst.enrolment.agentId) await tx.commission.create({ data: { agentId: inst.enrolment.agentId, paymentId: p.id, amount, ruleMissing } });
  const unpaid = await tx.installment.count({ where: { enrolmentId: inst.enrolmentId, status: { in: ["DUE", "OVERDUE"] } } });
  if (unpaid === 0 && inst.enrolment.status === "ACTIVE") {
    await tx.enrolment.update({ where: { id: inst.enrolmentId }, data: { status: "MATURED" } });
    await startCompletion(tx, inst.enrolmentId, "MATURED");
  }
  return settled;
}

// ---- Online ----

/** Member starts paying one installment online: creates the order and returns where to send them. */
export async function startPayment(user: SessionUser | null, installmentId: string) {
  const member = requireRole(user, ["MEMBER"]);
  if (!canPayOnline()) throw new AppError("PAYMENTS_DISABLED", "Online payment is not available yet", 503);

  const inst = await db.installment.findFirst({ where: { id: installmentId, enrolment: { memberId: member.id } } });
  if (!inst) throw new AppError("NOT_FOUND", "Not found", 404);
  await checkPayable(db, inst.id, inst.enrolmentId, inst.status);

  const payment = await db.payment.create({
    data: { installmentId, memberId: member.id, method: "ONLINE", provider: "TEST", amount: inst.amount, orderId: newOrderId("SM") },
  });
  return { paymentId: payment.id, orderId: payment.orderId, checkoutUrl: `/member/pay/${payment.id}` };
}

type Outcome = { status: "SUCCESS" | "FAILED"; gatewayPaymentId: string; amount: number };

/**
 * Records the gateway's verdict on an online order. Safe to call any number of times (webhook retries):
 * only the first call for an order changes anything.
 */
export async function confirmPayment(orderId: string, outcome: Outcome) {
  const result = await db.$transaction(async (tx) => {
    // Lock the order so two deliveries of the same webhook can't both settle it.
    await tx.$queryRaw`select id from "Payment" where "orderId" = ${orderId} for update`;
    const p = await tx.payment.findUnique({ where: { orderId } });
    if (!p || p.method !== "ONLINE") throw new AppError("NOT_FOUND", "Unknown order", 404);
    if (p.status !== "CREATED") return p;

    if (outcome.status === "FAILED") {
      return tx.payment.update({ where: { id: p.id }, data: { status: "FAILED", gatewayPaymentId: outcome.gatewayPaymentId } });
    }
    if (outcome.amount !== p.amount) {
      console.error(`Payment ${orderId}: gateway says ${outcome.amount} paise, order is ${p.amount}`);
      throw new AppError("AMOUNT_MISMATCH", "Paid amount does not match the order", 400);
    }
    return settleSuccess(tx, p.id, { gatewayPaymentId: outcome.gatewayPaymentId });
  });
  await sendQueuedSmsSafely(); // e.g. the "all paid" SMS, only once the payment is saved
  return result;
}

/** Test provider only: the member plays the gateway and decides how the payment ends. */
export async function simulateTestPayment(user: SessionUser | null, paymentId: string, status: "SUCCESS" | "FAILED") {
  const member = requireRole(user, ["MEMBER"]);
  if (paymentProvider() !== "TEST") throw new AppError("PAYMENTS_DISABLED", "Test payments are switched off", 503);
  const p = await db.payment.findFirst({ where: { id: paymentId, memberId: member.id, provider: "TEST" } });
  if (!p) throw new AppError("NOT_FOUND", "Not found", 404);
  return confirmPayment(p.orderId, { status, gatewayPaymentId: `TEST-${randomBytes(6).toString("hex").toUpperCase()}`, amount: p.amount });
}

// ---- Cash ----

/** The enrolling agent records cash taken from the member. It counts only after an admin verifies it. */
export async function recordCash(user: SessionUser | null, installmentId: string) {
  const agent = requireRole(user, ["AGENT"]);
  return db.$transaction(async (tx) => {
    // Lock the month so two taps can't record the same cash twice.
    await tx.$queryRaw`select id from "Installment" where id = ${installmentId} for update`;
    const inst = await tx.installment.findFirst({ where: { id: installmentId, enrolment: { agentId: agent.id } }, include: { enrolment: true } });
    if (!inst) throw new AppError("NOT_FOUND", "Not found", 404);
    await checkPayable(tx, inst.id, inst.enrolmentId, inst.status);
    return tx.payment.create({
      data: {
        installmentId,
        memberId: inst.enrolment.memberId,
        method: "CASH",
        provider: "CASH",
        amount: inst.amount,
        orderId: newOrderId("CASH"),
        status: "PENDING",
        collectedById: agent.id,
      },
    });
  });
}

/** Cash waiting for verification, oldest first. */
export async function listPendingCash(user: SessionUser | null) {
  requireRole(user, adminRoles);
  return db.payment.findMany({
    where: { method: "CASH", status: "PENDING" },
    include: {
      member: { select: { name: true, phone: true } },
      collectedBy: { select: { name: true, phone: true } },
      installment: { include: { enrolment: { select: { tokenNumber: true } } } },
    },
    orderBy: { createdAt: "asc" },
  });
}

/** Admin confirms the office received the cash: it now counts as paid. */
export async function verifyCash(user: SessionUser | null, paymentId: string) {
  const admin = requireRole(user, adminRoles);
  const result = await db.$transaction(async (tx) => {
    await tx.$queryRaw`select id from "Payment" where id = ${paymentId} for update`;
    const p = await tx.payment.findUnique({ where: { id: paymentId } });
    if (!p || p.method !== "CASH") throw new AppError("NOT_FOUND", "Not found", 404);
    if (p.status !== "PENDING") throw new AppError("CASH_NOT_PENDING", "This cash entry was already handled", 409);
    const settled = await settleSuccess(tx, p.id, { verifiedBy: { connect: { id: admin.id } }, verifiedAt: new Date() });
    await audit(tx, admin.id, "cash.verify", "Payment", p.id, { amount: p.amount, result: settled.status });
    return settled;
  });
  await sendQueuedSmsSafely();
  return result;
}

/** Admin rejects a cash entry (not received, wrong amount): the month is unpaid again. */
export async function rejectCash(user: SessionUser | null, paymentId: string) {
  const admin = requireRole(user, adminRoles);
  return db.$transaction(async (tx) => {
    await tx.$queryRaw`select id from "Payment" where id = ${paymentId} for update`;
    const p = await tx.payment.findUnique({ where: { id: paymentId } });
    if (!p || p.method !== "CASH") throw new AppError("NOT_FOUND", "Not found", 404);
    if (p.status !== "PENDING") throw new AppError("CASH_NOT_PENDING", "This cash entry was already handled", 409);
    const rejected = await tx.payment.update({ where: { id: p.id }, data: { status: "FAILED", verifiedById: admin.id, verifiedAt: new Date() } });
    await audit(tx, admin.id, "cash.reject", "Payment", p.id, { amount: p.amount });
    return rejected;
  });
}

// ---- Reading ----

/** A payment with what a receipt needs. Members see their own; agents those of members they enrolled; admins all. */
export async function getPayment(user: SessionUser | null, paymentId: string) {
  const u = requireRole(user, ["MEMBER", "AGENT", ...adminRoles]);
  const scope = u.role === "MEMBER" ? { memberId: u.id } : u.role === "AGENT" ? { installment: { enrolment: { agentId: u.id } } } : {};
  const p = await db.payment.findFirst({
    where: { id: paymentId, ...scope },
    include: {
      member: { select: { name: true, phone: true } },
      collectedBy: { select: { name: true } },
      installment: { include: { enrolment: { include: { batch: { include: { scheme: true } } } } } },
    },
  });
  if (!p) throw new AppError("NOT_FOUND", "Not found", 404);
  return p;
}
