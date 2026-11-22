import { Lock, LockOpen } from "lucide-react";
import { getTranslations } from "next-intl/server";
import type { PrizeStatus } from "@/shared/bonus";

/** The bonus draw on pink glass: one row per prize, a chain of paid months ending in a lock that opens at the target. */
export async function BonusCard({ prizes }: { prizes: (PrizeStatus & { won?: boolean })[] }) {
  const t = await getTranslations("bonus");
  if (prizes.length === 0) return null;

  return (
    <section id="bonus" aria-labelledby="bonus-title" className="glass glass-pink p-5">
      <h2 id="bonus-title" className="text-[22px] leading-tight font-semibold tracking-tight">
        {t("title")}
      </h2>
      <p className="mt-1 text-white/85">{t("intro")}</p>
      <ul className="mt-2 flex flex-col divide-y divide-white/20">
        {prizes.map((p) => {
          const Icon = p.unlocked ? LockOpen : Lock;
          return (
            <li key={p.prize} className="flex flex-col gap-2.5 py-4">
              <p className="text-lg font-semibold">{t(p.prize, { count: p.count })}</p>
              <div className="flex items-center gap-1" aria-hidden>
                {Array.from({ length: p.needed }, (_, i) => (
                  <span key={i} className={`h-2.5 flex-1 rounded-full ${i < p.paid ? "bg-white" : "bg-white/25"}`} />
                ))}
                <span className={`ml-1 grid size-10 shrink-0 place-items-center rounded-full ${p.unlocked ? "bg-white text-[#c02c72]" : "bg-white/20 ring-1 ring-white/35"}`}>
                  <Icon className="size-[18px]" strokeWidth={2.25} />
                </span>
              </div>
              <p className={p.unlocked ? "font-semibold" : "text-white/90"}>
                {p.won ? t(`won.${p.prize}`) : p.unlocked ? t("unlocked") : t("progress", { paid: p.paid, needed: p.needed, remaining: p.remaining })}
              </p>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
