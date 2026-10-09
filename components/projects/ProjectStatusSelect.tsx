"use client";

/**
 * ProjectStatusSelect — an accessible native `<select>` for the five project
 * statuses (narrower than goal statuses: no Not now). Mirrors
 * `GoalStatusSelect`. Keyboard-operable and screen-reader friendly by default.
 */

import type { ProjectStatus } from "@/lib/supabase/schema";

const OPTIONS: { value: ProjectStatus; label: string }[] = [
  { value: "active", label: "Active" },
  { value: "paused", label: "Paused" },
  { value: "someday", label: "Someday/Maybe" },
  { value: "completed", label: "Completed" },
  { value: "archived", label: "Archived" },
];

export interface ProjectStatusSelectProps {
  value: ProjectStatus;
  onChange: (status: ProjectStatus) => void;
  disabled?: boolean;
  id?: string;
}

export default function ProjectStatusSelect({
  value,
  onChange,
  disabled,
  id,
}: ProjectStatusSelectProps) {
  return (
    <select
      id={id}
      value={value}
      disabled={disabled}
      aria-label="Project status"
      onChange={(e) => onChange(e.target.value as ProjectStatus)}
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
