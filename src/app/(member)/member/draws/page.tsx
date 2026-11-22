import { getLocale, getTranslations } from "next-intl/server";
import { formatDay } from "@/lib/dates";
import { listBonusDraws } from "@/server/bonus";
import { listMyDraws } from "@/server/draws";
import { requirePageUser } from "@/server/session";
import { todayInIndia } from "@/shared/tracker";

export default async function MyDrawsPage() {
  const t = await getTranslations("draws");
  const tb = await getTranslations("bonus");
  const tbd = await getTranslations("bonusDraw");
  const locale = await getLocale();
  const user = await requirePageUser(["MEMBER"]);
  const [draws, bonusDraws] = await Promise.all([listMyDraws(user), listBonusDraws(user)]);

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-5">
      <div>
        <h1 className="text-[28px] leading-tight font-semibold">{t("memberTitle")}</h1>
        <p className="text-muted-foreground">{t("memberIntro")}</p>
      </div>
      {bonusDraws.map((d) => {
        const won = d.winners.some((w) => w.mine);
        return (
          <article key={d.id} className={`rounded-2xl p-4 ring-1 ${won ? "bg-paid/8 ring-paid/40" : "bg-card ring-border"}`}>
            <h2 className="text-lg font-semibold">{tbd("memberHeading", { prize: tb(d.prize, { count: d.winners.length }) })}</h2>
            <p className="text-muted-foreground">{t("ranOn", { day: formatDay(todayInIndia(d.createdAt), locale), eligible: d.eligibleCount })}</p>
            {won && <p className="mt-2 font-semibold text-paid">{tbd(`youWon.${d.prize}`)}</p>}
            <ul className="mt-3 flex flex-wrap gap-2">
              {d.winners.map((w) => (
                <li key={w.token} className={`rounded-full px-3 py-1 font-bold tracking-wider [font-stretch:75%] ${w.mine ? "bg-paid text-white" : "bg-mist"}`}>
                  {w.token}
                </li>
              ))}
            </ul>
            <p className="mt-3 text-[13px] break-all text-muted-foreground">
              {t("seed")} {d.seed}
            </p>
          </article>
        );
      })}
      {draws.length === 0 && bonusDraws.length === 0 && <p className="rounded-2xl bg-card p-4">{t("none")}</p>}
      {draws.map((d) => {
        const won = d.winners.some((w) => w.mine);
        return (
          <article key={d.id} className={`rounded-2xl p-4 ring-1 ${won ? "bg-paid/8 ring-paid/40" : "bg-card ring-border"}`}>
            <h2 className="text-lg font-semibold">
              {t("monthDraw", { month: d.monthNo })} <span className="font-normal">{locale === "hi" ? d.scheme.nameHi : d.scheme.nameEn}</span>
            </h2>
            <p className="text-muted-foreground">{t("ranOn", { day: formatDay(todayInIndia(d.createdAt), locale), eligible: d.eligibleCount })}</p>
            {won && <p className="mt-2 font-semibold text-paid">{t("youWon")}</p>}
            <ul className="mt-3 flex flex-wrap gap-2">
              {d.winners.map((w) => (
                <li key={w.token} className={`rounded-full px-3 py-1 font-bold tracking-wider [font-stretch:75%] ${w.mine ? "bg-paid text-white" : "bg-mist"}`}>
                  {w.token}
                </li>
              ))}
            </ul>
            <p className="mt-3 text-[13px] break-all text-muted-foreground">
              {t("seed")} {d.seed}
            </p>
          </article>
        );
      })}
    </div>
  );
}
