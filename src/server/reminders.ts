// The daily job: marks overdue months and defaulted enrolments, and sends payment reminders.
// Safe to run more than once a day: every step only changes what still needs changing, and each
// reminder exists at most once per month and type (unique key), so nobody gets the same SMS twice.
import { timingSafeEqual } from "node:crypto";
import { db } from "@/lib/db";
import type { SessionUser } from "@/shared/auth";
import { todayInIndia } from "@/shared/tracker";
import { audit } from "./audit";
import { requireRole } from "./auth";
import { sendQueuedSms } from "./completion";
import { getConfigInt } from "./config";
import { AppError } from "./errors";

/** "YYYY-MM-DD" `days` after `day` (negative for before), as a Date at midnight UTC like due dates. */
const shift = (day: string, days: number) => new Date(Date.parse(day) + days * 864e5);

/** Months still to pay: not paid or waived, and no cash for them waiting for the office. */
const unpaid = { status: { in: ["DUE" as const, "OVERDUE" as const] }, payments: { none: { status: { in: ["PENDING" as const, "SUCCESS" as const] } } } };

/** Longest run of OVERDUE months one after another. */
export function longestOverdueRun(statuses: { monthNo: number; status: string }[]) {
  let best = 0;
  let run = 0;
  for (const s of [...statuses].sort((a, b) => a.monthNo - b.monthNo)) {
    run = s.status === "OVERDUE" ? run + 1 : 0;
    best = Math.max(best, run);
  }
  return best;
}

export async function runDaily(today = todayInIndia()) {
  const [graceDays, missedInARow, daysBefore] = await Promise.all([
    getConfigInt("overdueAfterDays", 10),
    getConfigInt("defaultAfterMissedInARow", 2),
    getConfigInt("reminderDaysBefore", 3),
  ]);
  const todayDate = shift(today, 0);
  // Every enrolment still paying something: matured ones owe nothing; winners may still owe months up to their draw.
  const live = { status: { in: ["ACTIVE" as const, "WON" as const, "DEFAULTED" as const] } };

  // 1. Overdue: unpaid more than `graceDays` after the due date.
  const goingOverdue = await db.installment.findMany({
    where: { ...unpaid, status: "DUE", dueDate: { lt: shift(today, -graceDays) }, enrolment: live },
    select: { id: true, enrolmentId: true, enrolment: { select: { memberId: true } } },
  });
  await db.installment.updateMany({ where: { id: { in: goingOverdue.map((i) => i.id) }, status: "DUE" }, data: { status: "OVERDUE" } });
  await db.notification.createMany({
    data: goingOverdue.map((i) => ({ userId: i.enrolment.memberId, type: "OVERDUE" as const, enrolmentId: i.enrolmentId, installmentId: i.id, sms: true })),
    skipDuplicates: true,
  });

  // 2. Defaulted: `missedInARow` overdue months one after another. Out of draws until the member catches up (see payments.ts).
  const atRisk = await db.enrolment.findMany({
    where: { status: "ACTIVE", installments: { some: { status: "OVERDUE" } } },
    select: { id: true, memberId: true, installments: { select: { monthNo: true, status: true } } },
  });
  let defaulted = 0;
  for (const e of atRisk.filter((e) => longestOverdueRun(e.installments) >= missedInARow)) {
    // Only the run that changes the status notifies, so a default is announced once.
    const changed = await db.enrolment.updateMany({ where: { id: e.id, status: "ACTIVE" }, data: { status: "DEFAULTED" } });
    if (changed.count) {
      await db.notification.create({ data: { userId: e.memberId, type: "DEFAULTED", enrolmentId: e.id, sms: true } });
      defaulted++;
    }
  }

  // 3. Reminders: "due soon" a few days before, "due today" from the due date until the month turns overdue.
  const remind = async (type: "DUE_SOON" | "DUE_TODAY", dueDate: { gt?: Date; lte: Date }) => {
    const rows = await db.installment.findMany({
      where: { ...unpaid, status: "DUE", dueDate, enrolment: live },
      select: { id: true, enrolmentId: true, enrolment: { select: { memberId: true } } },
    });
    const r = await db.notification.createMany({
      data: rows.map((i) => ({ userId: i.enrolment.memberId, type, enrolmentId: i.enrolmentId, installmentId: i.id, sms: true })),
      skipDuplicates: true,
    });
    return r.count;
  };
  const dueSoon = await remind("DUE_SOON", { gt: todayDate, lte: shift(today, daysBefore) });
  const dueToday = await remind("DUE_TODAY", { lte: todayDate });

  // shortcut: sends in rounds of 50 within this request; move to a queue if a day's SMS run takes longer than the cron timeout.
  for (let round = 0; round < 200; round++) {
    const { found, sent } = await sendQueuedSms();
    if (found < 50 || sent === 0) break;
  }
  return { today, overdue: goingOverdue.length, defaulted, dueSoon, dueToday };
}

/** The cron caller proves itself with `Authorization: Bearer <CRON_SECRET>`. Unset secret: the endpoint is off. */
export function checkCronSecret(header: string | null) {
  const secret = process.env.CRON_SECRET;
  if (!secret) throw new AppError("CRON_DISABLED", "CRON_SECRET is not set", 503);
  const given = Buffer.from(header?.replace(/^Bearer /, "") ?? "");
  const want = Buffer.from(secret);
  if (given.length !== want.length || !timingSafeEqual(given, want)) throw new AppError("UNAUTHENTICATED", "Wrong cron secret", 401);
}

/** Super admin runs today's check by hand (for QA, or if the cron missed a day). */
export async function runDailyAsAdmin(user: SessionUser | null) {
  const admin = requireRole(user, ["SUPER_ADMIN"]);
  const result = await runDaily();
  await audit(db, admin.id, "daily.run", "Job", "daily", result);
  return result;
}
