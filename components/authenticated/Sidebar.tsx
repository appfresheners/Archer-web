"use client";

/**
 * Authenticated app-shell sidebar (client component).
 *
 * Renders the Archer wordmark, the primary navigation (Inbox, Goals, Engage,
 * Weekly Review) from the shared `navItems` list, and a settings/avatar
 * footer. The active item is derived from the current path via `usePathname`
 * and gets the primary-subtle background + primary text along with
 * `aria-current="page"`.
 *
 * Responsiveness is purely CSS/Tailwind breakpoint-driven — never JS-toggled:
 *   - `<768px`      hidden entirely (bottom nav takes over)
 *   - `768–1024px`  56px icon-only rail (labels hidden, accessible name kept
 *                   via `title` + link text that is visually hidden)
 *   - `>1024px`     full 240px sidebar with labels
 *
 * `usePathname` (active state) is the only client concern here; the layout
 * that hosts this component stays a server component doing the auth check.
 */

import Link from "next/link";
import { usePathname } from "next/navigation";
import { navItems } from "./nav-items";

/**
 * True when `href` matches the current path — either exactly or as a path
 * prefix (so `/app/goals/123` still highlights Goals).
 */
function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function Sidebar() {
  const pathname = usePathname() ?? "";

  return (
    <aside
      className="hidden shrink-0 flex-col border-r border-border bg-surface md:flex md:w-14 lg:w-sidebar-w"
      data-testid="app-sidebar"
    >
      {/* Wordmark */}
      <div className="flex h-16 items-center justify-center px-3 lg:justify-start lg:px-6">
        <Link
          href="/app/engage"
          className="rounded-[var(--radius-sm)] font-bold text-text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)]"
          aria-label="Archer — go to Engage"
        >
          {/* Full wordmark on desktop; single-letter mark on the icon rail. */}
          <span className="hidden text-[length:var(--font-size-card)] lg:inline">
            Archer
          </span>
          <span className="text-[length:var(--font-size-card)] lg:hidden" aria-hidden="true">
            A
          </span>
        </Link>
      </div>

      {/* Primary navigation */}
      <nav aria-label="Primary" className="flex-1 px-2 py-2 lg:px-3">
        <ul className="flex flex-col gap-1">
          {navItems.map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  title={item.label}
                  aria-current={active ? "page" : undefined}
                  className={[
                    "flex min-h-[44px] items-center gap-3 rounded-[var(--radius-sm)] px-3 py-2",
                    "justify-center lg:justify-start",
                    "text-[length:var(--font-size-small)] font-medium",
                    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)]",
                    "motion-safe:transition-colors motion-safe:duration-150",
                    active
                      ? "bg-primary-subtle text-primary"
                      : "text-text-secondary hover:bg-surface hover:text-text-primary",
                  ].join(" ")}
                >
                  <span className="shrink-0" aria-hidden="true">
                    {item.icon}
                  </span>
                  {/* Label visible only on the full sidebar (>1024px). On the
                      56px rail it is visually hidden but kept for the
                      accessible name; `title` provides the tooltip. */}
                  <span className="hidden lg:inline">{item.label}</span>
                  <span className="sr-only lg:hidden">{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Settings / avatar footer */}
      <div className="border-t border-border px-2 py-3 lg:px-3">
        <Link
          href="/app/settings"
          title="Settings"
          aria-current={isActive(pathname, "/app/settings") ? "page" : undefined}
          className={[
            "flex min-h-[44px] items-center gap-3 rounded-[var(--radius-sm)] px-3 py-2",
            "justify-center lg:justify-start",
            "text-[length:var(--font-size-small)] font-medium",
            "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)]",
            "motion-safe:transition-colors motion-safe:duration-150",
            isActive(pathname, "/app/settings")
              ? "bg-primary-subtle text-primary"
              : "text-text-secondary hover:bg-surface hover:text-text-primary",
          ].join(" ")}
        >
          {/* Avatar placeholder */}
          <span
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-border text-[length:var(--font-size-caption)] font-medium text-text-secondary"
            aria-hidden="true"
          >
            <svg
              width={16}
              height={16}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
              focusable="false"
            >
              <circle cx={12} cy={8} r={4} />
              <path d="M4 20a8 8 0 0 1 16 0" />
            </svg>
          </span>
          <span className="hidden lg:inline">Settings</span>
          <span className="sr-only lg:hidden">Settings</span>
        </Link>
      </div>
    </aside>
  );
}
