"use client";

/**
 * GetClearPanel — the "Get Clear" beat of the weekly review (Story 5.6).
 *
 * Guides the user to inbox zero:
 *   - shows the current unprocessed inbox count,
 *   - offers a brain-dump capture (reuses `InboxCaptureForm`), and
 *   - links out to `/app/inbox` for one-at-a-time processing (there is no
 *     embeddable inline clarify flow; the full clarify wizard is a page).
 *
 * The advance gate lives in `ReviewShell` (Next is disabled while the count is
 * > 0); this panel is presentational. A "Recount" affordance calls the shell's
 * `onRefresh` (which `router.refresh()`es the server page so the count reloads
 * after the user processes items in another tab / returns from /app/inbox).
 */

import InboxCaptureForm from "@/components/inbox/InboxCaptureForm";
import Link from "next/link";

interface GetClearPanelProps {
  unprocessedCount: number;
  /** Re-read the server data (after processing items elsewhere). */
  onRefresh: () => void;
}

export default function GetClearPanel({
  unprocessedCount,
  onRefresh,
}: GetClearPanelProps) {
  const atZero = unprocessedCount === 0;

  return (
    <div className="flex flex-col gap-4 rounded-[var(--radius-md)] border border-border bg-surface p-[var(--spacing-card-p)]">
      <header className="flex flex-col gap-1">
        <h2 className="text-[length:var(--font-size-card)] font-semibold text-text-primary">
          Get Clear
        </h2>
        <p className="text-text-secondary">
          Empty your head, then process the inbox to zero.
        </p>
      </header>

      <section className="flex flex-col gap-2">
        <h3 className="font-medium text-text-primary">Capture anything on your mind</h3>
        <InboxCaptureForm />
      </section>

      <section className="flex flex-col gap-3 rounded-[var(--radius-sm)] border border-border bg-surface-raised p-[var(--spacing-card-p)]">
        {atZero ? (
          <p className="font-medium text-success" role="status">
            Inbox zero. Nothing left to process.
          </p>
        ) : (
          <>
            <p className="text-text-primary" role="status">
              <span className="font-semibold">{unprocessedCount}</span>{" "}
              {unprocessedCount === 1 ? "item" : "items"} left to process.
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <Link
                href="/app/inbox"
                className="inline-flex min-h-[44px] items-center rounded-[var(--radius-sm)] bg-primary px-4 py-2 font-medium text-text-inverse transition-colors hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)]"
              >
                Process inbox →
              </Link>
              <button
                type="button"
                onClick={onRefresh}
                className="inline-flex min-h-[44px] items-center rounded-[var(--radius-sm)] border border-border-strong px-4 py-2 font-medium text-text-primary transition-colors hover:bg-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)]"
              >
                Recount
              </button>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
