// Pieces shared by the agent's and the super admin's views of who enrolled whom.
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { schemeTone } from "@/components/glass";
import { Beads, Ticks } from "@/components/tracker/beads";
import { NextDue } from "@/components/tracker/next-due";
import { formatDay, formatMonthYear } from "@/lib/dates";
import { formatPaise } from "@/lib/money";
import type { getNetworkEnrolment } from "@/server/network";
import type { EnrolmentView } from "@/server/tracker";
import { periods, type Period } from "@/shared/network";
import { todayInIndia } from "@/shared/tracker";

/** This week / this month / all time, as links that keep the rest of the page. */
export async function PeriodTabs({ current, base }: { current: Period; base: string }) {
  const t = await getTranslations("network.period");
  return (
    <nav aria-label={t("label")} className="flex gap-1 self-stretch rounded-full bg-card p-1 sm:self-start">
      {periods.map((p) => (
        <Link
          key={p}
          href={`${base}?period=${p}`}
          aria-current={p === current ? "page" : undefined}
          className="flex min-h-11 flex-1 items-center justify-center rounded-full px-4 text-[15px] font-medium text-muted-foreground aria-[current=page]:bg-primary aria-[current=page]:text-primary-foreground sm:flex-none"
        >
          {t(p)}
        </Link>
      ))}
    </nav>
  );
}

/** A few figures side by side, each with its label underneath. */
export function Figures({ items }: { items: [label: string, value: string][] }) {
  return (
    <dl className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
      {items.map(([label, value]) => (
        <div key={label} className="flex flex-col-reverse justify-end gap-1 rounded-3xl bg-card px-4 py-4">
          <dt className="text-[14px] leading-snug text-muted-foreground">{label}</dt>
          <dd className="text-[26px] leading-none font-semibold tracking-tight tabular-nums">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

type Member = EnrolmentView & { commission: { period: number; total: number } };

/** One enrolled member: progress, commission and a link to the details. `children` holds actions such as Record cash. */
export async function MemberRow({ e, period, href, children }: { e: Member; period: Period; href: string; children?: React.ReactNode }) {
  const t = await getTranslations("network");
  const tt = await getTranslations("tracker");
  const locale = await getLocale();
  return (
    <li className="flex flex-col gap-2.5 rounded-[28px] bg-card p-5">
      <div className="flex items-baseline justify-between gap-3">
        <Link href={href} className="min-w-0 truncate text-lg font-semibold underline-offset-4 hover:underline">
          {e.member.name}
        </Link>
        <span className="shrink-0 font-bold tracking-wide text-muted-foreground [font-stretch:75%]">{e.tokenNumber}</span>
      </div>
      <Ticks slots={e.summary.slots} />
      <div className="text-[15px]">
        <p className="text-muted-foreground">
          {locale === "hi" ? e.scheme.nameHi : e.scheme.nameEn}, {tt("paidOf", { paid: e.summary.paidCount, total: e.summary.total })}{" "}
          {t("joinedOn", { day: formatDay(todayInIndia(e.createdAt), locale) })}
        </p>
        <NextDue summary={e.summary} />
        <p>
          {t("commissionLine", {
            period,
            label: period === "all" ? "" : t(`period.in.${period}`),
            amount: formatPaise(e.commission.period),
            total: formatPaise(e.commission.total),
          })}
        </p>
      </div>
      <div className="flex gap-2">
        <Link href={href} className="flex min-h-11 flex-1 items-center justify-center rounded-lg font-medium text-primary ring-1 ring-input hover:bg-mist">
          {t("details")}
        </Link>
        <a
          href={`tel:+91${e.member.phone}`}
          className="flex min-h-11 items-center rounded-lg px-4 font-medium text-primary ring-1 ring-input hover:bg-mist"
          aria-label={t("callName", { name: e.member.name })}
        >
          {t("call")}
        </a>
      </div>
      {children}
    </li>
  );
}

/** Everything about one enrolled member: the 12 months and each commission line. */
export async function MemberDetail({ e, children }: { e: Awaited<ReturnType<typeof getNetworkEnrolment>>; children?: React.ReactNode }) {
  const t = await getTranslations("network");
  const tc = await getTranslations("agent.commission");
  const tt = await getTranslations("tracker");
  const ts = await getTranslations("member.status");
  const locale = await getLocale();
  const total = e.commission.filter((l) => l.status !== "REVERSED").reduce((s, l) => s + l.amount, 0);

  return (
    <>
      <article className="overflow-hidden rounded-[28px] bg-card">
        <header className={`glass-${schemeTone[e.scheme.code] ?? "violet"} flex flex-wrap items-end justify-between gap-x-4 gap-y-1 px-5 pt-5 pb-4 text-white`}>
          <h1 className="text-[26px] leading-tight font-semibold tracking-tight">{e.member.name}</h1>
          <p className="rounded-full bg-white/20 px-3 py-1 text-[14px] font-semibold tracking-wide ring-1 ring-white/30">{e.tokenNumber}</p>
        </header>
        <div className="flex flex-col gap-4 px-4 pt-4 pb-4">
          <p className="text-muted-foreground">
            {locale === "hi" ? e.scheme.nameHi : e.scheme.nameEn}, {ts(e.status)}
            <br />
            {t("joinedOn", { day: formatDay(todayInIndia(e.createdAt), locale) })}{" "}
            <a href={`tel:+91${e.member.phone}`} className="font-medium text-foreground underline underline-offset-4">
              {e.member.phone}
            </a>
          </p>
          <Beads slots={e.summary.slots} />
          <div className="flex flex-col gap-0.5">
            <p>
              {tt("paidOf", { paid: e.summary.paidCount, total: e.summary.total })}{" "}
              <span className="font-semibold">{tt("paidSoFar", { amount: formatPaise(e.summary.paidTotal) })}</span>
            </p>
            <NextDue summary={e.summary} />
          </div>
          {children}
        </div>
      </article>

      <section aria-labelledby="lines" className="flex flex-col gap-2">
        <h2 id="lines" className="flex items-baseline justify-between gap-3 text-lg font-semibold">
          {t("commissionFrom")} <span className="tabular-nums">{formatPaise(total)}</span>
        </h2>
        {e.commission.length === 0 ? (
          <p className="text-muted-foreground">{tc("empty")}</p>
        ) : (
          <ul className="divide-y divide-border rounded-2xl bg-card px-4">
            {e.commission.map((l) => (
              <li key={l.id} className="flex items-baseline justify-between gap-3 py-3">
                <div>
                  <p>{formatMonthYear(l.payment!.installment.dueDate.toISOString().slice(0, 10), locale)}</p>
                  <p className="text-[14px] text-muted-foreground">
                    {t("paidOn", { day: formatDay(todayInIndia(l.payment!.paidAt ?? l.createdAt), locale) })}{" "}
                    {l.ruleMissing ? tc("rateMissing") : tc(`status.${l.status}`)}
                  </p>
                </div>
                <span className="font-semibold tabular-nums">{formatPaise(l.amount)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
