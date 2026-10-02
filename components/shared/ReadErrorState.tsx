"use client";

import { useRouter } from "next/navigation";

/**
 * Minimal read-failure state with a Retry action.
 *
 * Rendered by server pages when a transient backend/network error prevents
 * loading their data. Retry re-runs the server component in place via
 * `router.refresh()` (no full page reload, no state held by this component).
 */
export default function ReadErrorState() {
  const router = useRouter();

  return (
    <div
      role="alert"
      className="flex flex-col items-start gap-3 rounded-[var(--radius-md)] border border-border bg-surface p-[var(--spacing-card-p)]"
    >
      <p className="text-text-secondary">
        Something went wrong loading this view. Please try again.
      </p>
      <button
        type="button"
        onClick={() => router.refresh()}
        className="inline-flex min-h-[44px] items-center rounded-[var(--radius-sm)] border border-border-strong px-4 py-2 font-medium text-text-primary transition-colors hover:bg-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)]"
      >
        Retry
      </button>
    </div>
  );
}
