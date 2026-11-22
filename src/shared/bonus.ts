// Bonus rewards: scooters unlock after 6 confirmed payments, the gold chain after 12. Pure: shared by web, API and the mobile app.

export type BonusRule = { scooter: number; goldChain: number; scope: "ENROLMENT" | "CUMULATIVE" };
export type BonusRewards = { scooters: number; goldChains: number };
export type BonusPrize = "SCOOTER" | "GOLD_CHAIN";
export type PrizeStatus = { prize: BonusPrize; count: number; needed: number; paid: number; remaining: number; unlocked: boolean };

export const defaultBonusRule: BonusRule = { scooter: 6, goldChain: 12, scope: "ENROLMENT" };
export const defaultBonusRewards: BonusRewards = { scooters: 5, goldChains: 1 };

/**
 * `paid` per enrolment counts PAID installments only: pending cash and waived months don't count.
 * Defaulted enrolments never count, since they are left out of the draw. Prizes with a count of 0 are left out.
 */
export function bonusStatus(enrolments: { status: string; paid: number }[], rule: BonusRule, rewards: BonusRewards): PrizeStatus[] {
  const counts = enrolments.filter((e) => e.status !== "DEFAULTED").map((e) => e.paid);
  const paid = rule.scope === "CUMULATIVE" ? counts.reduce((t, n) => t + n, 0) : Math.max(0, ...counts);
  const prize = (p: BonusPrize, count: number, needed: number): PrizeStatus => ({
    prize: p,
    count,
    needed,
    paid: Math.min(paid, needed),
    remaining: Math.max(0, needed - paid),
    unlocked: paid >= needed,
  });
  return [prize("SCOOTER", rewards.scooters, rule.scooter), prize("GOLD_CHAIN", rewards.goldChains, rule.goldChain)].filter((p) => p.count > 0);
}
