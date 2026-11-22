import { getLocale, getTranslations } from "next-intl/server";
import { formatDay, formatMonthYear } from "@/lib/dates";
import { formatPaise } from "@/lib/money";
import { listMyNotifications, markAllRead } from "@/server/completion";
import { requirePageUser } from "@/server/session";
import { todayInIndia } from "@/shared/tracker";

export default async function MessagesPage() {
  const t = await getTranslations("messages");
  const locale = await getLocale();
  const user = await requirePageUser(["MEMBER"]);
  const list = await listMyNotifications(user);
  await markAllRead(user); // opening the page reads them; this render still shows which were new

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-5">
      <h1 className="text-[28px] leading-tight font-semibold">{t("title")}</h1>
      {list.length === 0 ? (
        <p className="rounded-2xl bg-card p-4 ring-1 ring-border">{t("empty")}</p>
      ) : (
        <ul className="divide-y divide-border rounded-2xl bg-card px-4 ring-1 ring-border">
          {list.map((n) => (
            <li key={n.id} className="flex gap-3 py-3.5">
              <span aria-hidden className={`mt-2 size-2.5 shrink-0 rounded-full ${n.readAt ? "bg-transparent" : "bg-primary"}`} />
              <div>
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
