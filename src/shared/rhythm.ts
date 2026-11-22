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
