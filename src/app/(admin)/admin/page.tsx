import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ActionForm } from "@/components/action-form";
import { Figures } from "@/components/network";
import { formatPaise } from "@/lib/money";
import { adminOverview } from "@/server/overview";
import { requirePageUser } from "@/server/session";
import { adminRoles } from "@/shared/auth";
import { todayInIndia } from "@/shared/tracker";
import { runDailyAction } from "./actions";

export default async function Page() {
  const t = await getTranslations("admin");
  const td = await getTranslations("admin.dashboard");
  const user = await requirePageUser(adminRoles);
  const o = await adminOverview(user);
  const today = todayInIndia();

  // What someone in the office should act on, most urgent first. A zero is shown quietly.
  const todo: [count: number, text: string, href: string | null][] = [
    [o.pendingCash.count, td("pendingCash", { count: o.pendingCash.count, amount: formatPaise(o.pendingCash.amount) }), "/admin/cash"],
    [o.toAllocate, td("toAllocate", { count: o.toAllocate }), "/admin/fulfilment"],
    [o.toDeliver, td("toDeliver", { count: o.toDeliver }), "/admin/fulfilment"],
    [o.drawsReady, td("drawsReady", { count: o.drawsReady }), "/admin/draws"],
    [o.agentsWaiting, td("agentsWaiting", { count: o.agentsWaiting }), "/admin/agents"],
    [o.dueNow.count, td("dueNow", { count: o.dueNow.count, amount: formatPaise(o.dueNow.amount) }), user.role === "SUPER_ADMIN" ? "/admin/network" : null],
    [o.overdueMonths, td("overdue", { count: o.overdueMonths }), null],
  ];

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold">{t("title")}</h1>

      <section aria-labelledby="todo" className="flex flex-col gap-2">
        <h2 id="todo" className="text-lg font-semibold">
          {td("todo")}
        </h2>
        <ul className="divide-y divide-border rounded-xl bg-card ring-1 ring-border">
          {todo.map(([count, text, href]) => {
            const body = (
              <>
                <span className={`grid h-9 min-w-9 place-items-center rounded-full px-2 font-semibold tabular-nums ${count ? "bg-primary text-primary-foreground" : "bg-mist text-muted-foreground"}`}>
                  {count}
                </span>
                <span className={count ? "" : "text-muted-foreground"}>{text}</span>
              </>
            );
            return (
              <li key={text}>
                {href && count ? (
                  <Link href={href} className="flex min-h-14 items-center gap-3 px-4 py-2 hover:bg-mist">
                    {body}
                  </Link>
                ) : (
                  <div className="flex min-h-14 items-center gap-3 px-4 py-2">{body}</div>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      <section aria-labelledby="members" className="flex flex-col gap-2">
        <h2 id="members" className="text-lg font-semibold">
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
          <h2 id="money" className="text-lg font-semibold">
            {td("money")}
          </h2>
          <Figures
            items={[
              [td("collectedMonth"), formatPaise(o.money.collectedMonth)],
              [td("collectedAll"), formatPaise(o.money.collectedAll)],
              [td("commissionNotInvoiced"), formatPaise(o.money.commissionNotInvoiced)],
              [td("invoicesUnpaid", { count: o.money.invoicesUnpaid.count }), formatPaise(o.money.invoicesUnpaid.net)],
            ]}
          />
        </section>
      )}

      {user.role === "SUPER_ADMIN" && (
        <section aria-labelledby="exports" className="flex flex-col gap-3 rounded-xl bg-card p-4 ring-1 ring-border">
          <div>
            <h2 id="exports" className="text-lg font-semibold">
              {td("exports")}
            </h2>
            <p className="text-muted-foreground">{td("exportsIntro")}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {(["enrolments", "agents"] as const).map((k) => (
              <a key={k} href={`/api/v1/admin/exports/${k}`} download className="flex min-h-11 items-center rounded-lg px-4 font-medium text-primary ring-1 ring-primary hover:bg-mist">
                {td(`export.${k}`)}
              </a>
            ))}
          </div>
          {(["payments", "commission"] as const).map((k) => (
            <form key={k} method="get" action={`/api/v1/admin/exports/${k}`} className="flex flex-wrap items-end gap-2 border-t pt-3">
              <label className="flex flex-col gap-1 text-[15px]">
                {td("from")}
                <input type="date" name="from" defaultValue={`${today.slice(0, 8)}01`} required className="h-11 rounded-lg border border-input bg-card px-2" />
              </label>
              <label className="flex flex-col gap-1 text-[15px]">
                {td("to")}
                <input type="date" name="to" defaultValue={today} required className="h-11 rounded-lg border border-input bg-card px-2" />
              </label>
              <button type="submit" className="flex min-h-11 items-center rounded-lg px-4 font-medium text-primary ring-1 ring-primary hover:bg-mist">
                {td(`export.${k}`)}
              </button>
            </form>
          ))}
        </section>
      )}

      {user.role === "SUPER_ADMIN" && (
        <section className="flex flex-col gap-2 rounded-xl bg-card p-4 ring-1 ring-border">
          <h2 className="text-lg font-semibold">{t("daily.title")}</h2>
          <p className="text-muted-foreground">{t("daily.intro")}</p>
          <ActionForm action={runDailyAction} submitLabel={t("daily.run")} />
        </section>
      )}
    </div>
  );
}
