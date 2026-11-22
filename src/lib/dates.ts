// Due dates are calendar days ("YYYY-MM-DD"), so they are formatted in UTC to avoid shifting by a day.
const intl = (locale: string) => (locale === "hi" ? "hi-IN" : "en-IN");

/** "2026-12-01" → "1 Dec 2026" / "1 दिस॰ 2026" */
export const formatDay = (day: string, locale: string) =>
  new Intl.DateTimeFormat(intl(locale), { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(day));

/** "2026-12-01" → "Dec" / "दिस॰" */
export const formatMonthShort = (day: string, locale: string) =>
  new Intl.DateTimeFormat(intl(locale), { month: "short", timeZone: "UTC" }).format(new Date(day));

/** "2026-12-01" → "December 2026" */
export const formatMonthYear = (day: string, locale: string) =>
  new Intl.DateTimeFormat(intl(locale), { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(day));
