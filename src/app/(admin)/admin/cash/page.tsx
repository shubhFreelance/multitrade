import { getLocale, getTranslations } from "next-intl/server";
import { ActionForm } from "@/components/action-form";
import { formatMonthYear } from "@/lib/dates";
import { formatPaise } from "@/lib/money";
import { listPendingCash } from "@/server/payments";
import { requirePageUser } from "@/server/session";
import { adminRoles } from "@/shared/auth";
import { rejectCashAction, verifyCashAction } from "../actions";

const when = (d: Date, locale: string) =>
  new Intl.DateTimeFormat(locale === "hi" ? "hi-IN" : "en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" }).format(d);

export default async function CashPage() {
  const t = await getTranslations("admin.cash");
  const locale = await getLocale();
  const pending = await listPendingCash(await requirePageUser(adminRoles));
  const total = pending.reduce((s, p) => s + p.amount, 0);

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-xl font-semibold">{t("title")}</h1>
        <p className="text-muted-foreground">{pending.length ? t("summary", { count: pending.length, amount: formatPaise(total) }) : t("empty")}</p>
      </div>
      <ul className="flex flex-col gap-3">
        {pending.map((p) => (
          <li key={p.id} className="flex flex-col gap-3 rounded-xl bg-card p-4 ring-1 ring-border sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-lg font-semibold">
                {formatPaise(p.amount)} <span className="font-normal">{p.member.name}</span>
              </p>
              <p className="text-muted-foreground">
                {t("line", {
                  token: p.installment.enrolment.tokenNumber,
                  month: formatMonthYear(p.installment.dueDate.toISOString().slice(0, 10), locale),
                  agent: p.collectedBy?.name ?? "",
                  when: when(p.createdAt, locale),
                })}
              </p>
            </div>
            <div className="flex gap-2">
              <ActionForm action={verifyCashAction.bind(null, p.id)} submitLabel={t("verify")} />
              <ActionForm
                action={rejectCashAction.bind(null, p.id)}
                submitLabel={t("reject")}
                confirm={t("confirmReject", { amount: formatPaise(p.amount), name: p.member.name })}
                buttonClassName="h-11 bg-card px-5 text-overdue ring-1 ring-overdue hover:bg-mist"
              />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
