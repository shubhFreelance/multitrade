import { Lock, LockOpen } from "lucide-react";
import { getTranslations } from "next-intl/server";
import type { PrizeStatus } from "@/shared/bonus";

/** The bonus draw: one row per prize, a chain of paid months ending in a lock that opens at the target. */
export async function BonusCard({ prizes }: { prizes: PrizeStatus[] }) {
  const t = await getTranslations("bonus");
  if (prizes.length === 0) return null;

  return (
    <section aria-labelledby="bonus-title" className="rounded-2xl bg-card p-4 ring-1 ring-border">
      <h2 id="bonus-title" className="text-lg font-semibold">
        {t("title")}
      </h2>
      <p className="text-muted-foreground">{t("intro")}</p>
      <ul className="mt-1 flex flex-col divide-y divide-border">
        {prizes.map((p) => {
          const Icon = p.unlocked ? LockOpen : Lock;
          return (
            <li key={p.prize} className="flex flex-col gap-2 py-3">
              <p className="font-semibold">{t(p.prize, { count: p.count })}</p>
              <div className="flex items-center gap-1" aria-hidden>
                {Array.from({ length: p.needed }, (_, i) => (
                  <span key={i} className={`h-2.5 flex-1 rounded-full ${i < p.paid ? "bg-paid" : "bg-mist"}`} />
                ))}
                <span className={`ml-1 grid size-9 shrink-0 place-items-center rounded-full ${p.unlocked ? "bg-paid text-white" : "bg-mist text-muted-foreground"}`}>
                  <Icon className="size-[18px]" strokeWidth={2.25} />
                </span>
              </div>
              <p className={p.unlocked ? "font-medium text-paid" : ""}>
                {p.unlocked ? t("unlocked") : t("progress", { paid: p.paid, needed: p.needed, remaining: p.remaining })}
              </p>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
