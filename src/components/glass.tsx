import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

export type GlassTone = "violet" | "blue" | "coral" | "pink" | "sunrise" | "peach";

/** A gradient "glass" card with white text (see .glass-* in globals.css). `href` adds the round ↗ link in the corner. */
export function Glass({
  tone,
  href,
  linkLabel,
  className,
  children,
  as: Tag = "section",
  ...rest
}: {
  tone: GlassTone;
  href?: string;
  linkLabel?: string;
  as?: "section" | "article" | "div";
} & React.HTMLAttributes<HTMLElement>) {
  return (
    <Tag className={cn("glass p-5", `glass-${tone}`, href && "lift", className)} {...rest}>
      {href && (
        <Link
          href={href}
          aria-label={linkLabel}
          className="absolute top-4 right-4 grid size-10 place-items-center rounded-full bg-white/20 ring-1 ring-white/35 backdrop-blur-sm transition-colors hover:bg-white/30 focus-visible:outline-2 focus-visible:outline-white"
        >
          <ArrowUpRight className="size-5" strokeWidth={2} aria-hidden />
        </Link>
      )}
      {children}
    </Tag>
  );
}

/** Scheme → card colour, used for scheme headers everywhere. */
export const schemeTone: Record<string, GlassTone> = { UPAHAR: "pink", MANPASAND: "blue", GOLD: "sunrise" };
