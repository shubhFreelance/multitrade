// Small coloured pieces shared by every page: page headers, section titles, avatars, chips.
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { GlassTone } from "./glass";

export type Tint = GlassTone | "amber";

/**
 * The top of an inner page: an icon in the section's tint, the title and a line of intro, on the plain canvas.
 * Gradients are kept for cards that carry data (client, Nov 2026).
 */
export function PageHeader({
  tone,
  icon: Icon,
  title,
  intro,
  children,
}: {
  tone: GlassTone;
  icon: LucideIcon;
  title: React.ReactNode;
  intro?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <header className="flex items-start gap-3.5 px-1 pt-1">
      <span aria-hidden className={`tint-${tone} text-tint mt-0.5 grid size-11 shrink-0 place-items-center rounded-2xl`}>
        <Icon className="size-5" />
      </span>
      <div className="min-w-0">
        <h1 className="text-[26px] leading-tight font-semibold tracking-tight lg:text-[28px]">{title}</h1>
        {intro && <p className="mt-0.5 max-w-3xl text-muted-foreground">{intro}</p>}
        {children}
      </div>
    </header>
  );
}

/** A section heading with a coloured dot, and an optional count in a matching pill. */
export function SectionTitle({ tint, count, id, children }: { tint: Tint; count?: number; id?: string; children: React.ReactNode }) {
  return (
    <h2 id={id} className="flex items-center gap-2.5 px-1 text-lg font-semibold">
      <span aria-hidden className={`tint-${tint} size-3 rounded-full`} style={{ backgroundColor: "var(--tint-ink)" }} />
      <span>{children}</span>
      {count !== undefined && <span className={`tint-${tint} text-tint rounded-full px-2.5 py-0.5 text-[14px] font-semibold tabular-nums`}>{count}</span>}
    </h2>
  );
}

/** Initials in a tinted circle. */
export function Avatar({ name, tint, className }: { name: string; tint: Tint; className?: string }) {
  const initials = name
    .split(/\s+/)
    .filter((w) => /\p{L}/u.test(w))
    .slice(0, 2)
    .map((w) => [...w][0])
    .join("")
    .toUpperCase();
  return (
    <span aria-hidden className={cn(`tint-${tint} text-tint grid size-11 shrink-0 place-items-center rounded-full text-[15px] font-semibold`, className)}>
      {initials || "•"}
    </span>
  );
}

/** A small tinted label, e.g. a scheme name or a token number. */
export function Chip({ tint, className, children }: { tint: Tint; className?: string; children: React.ReactNode }) {
  return <span className={cn(`tint-${tint} text-tint inline-flex items-center rounded-full px-2.5 py-0.5 text-[13px] font-semibold`, className)}>{children}</span>;
}

/** An icon in a tinted circle, for list rows. */
export function IconChip({ icon: Icon, tint }: { icon: LucideIcon; tint: Tint }) {
  return (
    <span aria-hidden className={`tint-${tint} text-tint grid size-10 shrink-0 place-items-center rounded-full`}>
      <Icon className="size-[18px]" />
    </span>
  );
}
