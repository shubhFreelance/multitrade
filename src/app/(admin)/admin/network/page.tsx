import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Figures, PeriodTabs } from "@/components/network";
import { formatPaise } from "@/lib/money";
import { networkOverview } from "@/server/network";
import { requirePageUser } from "@/server/session";

export default async function NetworkPage({ searchParams }: PageProps<"/admin/network">) {
  const t = await getTranslations("network");
  const o = await networkOverview(await requirePageUser(["SUPER_ADMIN"]), (await searchParams).period);

  /** One line of figures for an agent or for the direct members. */
  const figures = (r: { members: number; joined: number; collected: number; commission: number; unpaid: number; paidOut: number }, agent: boolean) => (
    <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-[15px] sm:grid-cols-3">
      {(
        [
          [t("members"), String(r.members)],
          [t("joinedIn", { period: o.period }), String(r.joined)],
          [t("collectedIn", { period: o.period }), formatPaise(r.collected)],
          ...(agent
            ? [
                [t("commissionIn", { period: o.period }), formatPaise(r.commission)],
                [t("unpaid"), formatPaise(r.unpaid)],
                [t("paidOut"), formatPaise(r.paidOut)],
              ]
            : []),
        ] as [string, string][]
      ).map(([k, v]) => (
        <div key={k} className="flex flex-col">
          <dt className="text-muted-foreground">{k}</dt>
          <dd className="font-semibold tabular-nums">{v}</dd>
        </div>
      ))}
    </dl>
  );

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-xl font-semibold">{t("adminTitle")}</h1>
        <p className="text-muted-foreground">{t("adminIntro")}</p>
      </div>
      <PeriodTabs current={o.period} base="/admin/network" />
      <Figures
        items={[
          [t("members"), String(o.totals.members)],
          [t("joinedIn", { period: o.period }), String(o.totals.joined)],
          [t("collectedIn", { period: o.period }), formatPaise(o.totals.collected)],
          [t("commissionIn", { period: o.period }), formatPaise(o.totals.commission)],
        ]}
      />
      <ul className="flex flex-col gap-3">
        {o.agents.map((a) => (
          <li key={a.id}>
            <Link href={`/admin/network/${a.id}?period=${o.period}`} className="flex flex-col gap-2 rounded-xl bg-card p-4 ring-1 ring-border hover:ring-primary">
              <p className="flex flex-wrap items-baseline justify-between gap-x-3">
                <span className="text-lg font-semibold">{a.name}</span>
                <span className="text-muted-foreground">
                  {t("agentLine", { panchayat: a.panchayat, phone: a.phone })}
                  {!a.approved && `, ${t("notApproved")}`}
                </span>
              </p>
              {figures(a, true)}
            </Link>
          </li>
        ))}
        <li className="flex flex-col gap-2 rounded-xl bg-mist p-4">
          <p className="text-lg font-semibold">{t("direct")}</p>
          {figures(o.direct, false)}
        </li>
      </ul>
    </div>
  );
}
