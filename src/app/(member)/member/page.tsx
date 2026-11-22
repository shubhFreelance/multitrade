import { getTranslations } from "next-intl/server";
import { EnrolmentCard } from "@/components/tracker/enrolment-card";
import { requirePageUser } from "@/server/session";
import { listMyEnrolments } from "@/server/tracker";

export default async function MemberHome() {
  const t = await getTranslations("member");
  const user = await requirePageUser(["MEMBER"]);
  const enrolments = await listMyEnrolments(user);

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-5">
      <div>
        <h1 className="text-[28px] leading-tight font-semibold">{t("title")}</h1>
        <p className="text-muted-foreground">{t("greeting", { name: user.name })}</p>
      </div>
      {enrolments.length === 0 ? (
        <p className="rounded-2xl bg-card p-4 ring-1 ring-border">{t("empty")}</p>
      ) : (
        enrolments.map((e) => <EnrolmentCard key={e.id} e={e} />)
      )}
    </div>
  );
}
