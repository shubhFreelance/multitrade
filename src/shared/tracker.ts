// How an enrolment's installments look to a member or agent. Pure functions: shared by web, API and the mobile app.

export type InstallmentStatus = "DUE" | "PAID" | "OVERDUE" | "WAIVED";
export type SlotState = "PAID" | "WAIVED" | "PENDING" | "OVERDUE" | "DUE_NOW" | "UPCOMING"; // PENDING: cash given to the agent, not yet verified
// dueDate "YYYY-MM-DD"; receiptId is the successful payment of a PAID month; pending: cash awaiting verification
export type InstallmentRow = {
  monthNo: number;
  dueDate: string;
  amount: number;
  status: InstallmentStatus;
  receiptId?: string | null;
  pending?: boolean;
  id?: string;
};
export type Slot = InstallmentRow & { state: SlotState };

export type TrackerSummary = {
  slots: Slot[];
  total: number;
  paidCount: number;
  paidTotal: number; // paise
  next: Slot | null; // earliest month not paid, waived or covered by pending cash
  dueNowCount: number; // overdue + due today or earlier
  dueNowTotal: number; // paise
  pendingCount: number; // months with cash awaiting verification (not counted as paid)
  pendingTotal: number; // paise
};

/** Today's date in India as "YYYY-MM-DD". The server may run in UTC; due dates are Indian calendar days. */
export const todayInIndia = (now = new Date()) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(now);

/** DUE installments split into due-now and upcoming by date. OVERDUE is set by the overdue job (Feature 13), not here. */
export function slotState(i: InstallmentRow, today: string): SlotState {
  if (i.status === "PAID" || i.status === "WAIVED") return i.status;
  if (i.pending) return "PENDING";
  if (i.status === "OVERDUE") return "OVERDUE";
  return i.dueDate <= today ? "DUE_NOW" : "UPCOMING";
}

export function summarize(installments: InstallmentRow[], today: string): TrackerSummary {
  const slots = [...installments].sort((a, b) => a.monthNo - b.monthNo).map((i) => ({ ...i, state: slotState(i, today) }));
  const paid = slots.filter((s) => s.state === "PAID");
  const dueNow = slots.filter((s) => s.state === "OVERDUE" || s.state === "DUE_NOW");
  const pending = slots.filter((s) => s.state === "PENDING");
  const sum = (xs: Slot[]) => xs.reduce((t, s) => t + s.amount, 0);
  return {
    slots,
    total: slots.length,
    paidCount: paid.length,
    // shortcut: totals come from PAID installments; once payments exist (Feature 7) an installment is PAID only via a confirmed payment of its amount, so this equals the payment total until part-payments are allowed.
    paidTotal: sum(paid),
    next: slots.find((s) => s.state !== "PAID" && s.state !== "WAIVED" && s.state !== "PENDING") ?? null,
    dueNowCount: dueNow.length,
    dueNowTotal: sum(dueNow),
    pendingCount: pending.length,
    pendingTotal: sum(pending),
  };
}
