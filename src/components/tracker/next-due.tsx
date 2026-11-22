import { getLocale, getTranslations } from "next-intl/server";
import { formatDay } from "@/lib/dates";
import { formatPaise } from "@/lib/money";
import type { TrackerSummary } from "@/shared/tracker";

/** One plain sentence on what to pay next, coloured by urgency. */
export async function NextDue({ summary }: { summary: TrackerSummary }) {
  const t = await getTranslations("tracker");
  const locale = await getLocale();
  const { next, dueNowCount, dueNowTotal } = summary;

  if (!next) return <p className="font-medium text-paid">{t("settled")}</p>;

  const day = formatDay(next.dueDate, locale);
  if (next.state === "OVERDUE") {
    const overdue = summary.slots.filter((s) => s.state === "OVERDUE").length;
    return <p className="font-semibold text-overdue">{t("overdue", { amount: formatPaise(dueNowTotal), count: dueNowCount, overdue })}</p>;
  }
  if (next.state === "DUE_NOW") {
    return <p className="font-semibold text-due-ink">{t("dueNow", { amount: formatPaise(dueNowTotal), count: dueNowCount, day })}</p>;
  }
  return <p>{t("upcoming", { amount: formatPaise(next.amount), day })}</p>;
}
