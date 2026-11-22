// The office side of completions: allocate the product (or price the gold), collect any difference, deliver.
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { adminRoles, type SessionUser } from "@/shared/auth";
import { allocateInput, differenceDue, differencePaidInput, GOLD_PURITY, goldPrice, goldRateInput } from "@/shared/fulfilment";
import { todayInIndia } from "@/shared/tracker";
import { audit } from "./audit";
import { requireRole } from "./auth";
import { getConfigInt } from "./config";
import { AppError } from "./errors";

const include = {
  product: true,
  enrolment: {
    include: {
      batch: { include: { scheme: true } },
      member: { select: { name: true, phone: true } },
      agent: { select: { name: true, phone: true } },
      installments: { where: { status: "PAID" }, select: { amount: true } }, // only paid months count (#18)
    },
  },
} satisfies Prisma.FulfilmentInclude;

/** What the member has paid, which counts towards the product. Waived months don't count (client, #18). */
const planValue = (installments: { amount: number }[]) => installments.reduce((t, i) => t + i.amount, 0);

/** Today's rate (India date), or null if the admin hasn't entered it yet. */
export const todaysGoldRate = () => db.goldRate.findUnique({ where: { day_purity: { day: new Date(todayInIndia()), purity: GOLD_PURITY } } });

/** The queue, oldest first, with what the admin needs to act. */
export async function listFulfilments(user: SessionUser | null) {
  requireRole(user, adminRoles);
  // shortcut: loads every open item and the last 50 delivered; paginate when the queue holds thousands.
  const [open, delivered, products, rate, rates] = await Promise.all([
    db.fulfilment.findMany({ where: { status: { not: "DELIVERED" } }, include, orderBy: { createdAt: "asc" } }),
    db.fulfilment.findMany({ where: { status: "DELIVERED" }, include, orderBy: { deliveredAt: "desc" }, take: 50 }),
    db.product.findMany({ where: { active: true, stock: { gt: 0 } }, orderBy: { name: "asc" } }),
    todaysGoldRate(),
    db.goldRate.findMany({ where: { purity: GOLD_PURITY }, orderBy: { day: "desc" }, take: 7 }),
  ]);
  const view = (f: (typeof open)[number]) => ({ ...f, value: planValue(f.enrolment.installments) });
  return {
    items: [...open, ...delivered].map(view),
    upaharProducts: products.filter((p) => p.schemes.includes("UPAHAR")),
    goldRate: rate,
    recentRates: rates,
    goldGstBps: await getConfigInt("goldGstBps", 300),
    makingGstBps: await getConfigInt("makingGstBps", 500),
  };
}

/** Admin enters the gold rate for a day (today by default). Entering it again for the same day corrects it. */
export async function setGoldRate(user: SessionUser | null, input: unknown) {
  const admin = requireRole(user, adminRoles);
  const { day = todayInIndia(), ratePerGram } = goldRateInput.parse(input);
  return db.$transaction(async (tx) => {
    const key = { day: new Date(day), purity: GOLD_PURITY };
    const rate = await tx.goldRate.upsert({ where: { day_purity: key }, create: { ...key, ratePerGram, enteredById: admin.id }, update: { ratePerGram, enteredById: admin.id } });
    await audit(tx, admin.id, "goldRate.set", "GoldRate", rate.id, { day, ratePerGram });
    return rate;
  });
}

/** Locks the fulfilment row and returns it, or throws if it is missing or not in `status`. */
async function lockIn(tx: Prisma.TransactionClient, id: string, status: "CONFIRMED" | "ALLOCATED") {
  await tx.$queryRaw`select id from "Fulfilment" where id = ${id} for update`;
  const f = await tx.fulfilment.findUnique({ where: { id }, include });
  if (!f) throw new AppError("NOT_FOUND", "Not found", 404);
  if (f.status !== status) throw new AppError("WRONG_STEP", `This needs to be ${status.toLowerCase()} first`, 409);
  return f;
}

/** Takes one unit out of stock, or fails if there is none left. */
async function takeStock(tx: Prisma.TransactionClient, productId: string) {
  const r = await tx.product.updateMany({ where: { id: productId, active: true, stock: { gt: 0 } }, data: { stock: { decrement: 1 } } });
  if (r.count === 0) throw new AppError("OUT_OF_STOCK", "This product is out of stock", 409);
}

/**
 * Fixes what the member gets and what they still owe, once they have answered the prompt.
 * Upahar: the office picks a product, nothing more to pay. Manpasand: the member's product, they pay what it costs above
 * the plan value. Gold: priced with today's rate; they pay what it costs above the plan value.
 */
export async function allocate(user: SessionUser | null, id: string, input: unknown) {
  const admin = requireRole(user, adminRoles);
  const { productId, weightMg, making } = allocateInput.parse(input);
  const [goldGstBps, makingGstBps] = await Promise.all([getConfigInt("goldGstBps", 300), getConfigInt("makingGstBps", 500)]);
  const rate = await todaysGoldRate();

  return db.$transaction(async (tx) => {
    const f = await lockIn(tx, id, "CONFIRMED");
    const value = planValue(f.enrolment.installments);
    let data: Prisma.FulfilmentUpdateInput;
    switch (f.enrolment.batch.scheme.code) {
      case "UPAHAR": {
        const product = productId && (await tx.product.findFirst({ where: { id: productId, schemes: { has: "UPAHAR" } } }));
        if (!product) throw new AppError("PRODUCT_UNAVAILABLE", "Choose an Upahar product", 409);
        await takeStock(tx, product.id);
        data = { product: { connect: { id: product.id } }, price: product.price, differenceDue: 0 }; // CONFIRM #21: the company's gift, nothing to pay
        break;
      }
      case "MANPASAND": {
        const product = await tx.product.findUniqueOrThrow({ where: { id: f.productId! } });
        await takeStock(tx, product.id);
        data = { price: product.price, differenceDue: differenceDue(product.price, value) };
        break;
      }
      case "GOLD": {
        if (!rate) throw new AppError("NO_GOLD_RATE", "Enter today's gold rate first", 409);
        if (!weightMg || making === undefined) throw new AppError("VALIDATION", "Enter the weight and making charges", 400);
        const p = goldPrice({ ratePerGram: rate.ratePerGram, weightMg, making, goldGstBps, makingGstBps });
        data = { price: p.total, priceDetails: p, differenceDue: differenceDue(p.total, value) };
        break;
      }
    }
    const updated = await tx.fulfilment.update({ where: { id }, data: { ...data, status: "ALLOCATED", allocatedAt: new Date() } });
    await audit(tx, admin.id, "fulfilment.allocate", "Fulfilment", id, { price: updated.price, differenceDue: updated.differenceDue, value });
    return updated;
  });
}

/** Records that the member paid the difference (cash receipt number or UPI/bank UTR). */
export async function recordDifferencePaid(user: SessionUser | null, id: string, input: unknown) {
  const admin = requireRole(user, adminRoles);
  const { ref } = differencePaidInput.parse(input);
  return db.$transaction(async (tx) => {
    const f = await lockIn(tx, id, "ALLOCATED");
    if (!f.differenceDue) throw new AppError("NOTHING_DUE", "Nothing more to pay", 409);
    if (f.differencePaidAt) throw new AppError("ALREADY_PAID", "The difference is already recorded", 409);
    const updated = await tx.fulfilment.update({ where: { id }, data: { differenceRef: ref, differencePaidAt: new Date() } });
    await audit(tx, admin.id, "fulfilment.differencePaid", "Fulfilment", id, { amount: f.differenceDue, ref });
    return updated;
  });
}

/** Hands over the product. Only once any difference is paid. */
export async function markDelivered(user: SessionUser | null, id: string) {
  const admin = requireRole(user, adminRoles);
  return db.$transaction(async (tx) => {
    const f = await lockIn(tx, id, "ALLOCATED");
    if (f.differenceDue && !f.differencePaidAt) throw new AppError("DIFFERENCE_UNPAID", "The member still has to pay the difference", 409);
    const updated = await tx.fulfilment.update({ where: { id }, data: { status: "DELIVERED", deliveredAt: new Date() } });
    await audit(tx, admin.id, "fulfilment.deliver", "Fulfilment", id);
    return updated;
  });
}
