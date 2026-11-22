import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { EnrolForm } from "@/components/enrol-form";
import { formatPaise } from "@/lib/money";
import { getMyAgentProfile } from "@/server/agents";
import { listOpenBatches } from "@/server/enrolment";
import { requirePageUser } from "@/server/session";

export default async function EnrolPage() {
  const t = await getTranslations("agent");
  const tc = await getTranslations("common");
  const user = await requirePageUser(["AGENT"]);
  const approved = (await getMyAgentProfile(user))?.approved;
  const batches = approved ? await listOpenBatches(user) : [];
  const hi = (await getLocale()) === "hi";

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-4">
      <Link href="/agent" className="text-sm hover:underline">
        ← {tc("back")}
      </Link>
      <h1 className="text-xl font-semibold">{t("enrol.title")}</h1>
      {!approved ? (
        <p className="rounded-xl border p-4">{t("awaitingApproval")}</p>
      ) : batches.length === 0 ? (
        <p className="rounded-xl border p-4">{t("enrol.noBatches")}</p>
      ) : (
        <EnrolForm
          batches={batches.map((b) => ({
            id: b.id,
            text: t("enrol.batchOption", {
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
    </div>
  );
}
