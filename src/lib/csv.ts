/** Rows to CSV text (RFC 4180 quoting). Starts with a BOM so Excel reads Hindi (UTF-8) correctly. */
export function toCsv(rows: (string | number | null | undefined)[][]) {
  const cell = (v: string | number | null | undefined) => {
    const s = v === null || v === undefined ? "" : String(v);
    // Quote anything with a comma, quote or line break; a leading = + - @ is prefixed so spreadsheets don't run it as a formula.
    const safe = /^[=+\-@]/.test(s) && typeof v !== "number" ? `'${s}` : s;
    return /[",\r\n]/.test(safe) ? `"${safe.replaceAll('"', '""')}"` : safe;
  };
  return "﻿" + rows.map((r) => r.map(cell).join(",")).join("\r\n") + "\r\n";
}

/** A CSV download. */
export const csvResponse = (text: string, name: string) =>
  new Response(text, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${name.replaceAll(/[^\w.-]/g, "-")}.csv"`,
      "cache-control": "private, no-store",
    },
  });
