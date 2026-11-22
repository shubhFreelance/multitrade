// Monthly draws: each month a few members of a batch win, get their product early and stop paying.
// Fair and checkable: the eligible list and a random seed are saved first, and winners follow from them alone.
import { createHash, randomBytes } from "node:crypto";
import { db } from "@/lib/db";
import { adminRoles, type SessionUser } from "@/shared/auth";
import { batchLabel } from "@/shared/catalog";
import { runDrawInput } from "@/shared/draws";
import { todayInIndia } from "@/shared/tracker";
import { audit } from "./audit";
import { requireRole } from "./auth";
import { sendQueuedSmsSafely, startCompletion } from "./completion";
import { getConfigInt } from "./config";
import { AppError } from "./errors";

/** First day of the month, `months` after `start` (UTC), as "YYYY-MM-DD". */
const monthStart = (start: Date, months: number) => new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + months, 1)).toISOString().slice(0, 10);

/** "YYYY-MM-DD" `days` before `day`. */
const daysBefore = (day: string, days: number) => new Date(Date.parse(day) - days * 864e5).toISOString().slice(0, 10);

/**
 * Picks `n` tokens from `tokens` using only `seed`: same seed and list, same winners.
 * Draw i takes sha256(seed:i) as a number and picks that position (mod what is left) from the sorted list.
 */
export function pickWinners(seed: string, tokens: string[], n: number): string[] {
  const pool = [...tokens].sort();
  const winners: string[] = [];
  for (let i = 0; i < n && pool.length; i++) {
    const r = createHash("sha256").update(`${seed}:${i}`).digest().readUIntBE(0, 6); // 48 bits: bias is negligible for pools this size
    winners.push(pool.splice(r % pool.length, 1)[0]);
  }
  return winners;
}

/**
 * A month is overdue when it is unpaid, no cash for it is waiting, and it was due more than `overdueAfterDays` ago.
 * shortcut: worked out here until the overdue job (Feature 13) sets OVERDUE; then this can read the status alone.
 */
const hasOverdue = (installments: { status: string; dueDate: Date; payments: unknown[] }[], cutoff: string) =>
  installments.some(
    (i) => i.status === "OVERDUE" || (i.status === "DUE" && i.payments.length === 0 && i.dueDate.toISOString().slice(0, 10) < cutoff),
  );

/** Every batch with its draws so far and the next month that can be drawn (null when none can be yet). */
export async function listDrawBatches(user: SessionUser | null) {
  requireRole(user, adminRoles);
  const today = todayInIndia();
  const batches = await db.batch.findMany({
    include: {
      scheme: true,
      _count: { select: { enrolments: true } },
      draws: { where: { type: "MONTHLY" }, orderBy: { monthNo: "desc" }, include: { winners: { include: { enrolment: { select: { tokenNumber: true } } }, orderBy: { position: "asc" } } } },
    },
    orderBy: [{ scheme: { code: "asc" } }, { number: "asc" }],
  });
  return batches.map((b) => {
    const nextMonth = (b.draws[0]?.monthNo ?? 0) + 1;
    const opensOn = monthStart(b.startMonth, nextMonth - 1);
    const last = nextMonth > b.scheme.tenureMonths - 1; // the final month has no draw: everyone left gets the product
    return {
      id: b.id,
      label: batchLabel(b.scheme.code, b.number),
      scheme: { code: b.scheme.code, nameEn: b.scheme.nameEn, nameHi: b.scheme.nameHi },
      members: b._count.enrolments,
      winnersPerDraw: b.winnersPerDraw,
      nextMonth: last ? null : nextMonth,
      opensOn: last ? null : opensOn,
      canRun: !last && opensOn <= today && b.winnersPerDraw > 0,
      draws: b.draws.map((d) => ({
        id: d.id,
        monthNo: d.monthNo,
        createdAt: d.createdAt,
        seed: d.seed,
        eligibleCount: (d.eligible as string[]).length,
        winners: d.winners.map((w) => w.enrolment.tokenNumber),
      })),
    };
  });
}

/**
 * Runs one batch's draw for one month. The caller names the month, so a second tap fails instead of running the next month.
 * Eligible: ACTIVE enrolments (not won, matured or defaulted) with no overdue month.
 * Winners: enrolment becomes WON and every unpaid month after the draw month is waived.
 */
export async function runMonthlyDraw(user: SessionUser | null, input: unknown) {
  const admin = requireRole(user, adminRoles);
  const { batchId, monthNo } = runDrawInput.parse(input);
  const graceDays = await getConfigInt("overdueAfterDays", 10);
  const today = todayInIndia();

  const result = await db.$transaction(async (tx) => {
    // One draw at a time per batch.
    await tx.$queryRaw`select id from "Batch" where id = ${batchId} for update`;
    const batch = await tx.batch.findUnique({ where: { id: batchId }, include: { scheme: true } });
    if (!batch) throw new AppError("NOT_FOUND", "Not found", 404);
    const done = await tx.draw.findFirst({ where: { batchId, type: "MONTHLY" }, orderBy: { monthNo: "desc" } });
    if (done && done.monthNo >= monthNo) throw new AppError("DRAW_ALREADY_RUN", "This month's draw has already been run", 409);
    if (monthNo !== (done?.monthNo ?? 0) + 1) throw new AppError("DRAW_OUT_OF_ORDER", "Run the earlier months' draws first", 409);
    if (monthNo > batch.scheme.tenureMonths - 1) throw new AppError("DRAW_NOT_OPEN", "There is no draw in the last month", 409);
    if (monthStart(batch.startMonth, monthNo - 1) > today) throw new AppError("DRAW_NOT_OPEN", "This month has not started yet", 409);

    const enrolments = await tx.enrolment.findMany({
      where: { batchId, status: "ACTIVE" },
      select: {
        id: true,
        tokenNumber: true,
        installments: { select: { status: true, dueDate: true, payments: { where: { status: "PENDING" }, select: { id: true } } } },
      },
    });
    const cutoff = daysBefore(today, graceDays);
    const eligible = enrolments.filter((e) => !hasOverdue(e.installments, cutoff)).map((e) => e.tokenNumber).sort();
    if (eligible.length === 0) throw new AppError("NO_ELIGIBLE", "No member is eligible for this draw", 409);

    const seed = randomBytes(16).toString("hex");
    const winners = pickWinners(seed, eligible, batch.winnersPerDraw);
    const byToken = new Map(enrolments.map((e) => [e.tokenNumber, e.id]));
    const winnerIds = winners.map((t) => byToken.get(t)!);

    const draw = await tx.draw.create({
      data: {
        batchId,
        monthNo,
        seed,
        eligible,
        runById: admin.id,
        winners: { create: winnerIds.map((enrolmentId, i) => ({ enrolmentId, position: i + 1 })) },
      },
    });
    await tx.enrolment.updateMany({ where: { id: { in: winnerIds } }, data: { status: "WON" } });
    await tx.installment.updateMany({
      where: { enrolmentId: { in: winnerIds }, monthNo: { gt: monthNo }, status: { in: ["DUE", "OVERDUE"] }, payments: { none: { status: "PENDING" } } },
      data: { status: "WAIVED" },
    });
    for (const id of winnerIds) await startCompletion(tx, id, "WON");
    await audit(tx, admin.id, "draw.run", "Draw", draw.id, { batchId, monthNo, eligible: eligible.length, winners });
    return { id: draw.id, monthNo, seed, eligibleCount: eligible.length, winners };
  });
  await sendQueuedSmsSafely();
  return result;
}

/** Draw results for the batches the member is in, newest first, with the member's own wins marked. */
export async function listMyDraws(user: SessionUser | null) {
  const member = requireRole(user, ["MEMBER"]);
  const mine = await db.enrolment.findMany({ where: { memberId: member.id }, select: { id: true, batchId: true } });
  const myIds = new Set(mine.map((e) => e.id));
  const draws = await db.draw.findMany({
    where: { batchId: { in: mine.map((e) => e.batchId) }, type: "MONTHLY" },
    include: {
      batch: { include: { scheme: true } },
      winners: { orderBy: { position: "asc" }, include: { enrolment: { select: { id: true, tokenNumber: true } } } },
    },
    orderBy: { createdAt: "desc" },
  });
  return draws.map((d) => ({
    id: d.id,
    batch: batchLabel(d.batch.scheme.code, d.batch.number),
    scheme: { nameEn: d.batch.scheme.nameEn, nameHi: d.batch.scheme.nameHi },
    monthNo: d.monthNo,
    createdAt: d.createdAt,
    seed: d.seed,
    eligibleCount: (d.eligible as string[]).length,
    winners: d.winners.map((w) => ({ token: w.enrolment.tokenNumber, mine: myIds.has(w.enrolment.id) })),
  }));
}
