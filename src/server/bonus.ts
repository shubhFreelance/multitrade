// Bonus rewards: scooters unlock at 6 confirmed payments, the gold chain at 12 (settings), and one bonus draw per prize
// picks winners among the members who have unlocked it. Unlock is always worked out from PAID months, never stored.
import { randomBytes } from "node:crypto";
import type { BonusPrize, Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { adminRoles, type SessionUser } from "@/shared/auth";
import { bonusStatus, defaultBonusRewards, defaultBonusRule, type BonusRewards, type BonusRule } from "@/shared/bonus";
import { audit } from "./audit";
import { requireRole } from "./auth";
import { sendQueuedSmsSafely } from "./completion";
import { pickWinners } from "./draws";
import { AppError } from "./errors";

type Client = Prisma.TransactionClient;
export const bonusPrizes = ["SCOOTER", "GOLD_CHAIN"] as const;

async function settings(client: Client = db) {
  const [rule, rewards] = await Promise.all([client.config.findUnique({ where: { key: "bonusUnlock" } }), client.config.findUnique({ where: { key: "bonusRewards" } })]);
  return {
    rule: { ...defaultBonusRule, ...(rule?.value as Partial<BonusRule> | undefined) },
    rewards: { ...defaultBonusRewards, ...(rewards?.value as Partial<BonusRewards> | undefined) },
  };
}

const paidCount = { select: { installments: { where: { status: "PAID" as const } } } };

/** Whether the signed-in member has unlocked each prize, and the prizes they have won. */
export async function getMyBonus(user: SessionUser | null) {
  const member = requireRole(user, ["MEMBER"]);
  const [{ rule, rewards }, enrolments, wins] = await Promise.all([
    settings(),
    db.enrolment.findMany({ where: { memberId: member.id }, select: { status: true, _count: paidCount } }),
    db.drawWinner.findMany({ where: { enrolment: { memberId: member.id }, draw: { type: "BONUS" } }, select: { draw: { select: { prize: true } } } }),
  ]);
  const won = new Set(wins.map((w) => w.draw.prize));
  return bonusStatus(enrolments.map((e) => ({ status: e.status, paid: e._count.installments })), rule, rewards).map((p) => ({ ...p, won: won.has(p.prize) }));
}

/**
 * Members who can win `prize` right now: unlocked it (defaulted enrolments don't count) and haven't won a bonus prize yet.
 * Each member is entered once, under the token of their enrolment with the most paid months.
 */
async function eligibleFor(client: Client, prize: BonusPrize) {
  const { rule, rewards } = await settings(client);
  // shortcut: loads every enrolment's paid count; fine for tens of thousands of enrolments, use SQL grouping beyond that.
  const [enrolments, winners] = await Promise.all([
    client.enrolment.findMany({
      where: { member: { status: "ACTIVE" } },
      select: { id: true, memberId: true, tokenNumber: true, status: true, _count: paidCount },
    }),
    client.drawWinner.findMany({ where: { draw: { type: "BONUS" } }, select: { enrolment: { select: { memberId: true } } } }),
  ]);
  const alreadyWon = new Set(winners.map((w) => w.enrolment.memberId));
  const byMember = new Map<string, typeof enrolments>();
  for (const e of enrolments) byMember.set(e.memberId, [...(byMember.get(e.memberId) ?? []), e]);

  const eligible: { enrolmentId: string; memberId: string; token: string }[] = [];
  for (const [memberId, list] of byMember) {
    if (alreadyWon.has(memberId)) continue;
    const status = bonusStatus(list.map((e) => ({ status: e.status, paid: e._count.installments })), rule, rewards).find((p) => p.prize === prize);
    if (!status?.unlocked) continue;
    const best = list.filter((e) => e.status !== "DEFAULTED").sort((a, b) => b._count.installments - a._count.installments || a.tokenNumber.localeCompare(b.tokenNumber))[0];
    eligible.push({ enrolmentId: best.id, memberId, token: best.tokenNumber });
  }
  return { eligible, count: prize === "SCOOTER" ? rewards.scooters : rewards.goldChains, needed: prize === "SCOOTER" ? rule.scooter : rule.goldChain };
}

const drawInclude = {
  winners: { orderBy: { position: "asc" as const }, include: { enrolment: { select: { tokenNumber: true, member: { select: { name: true, phone: true } } } } } },
};

/** Admin: each prize with how many members can win it now, and its draw if it has been run. */
export async function bonusOverview(user: SessionUser | null) {
  requireRole(user, adminRoles);
  return Promise.all(
    bonusPrizes.map(async (prize) => {
      const [{ eligible, count, needed }, draw] = await Promise.all([eligibleFor(db, prize), db.draw.findUnique({ where: { type_prize: { type: "BONUS", prize } }, include: drawInclude })]);
      return {
        prize,
        count,
        needed,
        eligibleNow: eligible.length,
        draw: draw && {
          id: draw.id,
          createdAt: draw.createdAt,
          seed: draw.seed,
          eligibleCount: (draw.eligible as string[]).length,
          winners: draw.winners.map((w) => ({ id: w.id, token: w.enrolment.tokenNumber, name: w.enrolment.member.name, phone: w.enrolment.member.phone, handedOverAt: w.handedOverAt })),
        },
      };
    }),
  );
}

/** Runs the draw for one prize, once. Saves the eligible tokens and the seed first; winners follow from them alone. */
export async function runBonusDraw(user: SessionUser | null, prize: unknown) {
  const admin = requireRole(user, adminRoles);
  if (prize !== "SCOOTER" && prize !== "GOLD_CHAIN") throw new AppError("VALIDATION", "Unknown prize", 400);
  const result = await db.$transaction(async (tx) => {
    // One bonus draw at a time, so a member can't win both prizes in two draws running together.
    await tx.$executeRaw`select pg_advisory_xact_lock(hashtext('bonus-draw'))`;
    if (await tx.draw.findUnique({ where: { type_prize: { type: "BONUS", prize } } })) throw new AppError("DRAW_ALREADY_RUN", "This bonus draw has already been run", 409);
    const { eligible, count } = await eligibleFor(tx, prize);
    if (eligible.length === 0) throw new AppError("NO_ELIGIBLE", "Nobody has unlocked this prize yet", 409);

    const tokens = eligible.map((e) => e.token).sort();
    const seed = randomBytes(16).toString("hex");
    const winners = pickWinners(seed, tokens, count);
    const byToken = new Map(eligible.map((e) => [e.token, e]));
    const draw = await tx.draw.create({
      data: {
        type: "BONUS",
        prize,
        monthNo: 0,
        seed,
        eligible: tokens,
        runById: admin.id,
        winners: { create: winners.map((t, i) => ({ enrolmentId: byToken.get(t)!.enrolmentId, position: i + 1 })) },
      },
    });
    await tx.notification.createMany({
      data: winners.map((t) => ({ userId: byToken.get(t)!.memberId, type: prize === "SCOOTER" ? ("BONUS_SCOOTER" as const) : ("BONUS_GOLD_CHAIN" as const), enrolmentId: byToken.get(t)!.enrolmentId, sms: true })),
    });
    await audit(tx, admin.id, "bonusDraw.run", "Draw", draw.id, { prize, eligible: tokens.length, winners });
    return { id: draw.id, prize, seed, eligibleCount: tokens.length, winners };
  });
  await sendQueuedSmsSafely();
  return result;
}

/** The office gave the winner their scooter or chain. */
export async function markPrizeHandedOver(user: SessionUser | null, winnerId: string) {
  const admin = requireRole(user, adminRoles);
  return db.$transaction(async (tx) => {
    const r = await tx.drawWinner.updateMany({ where: { id: winnerId, handedOverAt: null, draw: { type: "BONUS" } }, data: { handedOverAt: new Date() } });
    if (r.count === 0) throw new AppError("NOT_FOUND", "Not found, or already handed over", 404);
    await audit(tx, admin.id, "bonusPrize.handedOver", "DrawWinner", winnerId);
    return { id: winnerId };
  });
}

/** Bonus draw results every member can see (prize, winners' tokens, seed). */
export async function listBonusDraws(user: SessionUser | null) {
  const member = requireRole(user, ["MEMBER"]);
  const draws = await db.draw.findMany({
    where: { type: "BONUS" },
    include: { winners: { orderBy: { position: "asc" }, include: { enrolment: { select: { tokenNumber: true, memberId: true } } } } },
    orderBy: { createdAt: "desc" },
  });
  return draws.map((d) => ({
    id: d.id,
    prize: d.prize!,
    createdAt: d.createdAt,
    seed: d.seed,
    eligibleCount: (d.eligible as string[]).length,
    winners: d.winners.map((w) => ({ token: w.enrolment.tokenNumber, mine: w.enrolment.memberId === member.id })),
  }));
}
