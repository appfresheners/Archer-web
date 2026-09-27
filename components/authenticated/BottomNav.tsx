"use client";

/**
 * Bottom navigation bar (client component).
 *
 * Shown only on small viewports (`<768px`) where the sidebar is hidden. It
 * lists the same four destinations from the shared `navItems` list (using the
 * short labels), with the active item derived from the current path via
 * `usePathname` and marked with `aria-current="page"`.
 *
 * Visibility is CSS/Tailwind-driven (`flex md:hidden`) — never JS-toggled.
 */

import Link from "next/link";
import { usePathname } from "next/navigation";
import { navItems } from "./nav-items";

function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function BottomNav() {
  const pathname = usePathname() ?? "";

  return (
    <nav
      aria-label="Primary"
      data-testid="app-bottom-nav"
      className="fixed inset-x-0 bottom-0 z-40 flex border-t border-border bg-surface md:hidden"
    >
      {navItems.map((item) => {
        const active = isActive(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={[
              "flex min-h-[44px] flex-1 flex-col items-center justify-center gap-1 py-2",
              "text-[length:var(--font-size-caption)] font-medium",
              "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--color-focus-ring)]",
              "motion-safe:transition-colors motion-safe:duration-150",
              active
                ? "bg-primary-subtle text-primary"
                : "text-text-secondary hover:text-text-primary",
            ].join(" ")}
          >
            <span aria-hidden="true">{item.icon}</span>
            <span>{item.shortLabel}</span>
          </Link>
        );
      })}
    </nav>
  );
}
