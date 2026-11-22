import { Boxes } from "lucide-react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Figures, PeriodTabs } from "@/components/network";
import { formatPaise } from "@/lib/money";
import { networkOverview } from "@/server/network";
import { Avatar, PageHeader } from "@/components/ui-bits";
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
      <PageHeader tone="blue" icon={Boxes} title={t("adminTitle")} intro={t("adminIntro")} />
      <PeriodTabs current={o.period} base="/admin/network" />
      <Figures
        items={[
          [t("members"), String(o.totals.members)],
          [t("joinedIn", { period: o.period }), String(o.totals.joined)],
          [t("collectedIn", { period: o.period }), formatPaise(o.totals.collected)],
          [t("commissionIn", { period: o.period }), formatPaise(o.totals.commission)],
        ]}
      />
      <ul className="grid items-start gap-3 lg:grid-cols-2 lg:gap-4">
        {o.agents.map((a) => (
          <li key={a.id}>
            <Link href={`/admin/network/${a.id}?period=${o.period}`} className="lift flex flex-col gap-3 rounded-[28px] bg-card p-5">
              <div className="flex items-center gap-3">
                <Avatar name={a.name} tint={a.approved ? "violet" : "amber"} />
                <div className="min-w-0">
                  <p className="text-lg leading-tight font-semibold">{a.name}</p>
                  <p className="text-[15px] text-muted-foreground">
                    {t("agentLine", { panchayat: a.panchayat, phone: a.phone })}
                    {!a.approved && `, ${t("notApproved")}`}
                  </p>
                </div>
              </div>
              {figures(a, true)}
            </Link>
          </li>
        ))}
        <li className="tint-peach flex flex-col gap-2 rounded-[28px] p-5">
          <p className="text-lg font-semibold">{t("direct")}</p>
          {figures(o.direct, false)}
        </li>
      </ul>
    </div>
  );
}
