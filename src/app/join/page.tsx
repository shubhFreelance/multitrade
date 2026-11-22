import Link from "next/link";
import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { EnrolForm } from "@/components/enrol-form";
import { LanguageSwitch } from "@/components/language-switch";
import { formatPaise } from "@/lib/money";
import { listJoinableBatches } from "@/server/enrolment";
import { getCurrentUser } from "@/server/session";
import { homeFor } from "@/shared/auth";

export default async function JoinPage() {
  const user = await getCurrentUser();
  if (user) redirect(user.role === "MEMBER" ? "/member/join" : homeFor(user.role));
  const t = await getTranslations();
  const hi = (await getLocale()) === "hi";
  const batches = await listJoinableBatches();

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-5 p-4">
      <div className="flex items-center justify-between px-1">
        <span className="flex items-center gap-3 font-semibold">
          <span aria-hidden className="grid size-11 place-items-center rounded-2xl bg-primary text-lg font-bold text-primary-foreground">
            S
          </span>
          {t("app.name")}
        </span>
        <LanguageSwitch />
      </div>
      <div className="glass glass-sunrise flex min-h-52 flex-col justify-end p-6">
        <h1 className="text-[34px] leading-[1.1] font-semibold tracking-tight">{t("join.title")}</h1>
        <p className="mt-2 text-white/90">{t("join.intro")}</p>
      </div>
      {batches.length === 0 ? (
        <p className="rounded-2xl bg-card p-4">{t("join.noBatches")}</p>
      ) : (
        <div className="rounded-[28px] bg-card p-5">
        <EnrolForm
          mode="join"
          batches={batches.map((b) => ({
            id: b.id,
            text: t("agent.enrol.batchOption", {
              label: b.label,
              scheme: hi ? b.schemeNameHi : b.schemeNameEn,
              amount: formatPaise(b.installmentAmount),
              months: b.tenureMonths,
              start: b.startMonth,
              seats: b.seatsLeft,
            }),
          }))}
        />
        </div>
      )}
      <p className="text-muted-foreground">
        {t("join.haveAccount")}{" "}
        <Link href="/login" className="inline-flex min-h-11 items-center font-medium text-foreground underline underline-offset-4">
          {t("join.login")}
        </Link>
      </p>
    </main>
  );
}
