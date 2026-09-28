/**
 * StatusBadge — a reusable inline status pill for goals and projects.
 *
 * Covers every goal and project status. Colors come from the canonical
 * `--color-status-*`, `--color-*-subtle`, and text tokens in `app/globals.css`
 * (never hardcoded hex). Per DESIGN.md:
 *   - Active     → blue on blue-subtle
 *   - Paused     → amber on amber-subtle
 *   - Someday    → gray outline (transparent bg)
 *   - Completed  → emerald on emerald-subtle
 *   - Archived   → gray on gray-subtle
 *   - Not now    → red on red-subtle
 *
 * The pill is presentational; screen readers read its text label directly.
 */

import type { GoalStatus, ProjectStatus } from "@/lib/supabase/schema";

type AnyStatus = GoalStatus | ProjectStatus;

interface BadgeStyle {
  label: string;
  /** Tailwind classes for background / text / optional border. */
  className: string;
}

const BASE =
  "inline-flex w-fit items-center rounded-[var(--radius-full)] px-2.5 py-0.5 " +
  "text-[length:var(--font-size-caption)] font-medium leading-5";

const STYLES: Record<AnyStatus, BadgeStyle> = {
  active: {
    label: "Active",
    className: "bg-primary-subtle text-primary",
  },
  paused: {
    label: "Paused",
    className: "bg-warning-subtle text-warning",
  },
  not_now: {
    label: "Not now",
    className: "bg-destructive-subtle text-destructive",
  },
  someday: {
    label: "Someday",
    className:
      "border border-[var(--color-status-someday)] text-text-secondary",
  },
  completed: {
    label: "Completed",
    className: "bg-success-subtle text-success",
  },
  archived: {
    label: "Archived",
    className: "bg-surface text-text-secondary",
  },
};

export interface StatusBadgeProps {
  status: AnyStatus;
}

export default function StatusBadge({ status }: StatusBadgeProps) {
  const style = STYLES[status];
  return <span className={`${BASE} ${style.className}`}>{style.label}</span>;
}
