import { describe, expect, it } from "vitest";
import { summarize, todayInIndia, type InstallmentRow } from "./tracker";

const year = (statuses: InstallmentRow["status"][]): InstallmentRow[] =>
  statuses.map((status, i) => ({ monthNo: i + 1, dueDate: `2027-${String(i + 1).padStart(2, "0")}-01`, amount: 2_000_00, status }));

describe("tracker summary", () => {
  it("counts paid months and the paid total exactly", () => {
    const s = summarize(year(["PAID", "PAID", "PAID", "DUE", "DUE", "DUE", "DUE", "DUE", "DUE", "DUE", "DUE", "DUE"]), "2027-03-15");
    expect(s).toMatchObject({ total: 12, paidCount: 3, paidTotal: 6_000_00, dueNowCount: 0, dueNowTotal: 0 });
    expect(s.next).toMatchObject({ monthNo: 4, state: "UPCOMING" });
  });

  it("a month is due from its due date, and overdue months count towards what is owed now", () => {
    const s = summarize(year(["PAID", "OVERDUE", "DUE", "DUE", "DUE", "DUE", "DUE", "DUE", "DUE", "DUE", "DUE", "DUE"]), "2027-03-01");
    expect(s.slots.map((x) => x.state).slice(0, 4)).toEqual(["PAID", "OVERDUE", "DUE_NOW", "UPCOMING"]);
    expect(s).toMatchObject({ dueNowCount: 2, dueNowTotal: 4_000_00 });
    expect(s.next?.monthNo).toBe(2); // the oldest unpaid month comes first
  });

  it("waived months are neither paid nor owed; a fully settled enrolment has no next payment", () => {
    const s = summarize(year(["PAID", "PAID", "PAID", "WAIVED", "WAIVED", "WAIVED", "WAIVED", "WAIVED", "WAIVED", "WAIVED", "WAIVED", "WAIVED"]), "2027-12-31");
    expect(s).toMatchObject({ paidCount: 3, paidTotal: 6_000_00, dueNowCount: 0, next: null });
  });

  it("orders months even if the rows come unsorted", () => {
    const rows = year(Array(12).fill("DUE")).reverse();
    expect(summarize(rows, "2026-01-01").slots.map((s) => s.monthNo)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  });

  it("uses India's date, not the server's UTC date", () => {
    // 1 Feb 2027, 00:30 in India is still 31 Jan in UTC.
    expect(todayInIndia(new Date("2027-01-31T19:00:00Z"))).toBe("2027-02-01");
    expect(todayInIndia(new Date("2027-01-31T18:00:00Z"))).toBe("2027-01-31");
  });
});
