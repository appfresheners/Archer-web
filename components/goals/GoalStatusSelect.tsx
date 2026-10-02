"use client";

/**
 * GoalStatusSelect — an accessible native `<select>` for the six goal statuses.
 *
 * A native select is keyboard-operable and screen-reader friendly out of the
 * box and satisfies the 44px target with the shared control sizing. Used by the
 * goal detail view to change status inline.
 */

import type { GoalStatus } from "@/lib/supabase/schema";

const OPTIONS: { value: GoalStatus; label: string }[] = [
  { value: "active", label: "Active" },
  { value: "paused", label: "Paused" },
  { value: "not_now", label: "Not now" },
  { value: "someday", label: "Someday" },
  { value: "completed", label: "Completed" },
  { value: "archived", label: "Archived" },
];

export interface GoalStatusSelectProps {
  value: GoalStatus;
  onChange: (status: GoalStatus) => void;
  disabled?: boolean;
  id?: string;
}

export default function GoalStatusSelect({
  value,
  onChange,
  disabled,
  id,
}: GoalStatusSelectProps) {
  return (
    <select
      id={id}
      value={value}
      disabled={disabled}
      aria-label="Goal status"
      onChange={(e) => onChange(e.target.value as GoalStatus)}
      className="min-h-[44px] rounded-[var(--radius-sm)] border border-border-strong bg-surface-raised px-3 py-2 text-[length:var(--font-size-small)] text-text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)] disabled:cursor-not-allowed disabled:opacity-60"
    >
      {OPTIONS.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}
