import { UserRound, UsersRound } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { formatDay } from "@/lib/dates";
import { requirePageUser } from "@/server/session";
import { getMyAccount } from "@/server/tracker";
import { PageHeader } from "@/components/ui-bits";
import { todayInIndia } from "@/shared/tracker";

export default async function AccountPage() {
  const t = await getTranslations("account");
  const tt = await getTranslations("member.status");
  const locale = await getLocale();
  const me = await getMyAccount(await requirePageUser(["MEMBER"]));
  const p = me.memberProfile;
  const rows: [string, string | null | undefined][] = [
    [t("name"), me.name],
    [t("phone"), me.phone],
    [t("village"), p?.village],
    [t("address"), p?.address],
    [t("nominee"), p?.nominee || t("none")],
  ];

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-5">
      <PageHeader tone="pink" icon={UserRound} title={t("title")} />

      <section aria-labelledby="joined" className="flex flex-col gap-3">
        <h2 id="joined" className="text-lg font-semibold">
          {t("howJoined")}
        </h2>
        {me.enrolments.length === 0 && <p className="text-muted-foreground">{t("noSchemes")}</p>}
        {me.enrolments.map((e) => {
          const a = e.agent;
          return (
            <article key={e.id} className={`flex gap-3 rounded-2xl p-4 ring-1 ${a ? "bg-card ring-border" : "bg-mist ring-transparent"}`}>
              <span className={`grid size-11 shrink-0 place-items-center rounded-full ${a ? "bg-primary text-primary-foreground" : "bg-card text-primary"}`} aria-hidden>
                {a ? <UsersRound className="size-5" /> : <UserRound className="size-5" />}
              </span>
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-baseline justify-between gap-x-3">
                  <span className="font-semibold">{locale === "hi" ? e.batch.scheme.nameHi : e.batch.scheme.nameEn}</span>
                  <span className="font-bold tracking-wider [font-stretch:75%]">{e.tokenNumber}</span>
                </p>
                {a ? (
                  <>
                    <p>
                      {t("throughAgent")}{" "}
                      <a href={`tel:+91${a.phone}`} className="font-medium underline underline-offset-4">
                        {a.name}
                      </a>
                    </p>
                    <p className="text-muted-foreground">{t("agentLine", { phone: a.phone, panchayat: a.agentProfile?.panchayat ?? "" })}</p>
                  </>
                ) : (
                  <p>{t("direct")}</p>
                )}
                <p className="text-[15px] text-muted-foreground">
                  {t("joinedOn", { day: formatDay(todayInIndia(e.createdAt), locale) })}, {tt(e.status)}
                </p>
              </div>
            </article>
          );
        })}
      </section>

      <section aria-labelledby="profile" className="rounded-2xl bg-card p-4">
        <h2 id="profile" className="text-lg font-semibold">
          {t("profile")}
        </h2>
        <dl className="mt-2 flex flex-col divide-y divide-border">
          {rows.map(([k, v]) => (
            <div key={k} className="flex flex-col gap-0.5 py-2.5 sm:flex-row sm:gap-4">
              <dt className="text-muted-foreground sm:w-32 sm:shrink-0">{k}</dt>
              <dd className="break-words">{v ?? "—"}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-2 text-[15px] text-muted-foreground">{t("changeDetails")}</p>
      </section>
    </div>
  );
}
