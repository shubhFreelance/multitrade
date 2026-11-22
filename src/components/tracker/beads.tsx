import { getLocale, getTranslations } from "next-intl/server";
import { formatMonthShort, formatMonthYear } from "@/lib/dates";
import { formatPaise } from "@/lib/money";
import type { Slot, SlotState } from "@/shared/tracker";

// Each state differs in shape as well as colour, so it reads without colour too.
// Green means the member has paid: solid when confirmed, light and dashed while the office checks handed-over cash.
const bead: Record<SlotState, string> = {
  PAID: "bg-paid text-white",
  PENDING: "bg-paid/15 text-paid border-2 border-dashed border-paid",
  OVERDUE: "bg-overdue text-white",
  DUE_NOW: "bg-card ring-[3px] ring-inset ring-due",
  UPCOMING: "bg-mist",
  WAIVED: "bg-card ring-1 ring-inset ring-input [background-image:repeating-linear-gradient(135deg,var(--mist)_0_3px,transparent_3px_6px)]",
};
const glyph: Partial<Record<SlotState, string>> = { PAID: "✓", OVERDUE: "!", PENDING: "₹" };
// Colour of the status word in the tooltip.
const stateInk: Record<SlotState, string> = {
  PAID: "text-[#7ee2a4]",
  PENDING: "text-[#7ee2a4]",
  OVERDUE: "text-[#ff9b92]",
  DUE_NOW: "text-[#ffd27a]",
  UPCOMING: "text-white/75",
  WAIVED: "text-white/75",
};

/** The months of an enrolment as beads on a thread, six to a row. Hovering a bead shows its month, status and amount. */
export async function Beads({ slots }: { slots: Slot[] }) {
  const locale = await getLocale();
  const t = await getTranslations("tracker.state");
  const rows = [slots.slice(0, 6), slots.slice(6)].filter((r) => r.length);

  return (
    <ol className="flex flex-col gap-3">
      {rows.map((row, r) => (
        <li key={r}>
          <ol className="relative grid grid-cols-6 before:absolute before:inset-x-[8%] before:top-[17px] before:h-px before:bg-input">
            {row.map((s, i) => (
              <li key={s.monthNo} className="group relative flex flex-col items-center gap-1">
                <span aria-hidden className={`grid size-[34px] place-items-center rounded-full text-base font-bold transition-transform group-hover:scale-110 motion-reduce:transition-none ${bead[s.state]}`}>
                  {glyph[s.state]}
                </span>
                <span aria-hidden className="text-[12px] leading-none text-muted-foreground">
                  {formatMonthShort(s.dueDate, locale)}
                </span>
                {/* Tooltip: kept inside the card at the row's ends. Screen readers get the same words below. */}
                <span
                  aria-hidden
                  className={`pointer-events-none absolute bottom-full z-20 mb-2 rounded-xl bg-primary px-3 py-2 text-left text-[13px] leading-snug whitespace-nowrap text-primary-foreground opacity-0 shadow-lg transition-opacity group-hover:opacity-100 ${
                    i === 0 ? "left-0" : i === row.length - 1 ? "right-0" : "left-1/2 -translate-x-1/2"
                  }`}
                >
                  <span className="block font-semibold">{formatMonthYear(s.dueDate, locale)}</span>
                  <span className={`font-medium ${stateInk[s.state]}`}>{t(s.state)}</span>
                  <span className="text-white/80">, {formatPaise(s.amount)}</span>
                </span>
                <span className="sr-only">
                  {formatMonthYear(s.dueDate, locale)}: {t(s.state)}, {formatPaise(s.amount)}
                </span>
              </li>
            ))}
          </ol>
        </li>
      ))}
    </ol>
  );
}

/** A compact 12-tick strip for lists; each tick says its month and status on hover. */
export async function Ticks({ slots }: { slots: Slot[] }) {
  const locale = await getLocale();
  const t = await getTranslations("tracker.state");
  const tick: Record<SlotState, string> = {
    PAID: "bg-paid",
    PENDING: "bg-paid/40",
    OVERDUE: "bg-overdue",
    DUE_NOW: "bg-due",
    UPCOMING: "bg-mist",
    WAIVED: "bg-input",
  };
  return (
    <span aria-hidden className="flex gap-[3px]">
      {slots.map((s) => (
        <span
          key={s.monthNo}
          title={`${formatMonthYear(s.dueDate, locale)}: ${t(s.state)}, ${formatPaise(s.amount)}`}
          className={`h-2 flex-1 rounded-[2px] ${tick[s.state]}`}
        />
      ))}
    </span>
  );
}
