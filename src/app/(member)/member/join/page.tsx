import { getLocale, getTranslations } from "next-intl/server";
import { ActionForm } from "@/components/action-form";
import { formatMonthYear } from "@/lib/dates";
import { formatPaise } from "@/lib/money";
import { listJoinableBatches } from "@/server/enrolment";
import { requirePageUser } from "@/server/session";
import { joinBatchAction } from "../actions";

export default async function MemberJoinPage() {
  await requirePageUser(["MEMBER"]);
  const t = await getTranslations("join");
  const locale = await getLocale();
  const batches = await listJoinableBatches();

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-5">
      <div>
        <h1 className="text-[28px] leading-tight font-semibold">{t("title")}</h1>
        <p className="text-muted-foreground">{t("memberIntro")}</p>
      </div>
      {batches.length === 0 && <p className="rounded-2xl bg-card p-4 ring-1 ring-border">{t("noBatches")}</p>}
      {batches.map((b) => {
        const scheme = locale === "hi" ? b.schemeNameHi : b.schemeNameEn;
        return (
          <article key={b.id} className="overflow-hidden rounded-2xl bg-card ring-1 ring-border">
            <header className="flex items-baseline justify-between gap-4 bg-primary px-4 pt-3 pb-2.5 text-primary-foreground">
              <h2 className="text-xl font-semibold">{scheme}</h2>
              <p className="font-bold tracking-wider [font-stretch:75%]">{b.label}</p>
            </header>
            <div className="flex flex-col gap-3 p-4">
              <p className="text-lg">
                {t("terms", { amount: formatPaise(b.installmentAmount), months: b.tenureMonths, start: formatMonthYear(`${b.startMonth}-01`, locale) })}
              </p>
              <p className="text-muted-foreground">{t("seats", { seats: b.seatsLeft })}</p>
              <ActionForm
                action={joinBatchAction.bind(null, b.id)}
                submitLabel={t("joinThis", { scheme })}
                confirm={t("confirmJoin", { scheme, amount: formatPaise(b.installmentAmount), months: b.tenureMonths })}
                buttonClassName="h-12 w-full text-base font-semibold"
              />
            </div>
          </article>
        );
      })}
    </div>
  );
}
