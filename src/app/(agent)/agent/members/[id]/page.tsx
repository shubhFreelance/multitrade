import Link from "next/link";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { ActionForm } from "@/components/action-form";
import { MemberDetail } from "@/components/network";
import { formatMonthYear } from "@/lib/dates";
import { formatPaise } from "@/lib/money";
import { toAppError } from "@/server/errors";
import { getNetworkEnrolment } from "@/server/network";
import { requirePageUser } from "@/server/session";
import { recordCashAction } from "../../actions";

export default async function AgentMemberPage({ params }: PageProps<"/agent/members/[id]">) {
  const t = await getTranslations("agent.members");
  const tc = await getTranslations("common");
  const locale = await getLocale();
  const user = await requirePageUser(["AGENT"]);
  const e = await getNetworkEnrolment(user, (await params).id).catch((err) => (toAppError(err).code === "NOT_FOUND" ? notFound() : Promise.reject(err)));
  const next = e.summary.next;

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-5">
      <Link href="/agent/members" className="text-sm hover:underline">
        ← {tc("back")}
      </Link>
      <MemberDetail e={e}>
        {next && (
          <ActionForm
            action={recordCashAction.bind(null, next.id!)}
            submitLabel={t("recordCash", { amount: formatPaise(next.amount), month: formatMonthYear(next.dueDate, locale) })}
            confirm={t("confirmCash", { amount: formatPaise(next.amount), name: e.member.name, month: formatMonthYear(next.dueDate, locale) })}
            buttonClassName="h-12 w-full bg-card text-base text-primary ring-1 ring-primary hover:bg-mist"
          />
        )}
      </MemberDetail>
    </div>
  );
}
