// Bonus rewards (scooters, gold chain): locked until enough confirmed payments. Pure: shared by web, API and the mobile app.

export type BonusRule = { paidInstallments: number; scope: "ENROLMENT" | "CUMULATIVE" };
export type BonusRewards = { scooters: number; goldChains: number };
export type BonusStatus = { unlocked: boolean; paid: number; needed: number; remaining: number; rewards: BonusRewards };

export const defaultBonusRule: BonusRule = { paidInstallments: 6, scope: "ENROLMENT" };
export const defaultBonusRewards: BonusRewards = { scooters: 5, goldChains: 1 };

/**
 * `paid` per enrolment counts PAID installments only: pending cash and waived months don't count.
 * Defaulted enrolments never count, since they are left out of the draw.
 */
export function bonusStatus(enrolments: { status: string; paid: number }[], rule: BonusRule, rewards: BonusRewards): BonusStatus {
  const counts = enrolments.filter((e) => e.status !== "DEFAULTED").map((e) => e.paid);
  const paid = rule.scope === "CUMULATIVE" ? counts.reduce((t, n) => t + n, 0) : Math.max(0, ...counts);
  const needed = rule.paidInstallments;
  return { unlocked: paid >= needed, paid: Math.min(paid, needed), needed, remaining: Math.max(0, needed - paid), rewards };
}
