"use client";

import {
  Banknote,
  Bell,
  BookOpen,
  Boxes,
  CalendarRange,
  FileText,
  Gift,
  Home,
  Layers,
  Megaphone,
  Package,
  Plus,
  Trophy,
  User,
  UserPlus,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

// Icons by name: the layouts are server components and can't pass icon components to this client one.
const icons = {
  home: Home,
  join: Plus,
  draws: Trophy,
  messages: Bell,
  me: User,
  members: Users,
  enrol: UserPlus,
  commission: Wallet,
  schemes: BookOpen,
  batches: Layers,
  products: Package,
  agents: Users,
  cash: Banknote,
  fulfilment: Gift,
  network: Boxes,
  campaign: Megaphone,
  invoices: FileText,
  calendar: CalendarRange,
} satisfies Record<string, LucideIcon>;
export type NavIcon = keyof typeof icons;
export type NavLink = { href: string; text: string; short?: string; icon: NavIcon; badge?: number };

/**
 * Section links. Wide screens: a white sidebar. Phones: a floating dock at the bottom ("dock", up to 5 links)
 * or a wrapping row of pills ("pills", for the admin's many sections). The current page is marked.
 */
export function SideNav({ links, label, mobile }: { links: NavLink[]; label: string; mobile: "dock" | "pills" }) {
  const path = usePathname();
  // The longest matching prefix is current, so /member doesn't also light up on /member/draws.
  const current = links.map((l) => l.href).filter((h) => path === h || path.startsWith(h + "/")).sort((a, b) => b.length - a.length)[0];
  const badge = (l: NavLink, dark: boolean) =>
    !!l.badge &&
    l.href !== current && (
      <span className={`grid h-5 min-w-5 place-items-center rounded-full px-1 text-[12px] font-semibold tabular-nums ${dark ? "bg-primary text-primary-foreground" : "bg-overdue text-white"}`}>
        {l.badge}
      </span>
    );

  return (
    <>
      {/* Wide screens */}
      <nav aria-label={label} className="hidden md:block md:w-64 md:shrink-0 md:pl-8">
        <ul className="sticky top-4 flex flex-col gap-1 rounded-[28px] bg-card p-3">
          {links.map((l) => {
            const Icon = icons[l.icon];
            return (
              <li key={l.href}>
                <Link
                  href={l.href}
                  aria-current={l.href === current ? "page" : undefined}
                  className="flex min-h-11 items-center gap-3 rounded-2xl px-3 text-[15px] font-medium text-muted-foreground hover:bg-muted hover:text-foreground aria-[current=page]:bg-canvas aria-[current=page]:font-semibold aria-[current=page]:text-foreground"
                >
                  <Icon aria-hidden className="size-[18px] shrink-0" />
                  <span className="flex-1">{l.text}</span>
                  {badge(l, true)}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Phones */}
      {mobile === "dock" ? (
        <nav aria-label={label} className="fixed inset-x-3 bottom-3 z-40 md:hidden">
          <ul className="grid rounded-full bg-card p-1.5 shadow-[0_8px_30px_rgb(0_0_0/0.12)]" style={{ gridTemplateColumns: `repeat(${links.length}, minmax(0, 1fr))` }}>
            {links.map((l) => {
              const Icon = icons[l.icon];
              return (
                <li key={l.href}>
                  <Link
                    href={l.href}
                    aria-current={l.href === current ? "page" : undefined}
                    className="relative flex h-14 flex-col items-center justify-center gap-0.5 rounded-full text-[12px] leading-tight font-medium text-muted-foreground aria-[current=page]:bg-primary aria-[current=page]:text-primary-foreground"
                  >
                    <Icon aria-hidden className="size-5" />
                    <span className="max-w-full truncate px-1">{l.short ?? l.text}</span>
                    <span className="absolute top-1 right-[18%]">{badge(l, false)}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      ) : (
        <nav aria-label={label} className="md:hidden">
          {/* Admins have many sections: one row that scrolls sideways. */}
          <ul className="flex gap-1.5 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
            {links.map((l) => (
              <li key={l.href}>
                <Link
                  href={l.href}
                  aria-current={l.href === current ? "page" : undefined}
                  className="flex min-h-10 items-center rounded-full bg-card px-3.5 text-[14px] font-medium whitespace-nowrap aria-[current=page]:bg-primary aria-[current=page]:text-primary-foreground"
                >
                  {l.text}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      )}
    </>
  );
}
