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
      <div className="flex items-center justify-between">
        <p className="font-semibold">{t("app.name")}</p>
        <LanguageSwitch />
      </div>
      <div>
        <h1 className="text-[28px] leading-tight font-semibold">{t("join.title")}</h1>
        <p className="text-muted-foreground">{t("join.intro")}</p>
      </div>
      {batches.length === 0 ? (
        <p className="rounded-2xl bg-card p-4 ring-1 ring-border">{t("join.noBatches")}</p>
      ) : (
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
      )}
      <p className="text-muted-foreground">
        {t("join.haveAccount")}{" "}
        <Link href="/login" className="font-medium text-foreground underline underline-offset-4">
          {t("join.login")}
        </Link>
      </p>
    </main>
  );
}
