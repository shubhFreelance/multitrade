import { getLocale, getTranslations } from "next-intl/server";
import { ActionForm } from "@/components/action-form";
import { schemeTone } from "@/components/glass";
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
      {batches.length === 0 && <p className="rounded-2xl bg-card p-4">{t("noBatches")}</p>}
      {batches.map((b) => {
        const scheme = locale === "hi" ? b.schemeNameHi : b.schemeNameEn;
        return (
          <article key={b.id} className="overflow-hidden rounded-[28px] bg-card">
            <header className={`glass-${schemeTone[b.schemeCode] ?? "violet"} flex min-h-28 items-end justify-between gap-4 px-5 pt-5 pb-4 text-white`}>
              <h2 className="text-[26px] leading-tight font-semibold tracking-tight">{scheme}</h2>
              <p className="rounded-full bg-white/20 px-3 py-1 text-[14px] font-semibold tracking-wide ring-1 ring-white/30">{b.label}</p>
            </header>
            <div className="flex flex-col gap-3 p-5">
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
