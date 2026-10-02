/**
 * StuckIndicator — the shared amber "this project is stuck" band (Story 4.5).
 *
 * Shown wherever a project is Active with zero committed next actions. It uses
 * the warning tokens and `role="alert"` so it is announced and never rendered
 * quietly, with a "Commit one now" affordance. Presentational + reusable (the
 * project detail page here, and the Engage view in Epic 5).
 *
 * `onCommitNow` (optional) wires the CTA to an in-page action (e.g. focus the
 * action list); when absent the CTA falls back to an anchor to `#actions`.
 */

"use client";

export interface StuckIndicatorProps {
  onCommitNow?: () => void;
}

/** The canonical stuck-project message — shared so surfaces cannot drift. */
export const STUCK_MESSAGE =
  "No committed next action — this project is stuck.";

export default function StuckIndicator({ onCommitNow }: StuckIndicatorProps) {
  return (
    <div
      role="alert"
      className="flex flex-col gap-2 rounded-[var(--radius-md)] border-l-4 border-[var(--color-warning)] bg-warning-subtle px-[var(--spacing-card-p)] py-3 text-[length:var(--font-size-small)] sm:flex-row sm:items-center sm:justify-between"
    >
      <span className="font-medium text-warning">{STUCK_MESSAGE}</span>
      {onCommitNow ? (
        <button
          type="button"
          onClick={onCommitNow}
          className="inline-flex min-h-[44px] w-fit items-center rounded-[var(--radius-sm)] border border-[var(--color-warning)] px-4 py-2 font-medium text-warning transition-colors hover:bg-warning/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)]"
        >
          Commit one now
        </button>
      ) : (
        <a
          href="#actions"
          className="inline-flex min-h-[44px] w-fit items-center rounded-[var(--radius-sm)] border border-[var(--color-warning)] px-4 py-2 font-medium text-warning transition-colors hover:bg-warning/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)]"
        >
          Commit one now
        </a>
      )}
    </div>
  );
}
