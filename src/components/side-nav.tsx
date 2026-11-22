"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/** Section links: a sidebar on wide screens, a scrollable tab row on phones. The current page is marked. */
export function SideNav({ links, label }: { links: [href: string, text: string][]; label: string }) {
  const path = usePathname();
  // The longest matching prefix is current, so /member doesn't also light up on /member/draws.
  const current = links.map(([h]) => h).filter((h) => path === h || path.startsWith(h + "/")).sort((a, b) => b.length - a.length)[0];
  return (
    <nav aria-label={label} className="border-b md:w-56 md:shrink-0 md:border-r md:border-b-0">
      <ul className="flex gap-1 overflow-x-auto px-2 py-1.5 md:sticky md:top-0 md:flex-col md:px-3 md:py-4">
        {links.map(([href, text]) => (
          <li key={href} className="shrink-0">
            <Link
              href={href}
              aria-current={href === current ? "page" : undefined}
              className="flex min-h-11 items-center rounded-lg px-3 text-[15px] font-medium whitespace-nowrap hover:bg-mist aria-[current=page]:bg-primary aria-[current=page]:text-primary-foreground"
            >
              {text}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
