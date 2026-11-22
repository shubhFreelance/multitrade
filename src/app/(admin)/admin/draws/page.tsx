import { Trophy } from "lucide-react";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { ActionForm } from "@/components/action-form";
import { BonusDrawAdmin } from "@/components/bonus-draw-admin";
import { toneAt } from "@/components/glass";
import { Figures } from "@/components/network";
import { PageHeader, SectionTitle } from "@/components/ui-bits";
import { formatDay } from "@/lib/dates";
import { bonusOverview } from "@/server/bonus";
import { listDrawBatches } from "@/server/draws";
import { requirePageUser } from "@/server/session";
import { adminRoles } from "@/shared/auth";
import { schemeCodes } from "@/shared/catalog";
import { todayInIndia } from "@/shared/tracker";
import { runDrawAction } from "../actions";

const states = ["all", "ready", "later", "done"] as const;
type State = (typeof states)[number];
type Batch = Awaited<ReturnType<typeof listDrawBatches>>[number];
const stateOf = (b: Batch): Exclude<State, "all"> => (b.nextMonth === null ? "done" : b.canRun ? "ready" : "later");

/** Small filter pills, right-aligned. */
function Pills({ label, items }: { label: string; items: { href: string; text: string; count: number; current: boolean }[] }) {
  return (
    <nav aria-label={label} className="flex flex-wrap gap-1.5 sm:justify-end">
      {items.map((it) => (
        <Link
          key={it.href}
          href={it.href}
          aria-current={it.current ? "page" : undefined}
          className="flex min-h-10 items-center gap-1.5 rounded-full bg-card px-3.5 text-[14px] font-medium text-muted-foreground hover:text-foreground aria-[current=page]:bg-primary aria-[current=page]:text-primary-foreground"
        >
          {it.text}
          <span className="tabular-nums opacity-70">{it.count}</span>
        </Link>
      ))}
    </nav>
  );
}

export default async function DrawsPage({ searchParams }: PageProps<"/admin/draws">) {
  const t = await getTranslations("draws");
  const locale = await getLocale();
  const user = await requirePageUser(adminRoles);
  const sp = await searchParams;
  const scheme = schemeCodes.find((c) => c === sp.scheme) ?? "all";
  const state: State = states.find((s) => s === sp.state) ?? "all";
  const [batches, bonus] = await Promise.all([listDrawBatches(user), bonusOverview(user)]);

  const href = (q: { scheme?: string; state?: string }) => `/admin/draws?scheme=${q.scheme ?? scheme}&state=${q.state ?? state}`;
  const inScheme = (b: Batch, c: string) => c === "all" || b.scheme.code === c;
  const shown = batches.filter((b) => inScheme(b, scheme) && (state === "all" || stateOf(b) === state));
  const schemeName = (c: (typeof schemeCodes)[number]) => {
    const b = batches.find((x) => x.scheme.code === c);
    return b ? (locale === "hi" ? b.scheme.nameHi : b.scheme.nameEn) : c;
  };
  const drawsRun = batches.reduce((s, b) => s + b.draws.length, 0);
  const winners = batches.reduce((s, b) => s + b.draws.reduce((w, d) => w + d.winners.length, 0), 0);

  return (
    <div className="flex flex-col gap-6 lg:gap-8">
      <PageHeader tone="violet" icon={Trophy} title={t("adminTitle")} intro={t("pageIntro")} />

      <Figures
        items={[
          [t("stats.batches"), String(batches.length), "violet"],
          [t("stats.drawsRun"), String(drawsRun), "blue"],
          [t("stats.ready"), String(batches.filter((b) => b.canRun).length), "coral"],
          [t("stats.winners"), String(winners), "sunrise"],
        ]}
      />

      <BonusDrawAdmin prizes={bonus} />

      <section aria-labelledby="monthly" className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <SectionTitle id="monthly" tint="violet" count={shown.length}>
              {t("monthlyTitle")}
            </SectionTitle>
            <p className="mt-1 max-w-xl px-1 text-[15px] text-muted-foreground">{t("adminIntro")}</p>
          </div>
          <div className="flex flex-col gap-2 lg:items-end">
            <Pills
              label={t("filters.scheme")}
              items={(["all", ...schemeCodes] as const).map((c) => ({
                href: href({ scheme: c }),
                text: c === "all" ? t("filters.allSchemes") : schemeName(c),
                count: batches.filter((b) => inScheme(b, c)).length,
                current: c === scheme,
              }))}
            />
            <Pills
              label={t("filters.state")}
              items={states.map((s) => ({
                href: href({ state: s }),
                text: t(`filters.${s}`),
                count: batches.filter((b) => inScheme(b, scheme) && (s === "all" || stateOf(b) === s)).length,
                current: s === state,
              }))}
            />
          </div>
        </div>

        {shown.length === 0 ? (
          <p className="rounded-[28px] bg-card p-5 text-muted-foreground">{t("noneMatch")}</p>
        ) : (
          <div className="grid items-start gap-4 lg:grid-cols-2 lg:gap-5 2xl:grid-cols-3">
            {shown.map((b) => {
              // Colour follows the batch (its place in the full list), so a filter never repaints it.
              const bi = batches.indexOf(b);
              const done = b.draws.length;
              return (
                <section key={b.id} aria-label={b.label} className="overflow-hidden rounded-[28px] bg-card">
                  <header className={`glass-${toneAt(bi)} flex items-center justify-between gap-3 px-5 py-4 text-white`}>
                    <div className="min-w-0">
                      <h3 className="truncate text-[18px] leading-tight font-semibold">{locale === "hi" ? b.scheme.nameHi : b.scheme.nameEn}</h3>
                      <p className="text-[14px] text-white/85">{t("batchLine", { members: b.members, winners: b.winnersPerDraw })}</p>
                    </div>
                    <span className="shrink-0 rounded-full bg-white/20 px-3 py-1 text-[13px] font-semibold tracking-wide ring-1 ring-white/30">{b.label}</span>
                  </header>

                  <div className="flex flex-col gap-4 p-5">
                    {/* One bar per draw month: done (in that draw's colour), next to run (black), later (grey). */}
                    <div>
                      <div className="mb-1.5 flex items-baseline justify-between text-[14px]">
                        <span className="font-medium">{t("progress", { done, total: b.totalDraws })}</span>
                        <span className="text-muted-foreground">{t(`filters.${stateOf(b)}`)}</span>
                      </div>
                      <ol aria-hidden className="flex gap-1">
                        {Array.from({ length: b.totalDraws }, (_, i) => (
                          <li
                            key={i}
                            title={t("monthDraw", { month: i + 1 })}
                            className={`h-2.5 flex-1 rounded-full ${i < done ? `tint-${toneAt(bi + i + 1)}` : i === done && b.canRun ? "bg-primary" : "bg-mist"}`}
                            style={i < done ? { backgroundColor: "var(--tint-ink)" } : undefined}
                          />
                        ))}
                      </ol>
                    </div>

                    {b.nextMonth === null ? (
                      <p className="text-muted-foreground">{t("allDone")}</p>
                    ) : b.canRun ? (
                      <ActionForm
                        action={runDrawAction.bind(null, b.id, b.nextMonth)}
                        submitLabel={t("run", { month: b.nextMonth })}
                        confirm={t("confirmRun", { month: b.nextMonth, batch: b.label })}
                        buttonClassName="h-11 w-full text-[15px] font-semibold"
                      />
                    ) : (
                      <p className="text-[15px] text-muted-foreground">
                        {b.winnersPerDraw === 0 ? t("noWinnersSet") : t("opensOn", { month: b.nextMonth, day: formatDay(b.opensOn!, locale) })}
                      </p>
                    )}

                    {b.draws.length > 0 && (
                      <ol className="flex flex-col gap-2">
                        {b.draws.map((d) => (
                          <li key={d.id} className={`tint-${toneAt(bi + d.monthNo)} flex flex-col gap-1.5 rounded-2xl px-4 py-3`}>
                            <p className="flex flex-wrap items-baseline justify-between gap-x-2">
                              <span className="text-tint font-semibold">{t("monthDraw", { month: d.monthNo })}</span>
                              <span className="text-[13px] text-foreground/70">{t("ranOn", { day: formatDay(todayInIndia(d.createdAt), locale), eligible: d.eligibleCount })}</span>
                            </p>
                            <ul className="flex flex-wrap gap-1.5">
                              {d.winners.map((w) => (
                                <li key={w} className="text-tint rounded-full bg-white px-2.5 py-0.5 text-[13px] font-semibold tracking-wide">
                                  {w}
                                </li>
                              ))}
                            </ul>
                            <p className="text-[12px] break-all text-foreground/55">
                              {t("seed")} {d.seed}
                            </p>
                          </li>
                        ))}
                      </ol>
                    )}
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
