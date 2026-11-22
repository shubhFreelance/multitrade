import Link from "next/link";
import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { ActionForm } from "@/components/action-form";
import { formatMonthYear } from "@/lib/dates";
import { formatPaise } from "@/lib/money";
import { getPayment } from "@/server/payments";
import { requirePageUser } from "@/server/session";
import { simulatePaymentAction } from "../../actions";

/** Stand-in for the Cashfree checkout while PAYMENT_PROVIDER=test. */
export default async function TestCheckout({ params }: PageProps<"/member/pay/[id]">) {
  const t = await getTranslations("pay");
  const locale = await getLocale();
  const p = await getPayment(await requirePageUser(["MEMBER"]), (await params).id);
  if (p.status !== "CREATED") redirect(`/member/receipts/${p.id}`);
  const e = p.installment.enrolment;

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-6">
      <p
        role="note"
        className="rounded-xl border-2 border-dashed border-due p-4 text-due-ink [background-image:repeating-linear-gradient(135deg,transparent_0_10px,color-mix(in_srgb,var(--due)_8%,transparent)_10px_20px)]"
      >
        <span className="block text-lg font-semibold">{t("testTitle")}</span>
        {t("testBody")}
      </p>

      <div className="flex flex-col gap-1">
        <p className="text-muted-foreground">{t("paying")}</p>
        <p className="text-5xl font-bold tracking-tight [font-stretch:80%]">{formatPaise(p.amount)}</p>
        <p>
          {t("forMonth", {
            month: formatMonthYear(p.installment.dueDate.toISOString().slice(0, 10), locale),
            scheme: locale === "hi" ? e.batch.scheme.nameHi : e.batch.scheme.nameEn,
          })}
        </p>
        <p className="text-muted-foreground">
          {t("token")} <span className="font-semibold text-foreground">{e.tokenNumber}</span>
        </p>
      </div>

      <div className="flex flex-col gap-3">
        <ActionForm
          action={simulatePaymentAction.bind(null, p.id, "SUCCESS")}
          submitLabel={t("simulateSuccess", { amount: formatPaise(p.amount) })}
          buttonClassName="h-14 w-full text-lg font-semibold"
        />
        <ActionForm
          action={simulatePaymentAction.bind(null, p.id, "FAILED")}
          submitLabel={t("simulateFailure")}
          buttonClassName="h-12 w-full border-input bg-card text-base text-foreground ring-1 ring-input hover:bg-mist"
        />
        <Link href="/member" className="self-center py-2 underline underline-offset-4">
          {t("cancel")}
        </Link>
      </div>
    </div>
  );
}
