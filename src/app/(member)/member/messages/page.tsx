import { AlertTriangle, Bell, CalendarClock, Clock, Gift, PartyPopper, Trophy, type LucideIcon } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { formatDay, formatMonthYear } from "@/lib/dates";
import { formatPaise } from "@/lib/money";
import { listMyNotifications, markAllRead } from "@/server/completion";
import { requirePageUser } from "@/server/session";
import { IconChip, PageHeader, type Tint } from "@/components/ui-bits";
import { todayInIndia } from "@/shared/tracker";

// Each kind of message gets its own icon and colour.
const kind: Record<string, { icon: LucideIcon; tint: Tint }> = {
  MATURED: { icon: PartyPopper, tint: "sunrise" },
  WON: { icon: Trophy, tint: "violet" },
  DUE_SOON: { icon: CalendarClock, tint: "blue" },
  DUE_TODAY: { icon: Clock, tint: "amber" },
  OVERDUE: { icon: AlertTriangle, tint: "coral" },
  DEFAULTED: { icon: AlertTriangle, tint: "coral" },
  BONUS_SCOOTER: { icon: Gift, tint: "pink" },
  BONUS_GOLD_CHAIN: { icon: Gift, tint: "pink" },
};

export default async function MessagesPage() {
  const t = await getTranslations("messages");
  const locale = await getLocale();
  const user = await requirePageUser(["MEMBER"]);
  const list = await listMyNotifications(user);
  await markAllRead(user); // opening the page reads them; this render still shows which were new

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-5">
      <PageHeader tone="blue" icon={Bell} title={t("title")} />
      {list.length === 0 ? (
        <p className="rounded-2xl bg-card p-4">{t("empty")}</p>
      ) : (
        <ul className="divide-y divide-border rounded-[28px] bg-card px-4">
          {list.map((n) => (
            <li key={n.id} className="flex items-start gap-3 py-4">
              <span className="relative">
                <IconChip icon={kind[n.type].icon} tint={kind[n.type].tint} />
                {!n.readAt && <span aria-hidden className="absolute -top-0.5 -right-0.5 size-3 rounded-full bg-overdue ring-2 ring-card" />}
              </span>
              <div className="flex-1">
                <p className={n.readAt ? "" : "font-semibold"}>
                  {!n.readAt && <span className="sr-only">{t("new")} </span>}
                  {t(n.type, {
                    scheme: n.scheme ? (locale === "hi" ? n.scheme.nameHi : n.scheme.nameEn) : "",
                    token: n.tokenNumber,
                    month: n.dueDate ? formatMonthYear(n.dueDate, locale) : "",
                    amount: n.amount === null ? "" : formatPaise(n.amount),
                  })}
                </p>
                <p className="text-[14px] text-muted-foreground">{formatDay(todayInIndia(n.createdAt), locale)}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
