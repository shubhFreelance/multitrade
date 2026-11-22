import { db } from "@/lib/db";
import type { SessionUser } from "@/shared/auth";
import { bonusStatus, defaultBonusRewards, defaultBonusRule, type BonusRewards, type BonusRule } from "@/shared/bonus";
import { requireRole } from "./auth";

/** Whether the signed-in member has unlocked the bonus draw, worked out from confirmed payments (never a stored flag). */
export async function getMyBonus(user: SessionUser | null) {
  const member = requireRole(user, ["MEMBER"]);
  const [rule, rewards, enrolments] = await Promise.all([
    db.config.findUnique({ where: { key: "bonusUnlock" } }),
    db.config.findUnique({ where: { key: "bonusRewards" } }),
    db.enrolment.findMany({
      where: { memberId: member.id },
      select: { status: true, _count: { select: { installments: { where: { status: "PAID" } } } } },
    }),
  ]);
  return bonusStatus(
    enrolments.map((e) => ({ status: e.status, paid: e._count.installments })),
    { ...defaultBonusRule, ...(rule?.value as Partial<BonusRule> | undefined) },
    { ...defaultBonusRewards, ...(rewards?.value as Partial<BonusRewards> | undefined) },
  );
}
