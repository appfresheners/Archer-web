/**
 * ShutdownAlreadyComplete (client component) — Story 10.1.
 *
 * Displays the already-completed state when user has already finished their
 * daily shutdown today. Shows "Shutdown complete for today" message, the saved
 * intention (if provided), the completion timestamp, and a "Return to Engage"
 * link. No form, no editing — shutdown is one-time per day.
 */

"use client";

import Link from "next/link";

interface ShutdownAlreadyCompleteProps {
  completedAt: string;
  intention: string | null;
}

export default function ShutdownAlreadyComplete({
  completedAt,
  intention,
}: ShutdownAlreadyCompleteProps) {
  const timestamp = new Date(completedAt).toLocaleString(undefined, {
    dateStyle: "long",
    timeStyle: "short",
  });

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-[length:var(--font-size-section)] font-bold text-text-primary">
          Daily Shutdown
        </h1>
      </header>

      <div className="rounded-[var(--radius-md)] border border-border bg-surface p-[var(--spacing-card-p)]">
        <div className="flex flex-col gap-4">
          <div className="flex items-start gap-3">
            <svg
              width={24}
              height={24}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="shrink-0 text-primary"
              aria-hidden="true"
            >
              <circle cx={12} cy={12} r={10} />
              <path d="m9 12 2 2 4-4" />
            </svg>
            <div className="flex flex-col gap-1">
              <p className="font-semibold text-text-primary">
                Shutdown complete for today
              </p>
              <p className="text-[length:var(--font-size-small)] text-text-secondary">
                Completed {timestamp}
              </p>
            </div>
          </div>

          {intention && (
            <div className="border-t border-border pt-4">
              <p className="mb-2 text-[length:var(--font-size-small)] font-medium text-text-secondary">
                Tomorrow&apos;s intention:
              </p>
              <p className="text-text-primary">{intention}</p>
            </div>
          )}
        </div>
      </div>

      <Link
        href="/app/engage"
        className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-[var(--radius-sm)] bg-primary px-[var(--spacing-button-px)] py-[var(--spacing-button-py)] text-[length:var(--font-size-body)] font-medium text-text-inverse focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)] motion-safe:transition-colors motion-safe:duration-150 hover:bg-primary-hover"
      >
        Return to Engage
      </Link>
    </div>
  );
}
