import { getLocale, getTranslations } from "next-intl/server";
import { formatMonthShort, formatMonthYear } from "@/lib/dates";
import type { Slot, SlotState } from "@/shared/tracker";

// Each state differs in shape as well as colour, so it reads without colour too.
const bead: Record<SlotState, string> = {
  PAID: "bg-paid text-white",
  OVERDUE: "bg-overdue text-white",
  DUE_NOW: "bg-card ring-[3px] ring-inset ring-due",
  UPCOMING: "bg-mist",
  WAIVED: "bg-card ring-1 ring-inset ring-input [background-image:repeating-linear-gradient(135deg,var(--mist)_0_3px,transparent_3px_6px)]",
};
const glyph: Partial<Record<SlotState, string>> = { PAID: "✓", OVERDUE: "!" };

/** The months of an enrolment as beads on a thread, six to a row. */
export async function Beads({ slots }: { slots: Slot[] }) {
  const locale = await getLocale();
  const t = await getTranslations("tracker.state");
  const rows = [slots.slice(0, 6), slots.slice(6)].filter((r) => r.length);

  return (
    <ol className="flex flex-col gap-3">
      {rows.map((row, r) => (
        <li key={r}>
          <ol className="relative grid grid-cols-6 before:absolute before:inset-x-[8%] before:top-[17px] before:h-px before:bg-input">
            {row.map((s) => (
              <li key={s.monthNo} className="relative flex flex-col items-center gap-1">
                <span aria-hidden className={`grid size-[34px] place-items-center rounded-full text-base font-bold ${bead[s.state]}`}>
                  {glyph[s.state]}
                </span>
                <span aria-hidden className="text-[12px] leading-none text-muted-foreground">
                  {formatMonthShort(s.dueDate, locale)}
                </span>
                <span className="sr-only">
                  {formatMonthYear(s.dueDate, locale)}: {t(s.state)}
                </span>
              </li>
            ))}
          </ol>
        </li>
      ))}
    </ol>
  );
}

/** A compact 12-tick strip for lists. */
export function Ticks({ slots }: { slots: Slot[] }) {
  const tick: Record<SlotState, string> = {
    PAID: "bg-paid",
    OVERDUE: "bg-overdue",
    DUE_NOW: "bg-due",
    UPCOMING: "bg-mist",
    WAIVED: "bg-input",
  };
  return (
    <span aria-hidden className="flex gap-[3px]">
      {slots.map((s) => (
        <span key={s.monthNo} className={`h-2 flex-1 rounded-[2px] ${tick[s.state]}`} />
      ))}
    </span>
  );
}
