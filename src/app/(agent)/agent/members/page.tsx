import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { ActionForm } from "@/components/action-form";
import { Ticks } from "@/components/tracker/beads";
import { NextDue } from "@/components/tracker/next-due";
import { formatMonthYear } from "@/lib/dates";
import { formatPaise } from "@/lib/money";
import { requirePageUser } from "@/server/session";
import { listAgentEnrolments, type EnrolmentView } from "@/server/tracker";
import { recordCashAction } from "../actions";

export default async function AgentMembers() {
  const t = await getTranslations("agent.members");
  const tc = await getTranslations("common");
  const tt = await getTranslations("tracker");
  const locale = await getLocale();
  const enrolments = await listAgentEnrolments(await requirePageUser(["AGENT"]));
  const dueNow = enrolments.filter((e) => e.summary.dueNowCount > 0);
  const upToDate = enrolments.filter((e) => e.summary.dueNowCount === 0);

  const row = (e: EnrolmentView) => (
    <li key={e.id} className="flex flex-col gap-2 py-3.5">
      <div className="flex items-baseline justify-between gap-3">
        <span className="min-w-0 truncate text-lg font-semibold">{e.member.name}</span>
        <span className="shrink-0 font-bold tracking-wide text-muted-foreground [font-stretch:75%]">{e.tokenNumber}</span>
      </div>
      <Ticks slots={e.summary.slots} />
      <div className="flex items-end justify-between gap-3">
        <div className="text-[15px]">
          <p className="text-muted-foreground">
            {locale === "hi" ? e.scheme.nameHi : e.scheme.nameEn}, {tt("paidOf", { paid: e.summary.paidCount, total: e.summary.total })}
          </p>
          <NextDue summary={e.summary} />
        </div>
        <a
          href={`tel:+91${e.member.phone}`}
          className="shrink-0 rounded-lg px-3 py-2 font-medium text-primary ring-1 ring-input hover:bg-mist"
          aria-label={t("callName", { name: e.member.name })}
        >
          {t("call")}
        </a>
      </div>
      {e.summary.next && (
        <ActionForm
          action={recordCashAction.bind(null, e.summary.next.id!)}
          submitLabel={t("recordCash", { amount: formatPaise(e.summary.next.amount), month: formatMonthYear(e.summary.next.dueDate, locale) })}
          confirm={t("confirmCash", { amount: formatPaise(e.summary.next.amount), name: e.member.name, month: formatMonthYear(e.summary.next.dueDate, locale) })}
          buttonClassName="h-11 w-full bg-card text-base text-primary ring-1 ring-primary hover:bg-mist"
        />
      )}
    </li>
  );

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-6">
      <Link href="/agent" className="text-sm hover:underline">
        ← {tc("back")}
      </Link>
      <h1 className="text-[28px] leading-tight font-semibold">{t("title")}</h1>
      {enrolments.length === 0 ? (
        <p className="rounded-2xl bg-card p-4 ring-1 ring-border">{t("empty")}</p>
      ) : (
        <>
          {dueNow.length > 0 && (
            <section aria-labelledby="due-now">
              <h2 id="due-now" className="border-b-2 border-due pb-1 text-lg font-semibold">
                {t("dueNow", { count: dueNow.length })}
              </h2>
              <ul className="divide-y divide-border">{dueNow.map(row)}</ul>
            </section>
          )}
          {upToDate.length > 0 && (
            <section aria-labelledby="up-to-date">
              <h2 id="up-to-date" className="border-b-2 border-paid pb-1 text-lg font-semibold">
                {t("upToDate", { count: upToDate.length })}
              </h2>
              <ul className="divide-y divide-border">{upToDate.map(row)}</ul>
            </section>
          )}
        </>
      )}
    </div>
  );
}
