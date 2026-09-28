/**
 * GoalRow — one row in the goals list (Story 4.1).
 *
 * The entire row is a link to the goal detail view (`/app/goals/[id]`, filled
 * in by Story 4.2). It shows the goal text (clamped to 2 lines), a status
 * badge, the target date, the project count, an inline amber stuck count when
 * the goal has ≥1 stuck project, and a trailing chevron.
 *
 * Accessibility: the row is a single focusable link with a ≥44px target, a
 * visible focus ring, and a descriptive accessible name. The stuck count uses
 * the warning tokens (amber) and reads as text to assistive tech.
 */

import type { GoalStatus } from "@/lib/supabase/schema";
import Link from "next/link";
import StatusBadge from "./StatusBadge";

export interface GoalRowData {
  id: string;
  goal_text: string;
  status: GoalStatus;
  target_date: string;
  projectCount: number;
  stuckCount: number;
}

/** Format an ISO date (YYYY-MM-DD) as a short, locale-neutral label. */
function formatTargetDate(iso: string): string {
  // Parse as a plain date to avoid timezone drift on date-only values.
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

function ChevronRight() {
  return (
    <svg
      width={20}
      height={20}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className="shrink-0 text-text-muted"
    >
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}

export default function GoalRow({ goal }: { goal: GoalRowData }) {
  const projectLabel =
    goal.projectCount === 1 ? "1 project" : `${goal.projectCount} projects`;

  return (
    <li>
      <Link
        href={`/app/goals/${goal.id}`}
        className="flex min-h-[44px] items-start gap-3 rounded-[var(--radius-md)] border border-border bg-surface-raised p-[var(--spacing-card-p)] transition-colors hover:border-border-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)]"
      >
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <p className="line-clamp-2 break-words text-[length:var(--font-size-card)] font-semibold text-text-primary">
            {goal.goal_text}
          </p>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[length:var(--font-size-small)] text-text-secondary">
            <StatusBadge status={goal.status} />
            <span>Target {formatTargetDate(goal.target_date)}</span>
            <span aria-hidden="true">·</span>
            <span>{projectLabel}</span>
            {goal.stuckCount > 0 && (
              <span className="inline-flex items-center rounded-[var(--radius-xs)] bg-warning-subtle px-2 py-0.5 font-medium text-warning">
                {goal.stuckCount === 1
                  ? "1 stuck project"
                  : `${goal.stuckCount} stuck projects`}
              </span>
            )}
          </div>
        </div>
        <ChevronRight />
      </Link>
    </li>
  );
}
