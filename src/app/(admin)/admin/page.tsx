import { AlertTriangle, Banknote, ChevronRight, Clock, Gift, Package, Trophy, UserPlus, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ActionForm } from "@/components/action-form";
import { DotRhythm } from "@/components/dot-rhythm";
import { Glass } from "@/components/glass";
import { Figures } from "@/components/network";
import { formatPaise } from "@/lib/money";
import { adminOverview } from "@/server/overview";
import { requirePageUser } from "@/server/session";
import { adminRoles } from "@/shared/auth";
import { todayInIndia } from "@/shared/tracker";
import { runDailyAction } from "./actions";

// Icon chip colours follow the glass palette: blue money in, pink prizes, sunrise deliveries, violet draws, coral trouble.
const chip = {
  blue: "bg-[#e6e9fd] text-[#4b5bd0]",
  pink: "bg-[#fde4ef] text-[#c02c72]",
  sunrise: "bg-[#e3f4e6] text-[#23843f]",
  violet: "bg-[#ece6fb] text-[#5a3dc4]",
  amber: "bg-[#fbf0d9] text-[#8a5a00]",
  coral: "bg-[#fde4e1] text-[#c9372b]",
};

export default async function Page() {
  const t = await getTranslations("admin");
  const td = await getTranslations("admin.dashboard");
  const user = await requirePageUser(adminRoles);
  const o = await adminOverview(user);
  const today = todayInIndia();

  // What someone in the office should act on, most urgent first. Zeros stay, quietly, so the list never jumps around.
  const todo: [count: number, text: string, href: string | null, icon: LucideIcon, color: keyof typeof chip][] = [
    [o.pendingCash.count, td("pendingCash", { count: o.pendingCash.count, amount: formatPaise(o.pendingCash.amount) }), "/admin/cash", Banknote, "blue"],
    [o.toAllocate, td("toAllocate", { count: o.toAllocate }), "/admin/fulfilment", Gift, "pink"],
    [o.toDeliver, td("toDeliver", { count: o.toDeliver }), "/admin/fulfilment", Package, "sunrise"],
    [o.drawsReady, td("drawsReady", { count: o.drawsReady }), "/admin/draws", Trophy, "violet"],
    [o.agentsWaiting, td("agentsWaiting", { count: o.agentsWaiting }), "/admin/agents", UserPlus, "blue"],
    [o.dueNow.count, td("dueNow", { count: o.dueNow.count, amount: formatPaise(o.dueNow.amount) }), user.role === "SUPER_ADMIN" ? "/admin/network" : null, Clock, "amber"],
    [o.overdueMonths, td("overdue", { count: o.overdueMonths }), null, AlertTriangle, "coral"],
  ];

  return (
    <div className="flex flex-col gap-5">
      <h1 className="px-1 text-[30px] leading-tight font-semibold tracking-tight lg:text-[36px]">{t("title")}</h1>

      {o.money && (
        <div className="grid gap-3 lg:grid-cols-[1.6fr_1fr]">
          <Glass tone="violet" href="/admin/network" linkLabel={t("nav.network")} className="flex flex-col gap-4 lg:min-h-80 lg:justify-between lg:p-8">
            <p className="text-[15px] text-white/85">{td("collectedMonth")}</p>
            <p className="-mt-3 flex flex-wrap items-baseline gap-x-3">
              <span className="text-[44px] leading-none font-semibold tracking-tight tabular-nums lg:text-[64px]">{formatPaise(o.money.collectedMonth)}</span>
              <span className="text-white/85">{td("acrossPayments", { count: o.money.rhythm.count })}</span>
            </p>
            <DotRhythm values={o.money.rhythm.counts} rows={8} highlight={o.money.rhythm.today - 1} labels={["1", "15", String(o.money.rhythm.counts.length)]} />
          </Glass>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-1">
            <Glass tone="blue" className="flex min-h-36 flex-col justify-end p-4">
              <p className="text-[15px] text-white/85">{td("collectedAll")}</p>
              <p className="text-[26px] leading-tight font-semibold tracking-tight tabular-nums">{formatPaise(o.money.collectedAll)}</p>
            </Glass>
            <Glass tone="coral" href="/admin/network" linkLabel={t("nav.network")} className="flex min-h-36 flex-col justify-end p-4">
              <p className="text-[15px] text-white/85">{td("dueNowShort")}</p>
              <p className="text-[26px] leading-tight font-semibold tracking-tight tabular-nums">{formatPaise(o.dueNow.amount)}</p>
            </Glass>
          </div>
        </div>
      )}

      <div className="grid items-start gap-5 lg:grid-cols-2 lg:gap-6">
      <section aria-labelledby="todo" className="rounded-[28px] bg-card p-2">
        <h2 id="todo" className="px-3 pt-3 pb-1 text-lg font-semibold">
          {td("todo")}
        </h2>
        <ul className="flex flex-col">
          {todo.map(([count, text, href, Icon, color]) => {
            const body = (
              <>
                <span className={`grid size-10 shrink-0 place-items-center rounded-full ${count ? chip[color] : "bg-secondary text-muted-foreground"}`}>
                  <Icon aria-hidden className="size-[18px]" />
                </span>
                <span className={`flex-1 ${count ? "font-medium" : "text-muted-foreground"}`}>{text}</span>
                {href && count > 0 && <ChevronRight aria-hidden className="size-5 text-muted-foreground" />}
              </>
            );
            return (
              <li key={text}>
                {href && count ? (
                  <Link href={href} className="flex min-h-14 items-center gap-3 rounded-2xl px-3 py-2 hover:bg-secondary">
                    {body}
                  </Link>
                ) : (
                  <div className="flex min-h-14 items-center gap-3 px-3 py-2">{body}</div>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      <div className="flex flex-col gap-5">
      <section aria-labelledby="members" className="flex flex-col gap-2">
        <h2 id="members" className="px-1 text-lg font-semibold">
          {td("members")}
        </h2>
        <Figures
          items={[
            [td("people"), String(o.members)],
            [td("active"), String(o.enrolments.ACTIVE)],
            [td("finished"), String(o.enrolments.MATURED + o.enrolments.WON)],
            [td("defaulted"), String(o.enrolments.DEFAULTED)],
          ]}
        />
      </section>

      {o.money && (
        <section aria-labelledby="money" className="flex flex-col gap-2">
          <h2 id="money" className="px-1 text-lg font-semibold">
            {td("money")}
          </h2>
          <Figures
            items={[
              [td("commissionNotInvoiced"), formatPaise(o.money.commissionNotInvoiced)],
              [td("invoicesUnpaid", { count: o.money.invoicesUnpaid.count }), formatPaise(o.money.invoicesUnpaid.net)],
            ]}
          />
        </section>
      )}
      </div>
      </div>

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] lg:gap-6">
      {user.role === "SUPER_ADMIN" && (
        <section aria-labelledby="exports" className="flex flex-col gap-3 rounded-[28px] bg-card p-5">
          <div>
            <h2 id="exports" className="text-lg font-semibold">
              {td("exports")}
            </h2>
            <p className="text-muted-foreground">{td("exportsIntro")}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {(["enrolments", "agents"] as const).map((k) => (
              <a key={k} href={`/api/v1/admin/exports/${k}`} download className="flex min-h-11 items-center rounded-full bg-secondary px-5 font-medium hover:bg-muted">
                {td(`export.${k}`)}
              </a>
            ))}
          </div>
          {(["payments", "commission"] as const).map((k) => (
            <form key={k} method="get" action={`/api/v1/admin/exports/${k}`} className="flex flex-wrap items-end gap-2 border-t pt-3">
              <label className="flex flex-col gap-1 text-[15px]">
                {td("from")}
                <input type="date" name="from" defaultValue={`${today.slice(0, 8)}01`} required className="h-11 rounded-xl border border-input bg-card px-3" />
              </label>
              <label className="flex flex-col gap-1 text-[15px]">
                {td("to")}
                <input type="date" name="to" defaultValue={today} required className="h-11 rounded-xl border border-input bg-card px-3" />
              </label>
              <button type="submit" className="flex min-h-11 items-center rounded-full bg-secondary px-5 font-medium hover:bg-muted">
                {td(`export.${k}`)}
              </button>
            </form>
          ))}
        </section>
      )}

      {user.role === "SUPER_ADMIN" && (
        <section className="flex flex-col gap-2 rounded-[28px] bg-card p-5">
          <h2 className="text-lg font-semibold">{t("daily.title")}</h2>
          <p className="text-muted-foreground">{t("daily.intro")}</p>
          <ActionForm action={runDailyAction} submitLabel={t("daily.run")} />
        </section>
      )}
      </div>
    </div>
  );
}
