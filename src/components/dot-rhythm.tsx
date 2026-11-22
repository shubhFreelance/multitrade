/**
 * The dot-matrix chart from the references: one column of dots per day or month, lit from the bottom up in
 * proportion to its value. Decorative; the caller states the numbers in text next to it.
 */
export function DotRhythm({
  values,
  rows = 7,
  labels,
  onGlass = true,
  highlight,
  tips,
}: {
  values: number[];
  rows?: number;
  /** Text under the first, middle and last column. */
  labels?: [string, string, string];
  onGlass?: boolean;
  /** Index of a column to mark (e.g. today). */
  highlight?: number;
  /** Hover text per column, e.g. "12 Nov: ₹4,000". The same figures must also be stated in text beside the chart. */
  tips?: string[];
}) {
  const max = Math.max(1, ...values);
  const on = onGlass ? "bg-white" : "bg-primary";
  const off = onGlass ? "bg-white/25" : "bg-mist";
  return (
    // Hidden from screen readers: the caller states the figures in text.
    <div aria-hidden className="flex flex-col gap-1.5">
      <div className="grid items-end gap-x-[3px]" style={{ gridTemplateColumns: `repeat(${values.length}, minmax(0, 1fr))` }}>
        {values.map((v, i) => {
          const lit = v > 0 ? Math.max(1, Math.round((v / max) * rows)) : 0;
          return (
            <div key={i} title={tips?.[i]} className="flex flex-col-reverse items-center gap-[3px] rounded-sm py-0.5 hover:bg-white/15">
              {Array.from({ length: rows }, (_, r) => (
                <span key={r} className={`size-[5px] rounded-full ${r < lit ? on : r === 0 ? off : "bg-transparent"} ${i === highlight && r < lit ? "ring-2 ring-white/40" : ""}`} />
              ))}
            </div>
          );
        })}
      </div>
      {labels && (
        <div className={`flex justify-between text-[12px] ${onGlass ? "text-white/75" : "text-muted-foreground"}`}>
          {labels.map((l, i) => (
            <span key={i}>{l}</span>
          ))}
        </div>
      )}
    </div>
  );
}
