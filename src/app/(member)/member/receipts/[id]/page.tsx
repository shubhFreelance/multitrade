import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { ActionForm } from "@/components/action-form";
import { formatMonthYear } from "@/lib/dates";
import { formatPaise } from "@/lib/money";
import { getCompany } from "@/server/config";
import { getPayment } from "@/server/payments";
import { requirePageUser } from "@/server/session";
import { payAction } from "../../actions";

const paidAtFormat = (d: Date, locale: string) =>
  new Intl.DateTimeFormat(locale === "hi" ? "hi-IN" : "en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" }).format(d);

export default async function Receipt({ params }: PageProps<"/member/receipts/[id]">) {
  const t = await getTranslations("receipt");
  const locale = await getLocale();
  const [p, company] = await Promise.all([getPayment(await requirePageUser(["MEMBER"]), (await params).id), getCompany()]);
  const e = p.installment.enrolment;
  const month = formatMonthYear(p.installment.dueDate.toISOString().slice(0, 10), locale);
  const scheme = locale === "hi" ? e.batch.scheme.nameHi : e.batch.scheme.nameEn;
  const back = (
    <Link href="/member" className="self-center py-2 underline underline-offset-4">
      {t("back")}
    </Link>
  );

  if (p.status !== "SUCCESS") {
    const message = { FAILED: t("failed"), CREATED: t("unfinished"), DUPLICATE: t("duplicate") }[p.status];
    return (
      <div className="mx-auto flex w-full max-w-md flex-col gap-5">
        <h1 className="text-[28px] leading-tight font-semibold">{t(`title${p.status}`)}</h1>
        <p role="status" className={`rounded-2xl bg-card p-4 ring-1 ${p.status === "DUPLICATE" ? "ring-due" : "ring-overdue"}`}>
          {message}
        </p>
        {p.status === "FAILED" && (
          <ActionForm
            action={payAction.bind(null, p.installmentId)}
            submitLabel={t("tryAgain", { amount: formatPaise(p.amount), month })}
            buttonClassName="h-14 w-full text-lg font-semibold"
          />
        )}
        {p.status === "CREATED" && (
          <Link href={`/member/pay/${p.id}`} className="flex h-14 items-center justify-center rounded-lg bg-primary text-lg font-semibold text-primary-foreground">
            {t("continue")}
          </Link>
        )}
        {back}
      </div>
    );
  }

  const rows: [string, string][] = [
    [t("member"), p.member.name],
    [t("token"), e.tokenNumber],
    [t("scheme"), scheme],
    [t("installment"), t("installmentOf", { month, n: p.installment.monthNo })],
    [t("paidOn"), paidAtFormat(p.paidAt!, locale)],
    [t("method"), p.provider === "TEST" ? t("methodTest") : t("methodOnline")],
    [t("orderId"), p.orderId],
    [t("paymentId"), p.gatewayPaymentId ?? ""],
  ];

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-5">
      <article className="overflow-hidden rounded-2xl bg-card ring-1 ring-border">
        <header className="flex items-center justify-between bg-primary px-4 py-3 text-primary-foreground">
          <h1 className="text-xl font-semibold">{t("title")}</h1>
          <span className="rounded-md bg-paid px-2.5 py-0.5 font-semibold">✓ {t("paid")}</span>
        </header>
        <div className="flex flex-col gap-4 p-4">
          <p className="text-5xl font-bold tracking-tight [font-stretch:80%]">{formatPaise(p.amount)}</p>
          {p.provider === "TEST" && (
            <p role="note" className="rounded-lg border-2 border-dashed border-due p-3 font-medium text-due-ink">
              {t("testNote")}
            </p>
          )}
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2">
            {rows.map(([k, v]) => (
              <div key={k} className="contents">
                <dt className="text-muted-foreground">{k}</dt>
                <dd className="text-right font-medium break-all">{v}</dd>
              </div>
            ))}
          </dl>
          <footer className="border-t border-border pt-3 text-[14px] leading-snug text-muted-foreground">
            <p className="font-medium text-foreground">{company.name}</p>
            {company.cin && <p>CIN {company.cin}</p>}
            {company.address && <p>{company.address}</p>}
          </footer>
        </div>
      </article>
      {back}
    </div>
  );
}
