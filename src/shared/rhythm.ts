import { todayInIndia } from "./tracker";

/**
 * Buckets dated amounts into the days of the current month (India time): how many per day, and the totals.
 * Feeds the dot-matrix charts. Items outside the month are ignored.
 */
export function rhythmThisMonth(items: { at: Date; amount: number }[], today = todayInIndia()) {
  const [y, m] = today.split("-").map(Number);
  const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const counts = Array<number>(days).fill(0);
  let total = 0;
  let count = 0;
  for (const { at, amount } of items) {
    const d = todayInIndia(at);
    if (d.slice(0, 7) !== today.slice(0, 7)) continue;
    counts[Number(d.slice(8)) - 1]++;
    total += amount;
    count++;
  }
  return { counts, total, count, today: Number(today.slice(8)) };
}

/**
 * Time buckets for a report period (India dates): this week = its 7 days from Monday, this month = its days,
 * all time = the last 12 months. `from` is where the buckets start.
 */
export function bucketsFor(period: "week" | "month" | "all", today = todayInIndia()) {
  const day = (d: Date) => d.toISOString().slice(0, 10);
  if (period === "all") {
    const [y, m] = today.split("-").map(Number);
    const keys = Array.from({ length: 12 }, (_, i) => new Date(Date.UTC(y, m - 12 + i, 1)).toISOString().slice(0, 7));
    return { from: new Date(`${keys[0]}-01T00:00:00+05:30`), keys, keyOf: (d: Date) => todayInIndia(d).slice(0, 7) };
  }
  const start = new Date(`${today}T00:00:00Z`);
  if (period === "week") start.setUTCDate(start.getUTCDate() - ((start.getUTCDay() + 6) % 7));
  else start.setUTCDate(1);
  const length = period === "week" ? 7 : new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 0)).getUTCDate();
  const keys = Array.from({ length }, (_, i) => day(new Date(start.getTime() + i * 864e5)));
  return { from: new Date(`${keys[0]}T00:00:00+05:30`), keys, keyOf: (d: Date) => todayInIndia(d) };
}

/** Counts and totals of dated amounts per bucket of the period. */
export function bucketed(period: "week" | "month" | "all", items: { at: Date; amount: number }[], today = todayInIndia()) {
  const { keys, keyOf } = bucketsFor(period, today);
  const index = new Map(keys.map((k, i) => [k, i]));
  const counts = Array<number>(keys.length).fill(0);
  const totals = Array<number>(keys.length).fill(0);
  for (const { at, amount } of items) {
    const i = index.get(keyOf(at));
    if (i === undefined) continue;
    counts[i]++;
    totals[i] += amount;
  }
  return { keys, counts, totals };
}
