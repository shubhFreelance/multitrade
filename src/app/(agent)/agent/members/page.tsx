import { ChevronRight, LayoutGrid, List, Phone, Users } from "lucide-react";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { ActionForm } from "@/components/action-form";
import { schemeTone } from "@/components/glass";
import { Figures, MemberRow, PeriodTabs } from "@/components/network";
import { Ticks } from "@/components/tracker/beads";
import { Avatar, Chip, PageHeader, SectionTitle } from "@/components/ui-bits";
import { formatMonthYear } from "@/lib/dates";
import { formatPaise } from "@/lib/money";
import { getMyNetwork } from "@/server/network";
import { requirePageUser } from "@/server/session";
import { recordCashAction } from "../actions";

type Member = Awaited<ReturnType<typeof getMyNetwork>>["members"][number];

export default async function AgentMembers({ searchParams }: PageProps<"/agent/members">) {
  const t = await getTranslations("agent.members");
  const tn = await getTranslations("network");
  const tt = await getTranslations("tracker");
  const locale = await getLocale();
  const sp = await searchParams;
  const layout = sp.layout === "list" ? "list" : "cards";
  const net = await getMyNetwork(await requirePageUser(["AGENT"]), sp.period);
  const dueNow = net.members.filter((e) => e.summary.dueNowCount > 0);
  const upToDate = net.members.filter((e) => e.summary.dueNowCount === 0);
  const scheme = (e: Member) => (locale === "hi" ? e.scheme.nameHi : e.scheme.nameEn);

  const cash = (e: Member, compact: boolean) =>
    e.summary.next && (
      <ActionForm
        action={recordCashAction.bind(null, e.summary.next.id!)}
        submitLabel={
          compact
            ? t("recordCashShort", { amount: formatPaise(e.summary.next.amount) })
            : t("recordCash", { amount: formatPaise(e.summary.next.amount), month: formatMonthYear(e.summary.next.dueDate, locale) })
        }
        confirm={t("confirmCash", { amount: formatPaise(e.summary.next.amount), name: e.member.name, month: formatMonthYear(e.summary.next.dueDate, locale) })}
        buttonClassName={compact ? "h-10 px-4 text-[14px] font-semibold whitespace-nowrap" : "h-12 w-full text-base font-semibold"}
      />
    );

  /** Where the member stands, in a word or two, coloured like the tracker. */
  const status = (e: Member) => {
    const s = e.summary;
    if (s.dueNowCount > 0) {
      const overdue = s.slots.some((x) => x.state === "OVERDUE");
      return <Chip tint={overdue ? "coral" : "amber"}>{t(overdue ? "list.overdue" : "list.due", { amount: formatPaise(s.dueNowTotal) })}</Chip>;
    }
    if (s.pendingCount > 0) return <Chip tint="blue">{t("list.pending")}</Chip>;
    return <Chip tint="sunrise">{t("list.upToDate")}</Chip>;
  };

  const card = (e: Member) => (
    <MemberRow key={e.id} e={e} period={net.period} href={`/agent/members/${e.id}`}>
      {cash(e, false)}
    </MemberRow>
  );

  /** List format: a table on wide screens, two-line rows on phones. */
  const list = (members: Member[], id: string) => (
    <div className="overflow-hidden rounded-[28px] bg-card">
      <table className="hidden w-full text-left md:table" aria-labelledby={id}>
        <thead className="text-[14px] text-muted-foreground">
          <tr className="border-b">
            <th scope="col" className="py-3 pl-5 font-medium">{t("list.member")}</th>
            <th scope="col" className="py-3 font-medium">{t("list.scheme")}</th>
            <th scope="col" className="py-3 font-medium">{t("list.paid")}</th>
            <th scope="col" className="py-3 font-medium">{t("list.status")}</th>
            <th scope="col" className="py-3 text-right font-medium">{tn("commissionIn", { period: net.period })}</th>
            <th scope="col" className="py-3 pr-5"><span className="sr-only">{t("list.actions")}</span></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {members.map((e) => (
            <tr key={e.id} className="align-middle hover:bg-secondary/60">
              <td className="py-3 pl-5">
                <div className="flex items-center gap-3">
                  <Avatar name={e.member.name} tint={schemeTone[e.scheme.code] ?? "violet"} className="size-10 text-[14px]" />
                  <div className="min-w-0">
                    <Link href={`/agent/members/${e.id}`} className="block truncate font-semibold hover:underline">
                      {e.member.name}
                    </Link>
                    <span className="text-[14px] text-muted-foreground">{e.member.phone}</span>
                  </div>
                </div>
              </td>
              <td className="py-3">
                <Chip tint={schemeTone[e.scheme.code] ?? "violet"}>{scheme(e)}</Chip>
                <span className="mt-1 block text-[13px] font-semibold tracking-wide text-muted-foreground">{e.tokenNumber}</span>
              </td>
              <td className="w-44 py-3 pr-4">
                <Ticks slots={e.summary.slots} />
                <span className="mt-1 block text-[13px] text-muted-foreground">{tt("paidOf", { paid: e.summary.paidCount, total: e.summary.total })}</span>
              </td>
              <td className="py-3">{status(e)}</td>
              <td className="py-3 text-right tabular-nums">
                <span className="font-semibold">{formatPaise(e.commission.period)}</span>
                <span className="block text-[13px] text-muted-foreground">{t("list.inAll", { amount: formatPaise(e.commission.total) })}</span>
              </td>
              <td className="py-3 pr-5 pl-4">
                <div className="flex items-center justify-end gap-2">
                  {cash(e, true)}
                  <a href={`tel:+91${e.member.phone}`} aria-label={tn("callName", { name: e.member.name })} className="grid size-10 place-items-center rounded-full bg-secondary hover:bg-muted">
                    <Phone aria-hidden className="size-4" />
                  </a>
                  <Link href={`/agent/members/${e.id}`} aria-label={`${tn("details")}: ${e.member.name}`} className="grid size-10 place-items-center rounded-full bg-secondary hover:bg-muted">
                    <ChevronRight aria-hidden className="size-5" />
                  </Link>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <ul className="divide-y divide-border md:hidden">
        {members.map((e) => (
          <li key={e.id} className="flex flex-col gap-2 px-4 py-3.5">
            <div className="flex items-center gap-3">
              <Avatar name={e.member.name} tint={schemeTone[e.scheme.code] ?? "violet"} className="size-10 text-[14px]" />
              <Link href={`/agent/members/${e.id}`} className="min-w-0 flex-1">
                <span className="block truncate font-semibold">{e.member.name}</span>
                <span className="block truncate text-[14px] text-muted-foreground">
                  {scheme(e)}, {e.tokenNumber}
                </span>
              </Link>
              <a href={`tel:+91${e.member.phone}`} aria-label={tn("callName", { name: e.member.name })} className="grid size-11 shrink-0 place-items-center rounded-full bg-secondary">
                <Phone aria-hidden className="size-4" />
              </a>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-[14px] text-muted-foreground">{tt("paidOf", { paid: e.summary.paidCount, total: e.summary.total })}</span>
              {status(e)}
            </div>
            {cash(e, true)}
          </li>
        ))}
      </ul>
    </div>
  );

  const group = (members: Member[], id: string) =>
    layout === "list" ? list(members, id) : <ul className="grid items-start gap-3 lg:grid-cols-2 lg:gap-4 2xl:grid-cols-3">{members.map(card)}</ul>;

  return (
    <div className="flex flex-col gap-5 lg:gap-6">
      <PageHeader tone="blue" icon={Users} title={t("title")} />
      <div className="flex flex-wrap items-center justify-end gap-2">
        <PeriodTabs current={net.period} base={`/agent/members?layout=${layout}`} />
        <nav aria-label={t("list.layoutLabel")} className="flex gap-1 rounded-full bg-card p-1">
          {(
            [
              ["cards", LayoutGrid],
              ["list", List],
            ] as const
          ).map(([l, Icon]) => (
            <Link
              key={l}
              href={`/agent/members?layout=${l}&period=${net.period}`}
              aria-current={l === layout ? "page" : undefined}
              className="flex min-h-10 items-center gap-1.5 rounded-full px-3.5 text-[14px] font-medium text-muted-foreground hover:text-foreground aria-[current=page]:bg-primary aria-[current=page]:text-primary-foreground"
            >
              <Icon aria-hidden className="size-4" />
              {t(`list.${l}`)}
            </Link>
          ))}
        </nav>
      </div>
      <Figures
        items={[
          [tn("people"), String(net.totals.people)],
          [tn("schemes"), String(net.totals.enrolments)],
          [tn("joinedIn", { period: net.period }), String(net.totals.joined)],
          [tn("commissionIn", { period: net.period }), formatPaise(net.totals.commission)],
        ]}
      />
      {net.members.length === 0 ? (
        <p className="rounded-[28px] bg-card p-5">{t("empty")}</p>
      ) : (
        <>
          {dueNow.length > 0 && (
            <section aria-labelledby="due-now" className="flex flex-col gap-3">
              <SectionTitle id="due-now" tint="coral">
                {t("dueNow", { count: dueNow.length })}
              </SectionTitle>
              {group(dueNow, "due-now")}
            </section>
          )}
          {upToDate.length > 0 && (
            <section aria-labelledby="up-to-date" className="flex flex-col gap-3">
              <SectionTitle id="up-to-date" tint="sunrise">
                {t("upToDate", { count: upToDate.length })}
              </SectionTitle>
              {group(upToDate, "up-to-date")}
            </section>
          )}
        </>
      )}
    </div>
  );
}
