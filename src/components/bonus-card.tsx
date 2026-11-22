import { Lock, LockOpen } from "lucide-react";
import { getTranslations } from "next-intl/server";
import type { BonusStatus } from "@/shared/bonus";

/** The bonus draw (scooters, gold chain): a chain of paid months that ends in a lock, which opens at the target. */
export async function BonusCard({ b }: { b: BonusStatus }) {
  const t = await getTranslations("bonus");
  const prizes = t("prizes", { scooters: b.rewards.scooters, chains: b.rewards.goldChains });
  const Icon = b.unlocked ? LockOpen : Lock;

  return (
    <section aria-labelledby="bonus-title" className={`rounded-2xl p-4 ring-1 ${b.unlocked ? "bg-paid/8 ring-paid/40" : "bg-card ring-border"}`}>
      <h2 id="bonus-title" className="text-lg font-semibold">
        {b.unlocked ? t("unlockedTitle") : t("lockedTitle")}
      </h2>
      <p className="text-muted-foreground">{prizes}</p>

      <div className="mt-3 flex items-center gap-1.5" aria-hidden>
        {Array.from({ length: b.needed }, (_, i) => (
          <span key={i} className={`h-2.5 flex-1 rounded-full ${i < b.paid ? "bg-paid" : "bg-mist"}`} />
        ))}
        <span className={`ml-1 grid size-9 shrink-0 place-items-center rounded-full ${b.unlocked ? "bg-paid text-white" : "bg-mist text-muted-foreground"}`}>
          <Icon className="size-[18px]" strokeWidth={2.25} />
        </span>
      </div>

      <p className={`mt-2 ${b.unlocked ? "font-medium text-paid" : ""}`}>
        {b.unlocked ? t("unlocked") : t("progress", { paid: b.paid, needed: b.needed, remaining: b.remaining })}
      </p>
    </section>
  );
}
