import { Trophy } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { toneAt, type GlassTone } from "@/components/glass";
import { PageHeader } from "@/components/ui-bits";
import { formatDay } from "@/lib/dates";
import { listBonusDraws } from "@/server/bonus";
import { listMyDraws } from "@/server/draws";
import { requirePageUser } from "@/server/session";
import { todayInIndia } from "@/shared/tracker";

type Card = { id: string; tone: GlassTone; title: string; when: string; seed: string; winners: { token: string; mine: boolean }[]; wonText: string };

export default async function MyDrawsPage() {
  const t = await getTranslations("draws");
  const tb = await getTranslations("bonus");
  const tbd = await getTranslations("bonusDraw");
  const locale = await getLocale();
  const user = await requirePageUser(["MEMBER"]);
  const [draws, bonusDraws] = await Promise.all([listMyDraws(user), listBonusDraws(user)]);
  const when = (d: { createdAt: Date; eligibleCount: number }) => t("ranOn", { day: formatDay(todayInIndia(d.createdAt), locale), eligible: d.eligibleCount });

  // Bonus draws keep their prize's colour (as on the admin page and the bonus card); monthly draws step through the
  // other colours from blue, so the header's violet and neighbouring cards never repeat.
  const cards: Card[] = [
    ...bonusDraws.map((d) => ({
      id: d.id,
      tone: (d.prize === "SCOOTER" ? "pink" : "sunrise") as GlassTone,
      title: tbd("memberHeading", { prize: tb(d.prize, { count: d.winners.length }) }),
      when: when(d),
      seed: d.seed,
      winners: d.winners,
      wonText: tbd(`youWon.${d.prize}`),
    })),
    ...draws.map((d, i) => ({
      id: d.id,
      tone: toneAt(i + 1),
      title: `${t("monthDraw", { month: d.monthNo })}, ${locale === "hi" ? d.scheme.nameHi : d.scheme.nameEn}`,
      when: when(d),
      seed: d.seed,
      winners: d.winners,
      wonText: t("youWon"),
    })),
  ];

  return (
    <div className="flex flex-col gap-5 lg:gap-6">
      <PageHeader tone="violet" icon={Trophy} title={t("memberTitle")} intro={t("memberIntro")} />
      {cards.length === 0 ? (
        <p className="rounded-[28px] bg-card p-5">{t("none")}</p>
      ) : (
        <div className="grid items-start gap-4 md:grid-cols-2 lg:gap-6 2xl:grid-cols-3">
          {cards.map((c) => {
            const won = c.winners.some((w) => w.mine);
            return (
              <article key={c.id} className={`glass glass-${c.tone} flex min-h-56 flex-col gap-4 p-5 lg:p-6`}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-[22px] leading-tight font-semibold tracking-tight">{c.title}</h2>
                    <p className="mt-1 text-white/85">{c.when}</p>
                  </div>
                  <span aria-hidden className="grid size-11 shrink-0 place-items-center rounded-full bg-white/20 ring-1 ring-white/35">
                    <Trophy className="size-5" />
                  </span>
                </div>
                {won && <p className="rounded-2xl bg-white px-4 py-2.5 font-semibold text-foreground">{c.wonText}</p>}
                <ul className="flex flex-wrap gap-2">
                  {c.winners.map((w) => (
                    <li
                      key={w.token}
                      className={`rounded-full px-3 py-1 text-[14px] font-semibold tracking-wide ${w.mine ? "bg-white text-foreground" : "bg-white/20 ring-1 ring-white/35"}`}
                    >
                      {w.token}
                    </li>
                  ))}
                </ul>
                <p className="mt-auto text-[13px] break-all text-white/75">
                  {t("seed")} {c.seed}
                </p>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
