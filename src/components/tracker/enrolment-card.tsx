import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { payAction } from "@/app/(member)/member/actions";
import { ActionForm } from "@/components/action-form";
import { formatMonthYear } from "@/lib/dates";
import { formatPaise } from "@/lib/money";
import type { EnrolmentView } from "@/server/tracker";
import type { SlotState } from "@/shared/tracker";
import { Beads } from "./beads";
import { NextDue } from "./next-due";

const stateText: Record<SlotState, string> = {
  PAID: "text-paid",
  OVERDUE: "text-overdue font-semibold",
  DUE_NOW: "text-due-ink font-semibold",
  UPCOMING: "text-muted-foreground",
  WAIVED: "text-muted-foreground",
};

/** A member's passbook page for one enrolment. */
export async function EnrolmentCard({ e, canPay }: { e: EnrolmentView; canPay: boolean }) {
  const locale = await getLocale();
  const t = await getTranslations("tracker");
  const s = e.summary;

  return (
    <article className="overflow-hidden rounded-2xl bg-card ring-1 ring-border">
      <header className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 bg-primary px-4 pt-3 pb-2.5 text-primary-foreground">
        <h2 className="text-xl font-semibold">{locale === "hi" ? e.scheme.nameHi : e.scheme.nameEn}</h2>
        <p className="text-lg font-bold tracking-wider [font-stretch:75%]">
          <span className="sr-only">{t("token")} </span>
          {e.tokenNumber}
        </p>
      </header>

      <div className="flex flex-col gap-4 px-4 pt-4 pb-3">
        <Beads slots={s.slots} />
        <div className="flex flex-col gap-0.5">
          <p>
            {t("paidOf", { paid: s.paidCount, total: s.total })}{" "}
            <span className="font-semibold">{t("paidSoFar", { amount: formatPaise(s.paidTotal) })}</span>
          </p>
          <NextDue summary={s} />
        </div>

        {canPay && s.next && (
          <ActionForm
            action={payAction.bind(null, s.next.id!)}
            submitLabel={t("pay", { amount: formatPaise(s.next.amount), month: formatMonthYear(s.next.dueDate, locale) })}
            buttonClassName="h-14 w-full text-lg font-semibold"
          />
        )}

        <details className="group border-t border-border pt-2">
          <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between font-medium [&::-webkit-details-marker]:hidden">
            {t("monthByMonth")}
            <svg aria-hidden viewBox="0 0 20 20" className="size-5 text-muted-foreground transition-transform group-open:rotate-180 motion-reduce:transition-none">
              <path d="M5 8l5 5 5-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </summary>
          <ol className="flex flex-col divide-y divide-border pb-1">
            {s.slots.map((m) => (
              <li key={m.monthNo} className="flex items-baseline justify-between gap-3 py-2">
                <span>{formatMonthYear(m.dueDate, locale)}</span>
                <span className="flex items-baseline gap-3">
                  <span className="tabular-nums">{formatPaise(m.amount)}</span>
                  {m.receiptId ? (
                    <Link href={`/member/receipts/${m.receiptId}`} className={`w-24 text-right underline underline-offset-4 ${stateText[m.state]}`}>
                      {t("receipt")}
                    </Link>
                  ) : (
                    <span className={`w-24 text-right ${stateText[m.state]}`}>{t(`state.${m.state}`)}</span>
                  )}
                </span>
              </li>
            ))}
          </ol>
        </details>

        <p className="border-t border-border pt-3 text-[15px] text-muted-foreground">
          {t("yourAgent")}{" "}
          <a href={`tel:+91${e.agent.phone}`} className="font-medium text-foreground underline underline-offset-4">
            {e.agent.name}
          </a>
        </p>
      </div>
    </article>
  );
}
