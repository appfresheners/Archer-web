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
import { useRef, useState } from "react";
import { navItems } from "./nav-items";

function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function BottomNav() {
  const pathname = usePathname() ?? "";
  const primaryItems = navItems.filter((item) => item.mobileGroup === "primary");
  const moreItems = navItems.filter((item) => item.mobileGroup === "more");
  const moreIsActive = moreItems.some((item) => isActive(pathname, item.href));
  const [moreOpen, setMoreOpen] = useState(false);
  const moreButtonRef = useRef<HTMLButtonElement>(null);

  return (
    <nav
      aria-label="Primary"
      data-testid="app-bottom-nav"
      className="fixed inset-x-0 bottom-0 z-40 flex border-t border-border bg-surface md:hidden"
    >
      {primaryItems.map((item) => {
        const active = isActive(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            onClick={() => setMoreOpen(false)}
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
      <div className="relative flex min-w-0 flex-1">
        <button
          type="button"
          ref={moreButtonRef}
          aria-expanded={moreOpen}
          aria-controls="mobile-more-navigation"
          aria-current={moreIsActive && !moreOpen ? "page" : undefined}
          onClick={() => setMoreOpen((open) => !open)}
          className={[
            "flex min-h-[44px] w-full flex-col items-center justify-center gap-1 py-2",
            "text-[length:var(--font-size-caption)] font-medium",
            "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--color-focus-ring)]",
            "motion-safe:transition-colors motion-safe:duration-150",
            moreIsActive
              ? "bg-primary-subtle text-primary"
              : "text-text-secondary hover:text-text-primary",
          ].join(" ")}
        >
          <svg
            width={20}
            height={20}
            viewBox="0 0 24 24"
            fill="currentColor"
            aria-hidden="true"
            focusable="false"
          >
            <circle cx={5} cy={12} r={1.8} />
            <circle cx={12} cy={12} r={1.8} />
            <circle cx={19} cy={12} r={1.8} />
          </svg>
          <span>More</span>
        </button>
        <ul
          id="mobile-more-navigation"
          hidden={!moreOpen}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.preventDefault();
              setMoreOpen(false);
              moreButtonRef.current?.focus();
            }
          }}
          className="absolute bottom-full right-0 w-56 border border-border bg-surface shadow-lg"
        >
          {moreItems.map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  onClick={() => setMoreOpen(false)}
                  className={[
                    "flex min-h-[44px] items-center gap-3 px-4 py-2 text-[length:var(--font-size-small)] font-medium",
                    "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--color-focus-ring)]",
                    active
                      ? "bg-primary-subtle text-primary"
                      : "text-text-secondary hover:bg-surface-raised hover:text-text-primary",
                  ].join(" ")}
                >
                  <span aria-hidden="true">{item.icon}</span>
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </nav>
  );
}
