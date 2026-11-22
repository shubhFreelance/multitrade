import { getTranslations } from "next-intl/server";
import { BonusCard } from "@/components/bonus-card";
import { CompletionCard } from "@/components/completion-card";
import { EnrolmentCard } from "@/components/tracker/enrolment-card";
import { getMyBonus } from "@/server/bonus";
import { listMyCompletions } from "@/server/completion";
import { canPayOnline } from "@/server/payments";
import { requirePageUser } from "@/server/session";
import { listMyEnrolments } from "@/server/tracker";

export default async function MemberHome() {
  const t = await getTranslations("member");
  const user = await requirePageUser(["MEMBER"]);
  const [enrolments, bonus, completions] = await Promise.all([listMyEnrolments(user), getMyBonus(user), listMyCompletions(user)]);

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-5">
      <div>
        <h1 className="text-[28px] leading-tight font-semibold">{t("title")}</h1>
        <p className="text-muted-foreground">{t("greeting", { name: user.name })}</p>
      </div>
      {completions.map((c) => (
        <CompletionCard key={c.id} c={c} />
      ))}
      {enrolments.length === 0 ? (
        <p className="rounded-2xl bg-card p-4 ring-1 ring-border">{t("empty")}</p>
      ) : (
        <>
          {enrolments.map((e) => (
            <EnrolmentCard key={e.id} e={e} canPay={canPayOnline()} />
          ))}
          <BonusCard prizes={bonus} />
        </>
      )}
    </div>
  );
}
