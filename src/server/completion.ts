// When an enrolment matures or wins a draw, the member is asked to act, in the app until they do, and by SMS:
// Upahar: confirm the delivery address. Manpasand: choose a product (and the address). Gold: book the purchase.
import type { NotificationType, Prisma } from "@/generated/prisma/client";
import { formatMonthYear } from "@/lib/dates";
import { db } from "@/lib/db";
import { formatPaise } from "@/lib/money";
import type { SessionUser } from "@/shared/auth";
import { confirmFulfilmentInput } from "@/shared/completion";
import type { GoldPrice } from "@/shared/fulfilment";
import { requireRole } from "./auth";
import { AppError } from "./errors";
import { todaysGoldRate } from "./fulfilment";
import { sendSms } from "./sms";

type Tx = Prisma.TransactionClient;

/** Call inside the transaction that matures the enrolment or picks it in a draw. Does nothing if it already exists. */
export async function startCompletion(tx: Tx, enrolmentId: string, reason: "MATURED" | "WON") {
  const e = await tx.enrolment.findUniqueOrThrow({ where: { id: enrolmentId }, select: { memberId: true, fulfilment: { select: { id: true } } } });
  if (e.fulfilment) return;
  await tx.fulfilment.create({ data: { enrolmentId, reason } });
  await tx.notification.create({ data: { userId: e.memberId, type: reason, enrolmentId, sms: true } });
}

type SmsContext = { scheme: string; token: string; month: string; amount: string };

const smsText: Record<"en" | "hi", Record<NotificationType, (c: SmsContext) => string>> = {
  en: {
    MATURED: (c) => `Saksham Multitrade: all installments of ${c.scheme} (${c.token}) are paid. Open the app to claim your product.`,
    WON: (c) => `Saksham Multitrade: congratulations, ${c.token} won this month's ${c.scheme} draw. No more installments to pay. Open the app to claim your product.`,
    DUE_SOON: (c) => `Saksham Multitrade: ${c.amount} for ${c.month} (${c.token}) is due soon. Pay in the app or give cash to your Panchayat Leader.`,
    DUE_TODAY: (c) => `Saksham Multitrade: ${c.amount} for ${c.month} (${c.token}) is due now. Pay in the app or give cash to your Panchayat Leader.`,
    OVERDUE: (c) => `Saksham Multitrade: ${c.amount} for ${c.month} (${c.token}) is overdue. Members with an overdue month can't win the monthly draw. Please pay soon.`,
    DEFAULTED: (c) => `Saksham Multitrade: ${c.token} has missed months in a row and is out of the draws. Pay what is owed to take part again.`,
  },
  hi: {
    MATURED: (c) => `सक्षम मल्टीट्रेड: ${c.scheme} (${c.token}) की सारी किस्तें जमा हो गईं। अपना सामान लेने के लिए ऐप खोलें।`,
    WON: (c) => `सक्षम मल्टीट्रेड: बधाई हो, ${c.token} ने ${c.scheme} का इस महीने का ड्रॉ जीता। अब कोई किस्त नहीं भरनी। अपना सामान लेने के लिए ऐप खोलें।`,
    DUE_SOON: (c) => `सक्षम मल्टीट्रेड: ${c.month} की किस्त ${c.amount} (${c.token}) जल्द देय है। ऐप से भरें या अपने पंचायत लीडर को नकद दें।`,
    DUE_TODAY: (c) => `सक्षम मल्टीट्रेड: ${c.month} की किस्त ${c.amount} (${c.token}) अब देय है। ऐप से भरें या अपने पंचायत लीडर को नकद दें।`,
    OVERDUE: (c) => `सक्षम मल्टीट्रेड: ${c.month} की किस्त ${c.amount} (${c.token}) बकाया है। बकाया किस्त वाले सदस्य मासिक ड्रॉ नहीं जीत सकते। कृपया जल्द भरें।`,
    DEFAULTED: (c) => `सक्षम मल्टीट्रेड: ${c.token} की लगातार किस्तें छूट गई हैं, इसलिए यह ड्रॉ से बाहर है। फिर से शामिल होने के लिए बकाया भरें।`,
  },
};

/** Scheme, token, month and amount a notification is about, in the reader's language. */
async function contextFor(n: { enrolmentId: string | null; installmentId: string | null }, hi: boolean): Promise<SmsContext> {
  const [e, i] = await Promise.all([
    n.enrolmentId ? db.enrolment.findUnique({ where: { id: n.enrolmentId }, select: { tokenNumber: true, batch: { select: { scheme: true } } } }) : null,
    n.installmentId ? db.installment.findUnique({ where: { id: n.installmentId }, select: { dueDate: true, amount: true } }) : null,
  ]);
  return {
    scheme: e ? (hi ? e.batch.scheme.nameHi : e.batch.scheme.nameEn) : "",
    token: e?.tokenNumber ?? "",
    month: i ? formatMonthYear(i.dueDate.toISOString().slice(0, 10), hi ? "hi" : "en") : "",
    amount: i ? formatPaise(i.amount) : "",
  };
}

/**
 * Sends up to 50 SMS for notifications that still need one. Call after the transaction that created them has committed.
 * Each one is claimed before sending, so two callers never send the same SMS; a failed send is released for the next call.
 */
export async function sendQueuedSms() {
  const queued = await db.notification.findMany({
    where: { sms: true, smsSentAt: null },
    include: { user: { select: { phone: true, language: true } } },
    orderBy: { createdAt: "asc" },
    take: 50,
  });
  let sent = 0;
  for (const n of queued) {
    const claimed = await db.notification.updateMany({ where: { id: n.id, smsSentAt: null }, data: { smsSentAt: new Date() } });
    if (claimed.count === 0) continue;
    try {
      const hi = n.user.language === "hi";
      await sendSms(n.user.phone, smsText[hi ? "hi" : "en"][n.type](await contextFor(n, hi)));
      sent++;
    } catch (err) {
      console.error(`SMS for notification ${n.id} failed`, err);
      await db.notification.update({ where: { id: n.id }, data: { smsSentAt: null } });
    }
  }
  return { found: queued.length, sent };
}

/** Sends queued SMS without ever failing the caller: the money or draw is already saved. */
export const sendQueuedSmsSafely = () => sendQueuedSms().catch((err) => console.error("Sending queued SMS failed", err));

/** The member's completions still waiting for them, or confirmed and waiting for the office; with what each needs. */
export async function listMyCompletions(user: SessionUser | null) {
  const member = requireRole(user, ["MEMBER"]);
  const [rows, profile] = await Promise.all([
    db.fulfilment.findMany({
      where: { enrolment: { memberId: member.id }, status: { in: ["PENDING", "CONFIRMED", "ALLOCATED"] } },
      include: { product: true, enrolment: { include: { batch: { include: { scheme: true } }, installments: { select: { amount: true } } } } },
      orderBy: { createdAt: "asc" },
    }),
    db.memberProfile.findUnique({ where: { userId: member.id } }),
  ]);
  const goldRate = rows.some((r) => r.enrolment.batch.scheme.code === "GOLD") ? await todaysGoldRate() : null;
  const needsProducts = rows.some((r) => r.status === "PENDING" && r.enrolment.batch.scheme.code === "MANPASAND");
  const products = needsProducts
    ? await db.product.findMany({ where: { active: true, stock: { gt: 0 }, schemes: { has: "MANPASAND" } }, orderBy: { price: "asc" } })
    : [];
  return rows.map((f) => {
    // What the member's plan is worth: every month counts, including months waived by a draw win. CONFIRM #18.
    const value = f.enrolment.installments.reduce((t, i) => t + i.amount, 0);
    return {
      id: f.id,
      reason: f.reason,
      status: f.status,
      tokenNumber: f.enrolment.tokenNumber,
      scheme: { code: f.enrolment.batch.scheme.code, nameEn: f.enrolment.batch.scheme.nameEn, nameHi: f.enrolment.batch.scheme.nameHi },
      value,
      address: f.address ?? (profile ? `${profile.address}, ${profile.village}` : ""),
      product: f.product && { name: f.product.name, nameHi: f.product.nameHi, price: f.product.price, difference: Math.max(0, f.product.price - value) },
      // Set once the office allocates: the final price and what is left to pay on top of the plan value.
      price: f.price,
      priceDetails: f.priceDetails as GoldPrice | null,
      differenceDue: f.differenceDue,
      differencePaid: f.differencePaidAt !== null,
      goldRate: f.enrolment.batch.scheme.code === "GOLD" && goldRate ? { ratePerGram: goldRate.ratePerGram, purity: goldRate.purity } : null,
      products:
        f.status === "PENDING" && f.enrolment.batch.scheme.code === "MANPASAND"
          ? products.map((p) => ({ id: p.id, name: p.name, nameHi: p.nameHi, price: p.price, difference: Math.max(0, p.price - value) }))
          : [],
    };
  });
}

/** The member answers the prompt. Upahar needs an address; Manpasand a product and an address; Gold just books. */
export async function confirmFulfilment(user: SessionUser | null, fulfilmentId: string, input: unknown) {
  const member = requireRole(user, ["MEMBER"]);
  const { address, productId } = confirmFulfilmentInput.parse(input);
  return db.$transaction(async (tx) => {
    await tx.$queryRaw`select id from "Fulfilment" where id = ${fulfilmentId} for update`;
    const f = await tx.fulfilment.findFirst({
      where: { id: fulfilmentId, enrolment: { memberId: member.id } },
      include: { enrolment: { include: { batch: { include: { scheme: true } } } } },
    });
    if (!f) throw new AppError("NOT_FOUND", "Not found", 404);
    if (f.status !== "PENDING") throw new AppError("ALREADY_CONFIRMED", "You have already done this", 409);
    const code = f.enrolment.batch.scheme.code;

    if (code !== "GOLD" && !address) throw new AppError("ADDRESS_REQUIRED", "Enter the delivery address", 400);
    if (code === "MANPASAND") {
      const product = productId && (await tx.product.findFirst({ where: { id: productId, active: true, stock: { gt: 0 }, schemes: { has: "MANPASAND" } } }));
      if (!product) throw new AppError("PRODUCT_UNAVAILABLE", "Choose a product that is available", 409);
    }
    return tx.fulfilment.update({
      where: { id: f.id },
      data: {
        status: "CONFIRMED",
        confirmedAt: new Date(),
        address: code === "GOLD" ? null : address,
        productId: code === "MANPASAND" ? productId : null,
      },
    });
  });
}

/** The member's messages, newest first. */
export async function listMyNotifications(user: SessionUser | null) {
  const member = requireRole(user, ["MEMBER"]);
  const rows = await db.notification.findMany({
    where: { userId: member.id },
    include: { installment: { select: { dueDate: true, amount: true } } },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  const tokens = new Map(
    (
      await db.enrolment.findMany({
        where: { id: { in: rows.map((r) => r.enrolmentId).filter((x): x is string => !!x) } },
        select: { id: true, tokenNumber: true, batch: { select: { scheme: { select: { nameEn: true, nameHi: true } } } } },
      })
    ).map((e) => [e.id, e]),
  );
  return rows.map((n) => {
    const e = n.enrolmentId ? tokens.get(n.enrolmentId) : undefined;
    return {
      id: n.id,
      type: n.type,
      createdAt: n.createdAt,
      readAt: n.readAt,
      tokenNumber: e?.tokenNumber ?? "",
      scheme: e?.batch.scheme ?? null,
      // reminders: the month ("YYYY-MM-DD") and amount in paise
      dueDate: n.installment?.dueDate.toISOString().slice(0, 10) ?? null,
      amount: n.installment?.amount ?? null,
    };
  });
}

export async function countUnread(user: SessionUser | null) {
  const member = requireRole(user, ["MEMBER"]);
  return db.notification.count({ where: { userId: member.id, readAt: null } });
}

export async function markAllRead(user: SessionUser | null) {
  const member = requireRole(user, ["MEMBER"]);
  await db.notification.updateMany({ where: { userId: member.id, readAt: null }, data: { readAt: new Date() } });
}
