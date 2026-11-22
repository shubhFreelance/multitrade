import { getLocale, getTranslations } from "next-intl/server";
import { ActionForm } from "@/components/action-form";
import { Figures, MemberRow, PeriodTabs } from "@/components/network";
import { formatMonthYear } from "@/lib/dates";
import { formatPaise } from "@/lib/money";
import { getMyNetwork } from "@/server/network";
import { requirePageUser } from "@/server/session";
import { recordCashAction } from "../actions";

export default async function AgentMembers({ searchParams }: PageProps<"/agent/members">) {
  const t = await getTranslations("agent.members");
  const tn = await getTranslations("network");
  const locale = await getLocale();
  const net = await getMyNetwork(await requirePageUser(["AGENT"]), (await searchParams).period);
  const dueNow = net.members.filter((e) => e.summary.dueNowCount > 0);
  const upToDate = net.members.filter((e) => e.summary.dueNowCount === 0);

  const row = (e: (typeof net.members)[number]) => (
    <MemberRow key={e.id} e={e} period={net.period} href={`/agent/members/${e.id}`}>
      {e.summary.next && (
        <ActionForm
          action={recordCashAction.bind(null, e.summary.next.id!)}
          submitLabel={t("recordCash", { amount: formatPaise(e.summary.next.amount), month: formatMonthYear(e.summary.next.dueDate, locale) })}
          confirm={t("confirmCash", { amount: formatPaise(e.summary.next.amount), name: e.member.name, month: formatMonthYear(e.summary.next.dueDate, locale) })}
          buttonClassName="h-11 w-full bg-card text-base text-primary ring-1 ring-primary hover:bg-mist"
        />
      )}
    </MemberRow>
  );

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-5">
      <h1 className="text-[28px] leading-tight font-semibold">{t("title")}</h1>
      <PeriodTabs current={net.period} base="/agent/members" />
      <Figures
        items={[
          [tn("people"), String(net.totals.people)],
          [tn("schemes"), String(net.totals.enrolments)],
          [tn("joinedIn", { period: net.period }), String(net.totals.joined)],
          [tn("commissionIn", { period: net.period }), formatPaise(net.totals.commission)],
        ]}
      />
      {net.members.length === 0 ? (
        <p className="rounded-2xl bg-card p-4">{t("empty")}</p>
      ) : (
        <>
          {dueNow.length > 0 && (
            <section aria-labelledby="due-now">
              <h2 id="due-now" className="border-b-2 border-due pb-1 text-lg font-semibold">
                {t("dueNow", { count: dueNow.length })}
              </h2>
              <ul className="mt-3 flex flex-col gap-3">{dueNow.map(row)}</ul>
            </section>
          )}
          {upToDate.length > 0 && (
            <section aria-labelledby="up-to-date">
              <h2 id="up-to-date" className="border-b-2 border-paid pb-1 text-lg font-semibold">
                {t("upToDate", { count: upToDate.length })}
              </h2>
              <ul className="mt-3 flex flex-col gap-3">{upToDate.map(row)}</ul>
            </section>
          )}
        </>
      )}
    </div>
  );
}
