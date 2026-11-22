import { Boxes, UserCheck, UserRound, Users } from "lucide-react";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { DotRhythm } from "@/components/dot-rhythm";
import { Glass, schemeTone } from "@/components/glass";
import { PeriodTabs } from "@/components/network";
import { Ticks } from "@/components/tracker/beads";
import { NextDue } from "@/components/tracker/next-due";
import { Avatar, Chip, PageHeader } from "@/components/ui-bits";
import { formatDay, formatMonthShort } from "@/lib/dates";
import { formatPaise } from "@/lib/money";
import { membersOverview, networkOverview } from "@/server/network";
import { requirePageUser } from "@/server/session";
import { adminRoles } from "@/shared/auth";
import { agentFilterInput, agentFilters, memberSources, type Period } from "@/shared/network";
import { todayInIndia } from "@/shared/tracker";

type Series = { keys: string[]; counts: number[]; totals: number[] };

/** Chart labels and hover text for a period's buckets: days ("16", "Mon") or months ("Dec"). */
function chartText(series: Series, period: Period, locale: string, value: (i: number) => string) {
  const name = (k: string) =>
    period === "all" ? formatMonthShort(`${k}-01`, locale) : period === "week" ? new Intl.DateTimeFormat(locale === "hi" ? "hi-IN" : "en-IN", { weekday: "short", timeZone: "UTC" }).format(new Date(k)) : String(Number(k.slice(8)));
  const k = series.keys;
  return {
    labels: [name(k[0]), name(k[Math.floor(k.length / 2)]), name(k.at(-1)!)] as [string, string, string],
    tips: k.map((key, i) => `${period === "all" ? formatMonthShort(`${key}-01`, locale) : formatDay(key, locale)}: ${value(i)}`),
  };
}

/** A pill tab row: big ones for Agents / Members, small ones for filters. */
function Tabs({ items, label, size = "lg" }: { items: { href: string; text: React.ReactNode; current: boolean }[]; label: string; size?: "lg" | "sm" }) {
  return (
    <nav aria-label={label} className={`flex flex-wrap gap-1.5 ${size === "lg" ? "self-stretch rounded-full bg-card p-1.5 sm:self-start" : ""}`}>
      {items.map((it) => (
        <Link
          key={it.href}
          href={it.href}
          aria-current={it.current ? "page" : undefined}
          className={`flex items-center justify-center gap-2 rounded-full font-semibold transition-colors ${
            size === "lg"
              ? "min-h-12 flex-1 px-6 text-[17px] text-muted-foreground aria-[current=page]:bg-primary aria-[current=page]:text-primary-foreground sm:flex-none"
              : "min-h-10 bg-card px-4 text-[15px] text-muted-foreground hover:text-foreground aria-[current=page]:bg-primary aria-[current=page]:text-primary-foreground"
          }`}
        >
          {it.text}
        </Link>
      ))}
    </nav>
  );
}

export default async function NetworkPage({ searchParams }: PageProps<"/admin/network">) {
  const t = await getTranslations("network");
  const locale = await getLocale();
  const user = await requirePageUser(adminRoles);
  const sp = await searchParams;
  const view = sp.view === "members" ? "members" : "agents";
  const period = typeof sp.period === "string" ? sp.period : undefined;

  return (
    <div className="flex flex-col gap-5 lg:gap-6">
      <PageHeader tone="blue" icon={Boxes} title={t("adminTitle")} intro={t("adminIntro")} />
      <Tabs
        label={t("viewLabel")}
        items={[
          { href: `/admin/network?view=agents${period ? `&period=${period}` : ""}`, text: <><Users aria-hidden className="size-5" />{t("view.agents")}</>, current: view === "agents" },
          { href: `/admin/network?view=members${period ? `&period=${period}` : ""}`, text: <><UserRound aria-hidden className="size-5" />{t("view.members")}</>, current: view === "members" },
        ]}
      />
      {view === "agents" ? <AgentsView period={period} status={sp.status} locale={locale} /> : <MembersView period={period} source={sp.source} locale={locale} user={user} />}
    </div>
  );
}

async function AgentsView({ period, status, locale }: { period?: string; status: unknown; locale: string }) {
  const t = await getTranslations("network");
  const o = await networkOverview(await requirePageUser(adminRoles), period);
  const filter = agentFilterInput.parse(status);
  const matches = (a: (typeof o.agents)[number], f: string) =>
    f === "all" || (f === "suspended" ? a.suspended : !a.suspended && (f === "approved" ? a.approved : !a.approved));
  const shown = o.agents.filter((a) => matches(a, filter));
  const agentMembers = o.agents.reduce((s, a) => s + a.members, 0);
  const agentJoined = o.agents.reduce((s, a) => s + a.joined, 0);
  const collected = o.collectedSeries.totals.reduce((s, v) => s + v, 0);
  const chart = chartText(o.collectedSeries, o.period, locale, (i) => formatPaise(o.collectedSeries.totals[i]));
  const inPeriod = t(`period.in.${o.period}`);

  return (
    <>
      <PeriodTabs current={o.period} base={`/admin/network?view=agents&status=${filter}`} />

      {/* Four cards: three figures and a wide performance chart. */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:gap-4 xl:grid-cols-5">
        <Glass tone="violet" className="flex min-h-44 flex-col justify-end p-5">
          <p className="text-[15px] text-white/85">{t("cards.agents")}</p>
          <p className="text-[40px] leading-none font-semibold tracking-tight tabular-nums">{o.agents.length}</p>
          <p className="mt-1 text-[14px] text-white/85">{t("cards.agentsJoined", { count: o.agentsJoined, period: inPeriod })}</p>
        </Glass>
        <Glass tone="blue" className="flex min-h-44 flex-col justify-end p-5">
          <p className="text-[15px] text-white/85">{t("cards.enrolledByAgents")}</p>
          <p className="text-[40px] leading-none font-semibold tracking-tight tabular-nums">{agentMembers}</p>
          <p className="mt-1 text-[14px] text-white/85">{t("cards.schemesJoined", { count: agentJoined, period: inPeriod })}</p>
        </Glass>
        <Glass tone="sunrise" className="col-span-2 sm:col-span-1 flex min-h-44 flex-col justify-end p-5">
          <p className="text-[15px] text-white/85">{t("commissionIn", { period: o.period })}</p>
          <p className="text-[34px] leading-none font-semibold tracking-tight tabular-nums">{formatPaise(o.totals.commission)}</p>
          <p className="mt-1 text-[14px] text-white/85">{t("cards.notPaidYet", { amount: formatPaise(o.totals.unpaid) })}</p>
        </Glass>
        <Glass tone="pink" className="col-span-2 flex min-h-44 flex-col justify-between gap-3 p-5 sm:col-span-3 xl:col-span-2">
          <div>
            <p className="text-[15px] text-white/85">{t("cards.collectedThroughAgents", { period: o.period })}</p>
            <p className="text-[34px] leading-none font-semibold tracking-tight tabular-nums">{formatPaise(collected)}</p>
          </div>
          <DotRhythm values={o.collectedSeries.totals} rows={6} labels={chart.labels} tips={chart.tips} />
        </Glass>
      </div>

      <Tabs
        size="sm"
        label={t("filterLabel")}
        items={agentFilters.map((f) => ({
          href: `/admin/network?view=agents&status=${f}&period=${o.period}`,
          text: (
            <>
              {t(`filter.${f}`)}
              <span className="tabular-nums opacity-70">{o.agents.filter((a) => matches(a, f)).length}</span>
            </>
          ),
          current: f === filter,
        }))}
      />

      {shown.length === 0 ? (
        <p className="rounded-[28px] bg-card p-5 text-muted-foreground">{t("noAgents")}</p>
      ) : (
        <ul className="grid items-start gap-3 lg:grid-cols-2 lg:gap-4 2xl:grid-cols-3">
          {shown.map((a) => (
            <li key={a.id}>
              <Link href={`/admin/network/${a.id}?period=${o.period}`} className="lift flex flex-col gap-4 rounded-[28px] bg-card p-5">
                <div className="flex items-center gap-3">
                  <Avatar name={a.name} tint={a.suspended ? "coral" : a.approved ? "violet" : "amber"} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-lg leading-tight font-semibold">{a.name}</p>
                    <p className="text-[15px] text-muted-foreground">{t("agentLine", { panchayat: a.panchayat, phone: a.phone })}</p>
                  </div>
                  <Chip tint={a.suspended ? "coral" : a.approved ? "sunrise" : "amber"}>{t(`filter.${a.suspended ? "suspended" : a.approved ? "approved" : "waiting"}`)}</Chip>
                </div>
                <dl className="grid grid-cols-3 gap-2">
                  {(
                    [
                      [t("members"), String(a.members), "violet"],
                      [t("collectedIn", { period: o.period }), formatPaise(a.collected), "blue"],
                      [t("commissionIn", { period: o.period }), formatPaise(a.commission), "sunrise"],
                    ] as const
                  ).map(([k, v, tint]) => (
                    <div key={k} className={`tint-${tint} flex flex-col-reverse justify-end gap-0.5 rounded-2xl px-3 py-2.5`}>
                      <dt className="text-[13px] leading-snug text-foreground/70">{k}</dt>
                      <dd className="text-tint text-lg font-semibold tabular-nums">{v}</dd>
                    </div>
                  ))}
                </dl>
                <p className="text-[14px] text-muted-foreground">
                  {t("agentMoney", { unpaid: formatPaise(a.unpaid), paidOut: formatPaise(a.paidOut), day: formatDay(todayInIndia(a.joinedAt), locale) })}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

async function MembersView({ period, source, locale, user }: { period?: string; source: unknown; locale: string; user: Awaited<ReturnType<typeof requirePageUser>> }) {
  const t = await getTranslations("network");
  const tt = await getTranslations("tracker");
  const m = await membersOverview(user, period, source);
  const chart = chartText(m.joinedSeries, m.period, locale, (i) => t("cards.schemesCount", { count: m.joinedSeries.counts[i] }));
  const inPeriod = t(`period.in.${m.period}`);

  return (
    <>
      <PeriodTabs current={m.period} base={`/admin/network?view=members&source=${m.source}`} />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:gap-4 xl:grid-cols-5">
        <Glass tone="violet" className="flex min-h-44 flex-col justify-end p-5">
          <p className="text-[15px] text-white/85">{t("members")}</p>
          <p className="text-[40px] leading-none font-semibold tracking-tight tabular-nums">{m.totals.people}</p>
          <p className="mt-1 text-[14px] text-white/85">{t("cards.schemesJoined", { count: m.totals.joined, period: inPeriod })}</p>
        </Glass>
        <Glass tone="peach" className="flex min-h-44 flex-col justify-end p-5">
          <p className="text-[15px] text-white/85">{t("source.direct")}</p>
          <p className="text-[40px] leading-none font-semibold tracking-tight tabular-nums">{m.totals.direct}</p>
          <p className="mt-1 text-[14px] text-white/85">{t("cards.schemesCount", { count: m.totals.direct })}</p>
        </Glass>
        <Glass tone="blue" className="col-span-2 sm:col-span-1 flex min-h-44 flex-col justify-end p-5">
          <p className="text-[15px] text-white/85">{t("source.agent")}</p>
          <p className="text-[40px] leading-none font-semibold tracking-tight tabular-nums">{m.totals.throughAgents}</p>
          <p className="mt-1 text-[14px] text-white/85">{t("cards.collected", { amount: formatPaise(m.totals.collected), period: inPeriod })}</p>
        </Glass>
        <Glass tone="sunrise" className="col-span-2 flex min-h-44 flex-col justify-between gap-3 p-5 sm:col-span-3 xl:col-span-2">
          <div>
            <p className="text-[15px] text-white/85">{t("cards.joinedOverTime", { period: m.period })}</p>
            <p className="text-[34px] leading-none font-semibold tracking-tight tabular-nums">{m.joinedSeries.counts.reduce((s, v) => s + v, 0)}</p>
          </div>
          <DotRhythm values={m.joinedSeries.counts} rows={6} labels={chart.labels} tips={chart.tips} />
        </Glass>
      </div>

      <Tabs
        size="sm"
        label={t("sourceLabel")}
        items={memberSources.map((s) => ({
          href: `/admin/network?view=members&source=${s}&period=${m.period}`,
          text: (
            <>
              {s === "direct" ? <UserRound aria-hidden className="size-4" /> : <UserCheck aria-hidden className="size-4" />}
              {t(`source.${s}`)}
              <span className="tabular-nums opacity-70">{s === "direct" ? m.totals.direct : m.totals.throughAgents}</span>
            </>
          ),
          current: s === m.source,
        }))}
      />

      {m.members.length === 0 ? (
        <p className="rounded-[28px] bg-card p-5 text-muted-foreground">{t("noMembersHere")}</p>
      ) : (
        <ul className="grid items-start gap-3 lg:grid-cols-2 lg:gap-4 2xl:grid-cols-3">
          {m.members.map((e) => {
            const tone = schemeTone[e.scheme.code] ?? "violet";
            return (
              <li key={e.id}>
                <Link href={`/admin/network/members/${e.id}`} className="lift flex flex-col gap-3 rounded-[28px] bg-card p-5">
                  <div className="flex items-center gap-3">
                    <Avatar name={e.member.name} tint={tone} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-lg leading-tight font-semibold">{e.member.name}</p>
                      <p className="text-[15px] text-muted-foreground">{e.member.phone}</p>
                    </div>
                    <span className="shrink-0 rounded-full bg-secondary px-2.5 py-1 text-[13px] font-semibold tracking-wide text-muted-foreground">{e.tokenNumber}</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <Chip tint={tone}>{locale === "hi" ? e.scheme.nameHi : e.scheme.nameEn}</Chip>
                    {e.agent ? <Chip tint="blue">{t("enrolledByShort", { name: e.agent.name })}</Chip> : <Chip tint="peach">{t("source.direct")}</Chip>}
                  </div>
                  <Ticks slots={e.summary.slots} />
                  <div className="text-[15px]">
                    <p className="text-muted-foreground">
                      {tt("paidOf", { paid: e.summary.paidCount, total: e.summary.total })} {t("joinedOn", { day: formatDay(todayInIndia(e.createdAt), locale) })}
                    </p>
                    <NextDue summary={e.summary} />
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
