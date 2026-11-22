import { getLocale, getTranslations } from "next-intl/server";
import { formatDay } from "@/lib/dates";
import { formatPaise } from "@/lib/money";
import type { TrackerSummary } from "@/shared/tracker";

/** Plain sentences on cash being checked and what to pay next, coloured by urgency. */
export async function NextDue({ summary }: { summary: TrackerSummary }) {
  const t = await getTranslations("tracker");
  const locale = await getLocale();
  const { next, dueNowCount, dueNowTotal, pendingCount, pendingTotal } = summary;

  const pending = pendingCount > 0 && <p className="font-medium text-paid">{t("pendingCash", { amount: formatPaise(pendingTotal), count: pendingCount })}</p>;

  let line;
  if (!next) {
    line = pendingCount === 0 && <p className="font-medium text-paid">{t("settled")}</p>;
  } else if (next.state === "OVERDUE") {
    const overdue = summary.slots.filter((s) => s.state === "OVERDUE").length;
    line = <p className="font-semibold text-overdue">{t("overdue", { amount: formatPaise(dueNowTotal), count: dueNowCount, overdue })}</p>;
  } else if (next.state === "DUE_NOW") {
    line = <p className="font-semibold text-due-ink">{t("dueNow", { amount: formatPaise(dueNowTotal), count: dueNowCount, day: formatDay(next.dueDate, locale) })}</p>;
  } else {
    line = <p>{t("upcoming", { amount: formatPaise(next.amount), day: formatDay(next.dueDate, locale) })}</p>;
  }

  return (
    <>
      {pending}
      {line}
    </>
  );
}
