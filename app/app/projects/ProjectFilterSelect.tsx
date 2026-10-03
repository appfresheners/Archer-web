"use client";

/**
 * ProjectFilterSelect — the goal filter dropdown for the Projects index.
 *
 * Replaces the per-goal filter chips with a single `<select>` whose value
 * always reflects the current `?goal=` query param (`all` / `none` / a goal
 * uuid). Choosing an option navigates to the matching URL, so the filter stays
 * shareable and back/forward-safe. The parent server component hides this
 * control entirely when there are no goals.
 */

import { useRouter } from "next/navigation";

export interface ProjectFilterGoalOption {
  id: string;
  goal_text: string;
}

export default function ProjectFilterSelect({
  goals,
  value,
}: {
  goals: ProjectFilterGoalOption[];
  /** The resolved filter value: "all" | "none" | a goal uuid. */
  value: string;
}) {
  const router = useRouter();

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const next = e.target.value;
    if (next === "all") {
      router.push("/app/projects");
    } else {
      router.push(`/app/projects?goal=${encodeURIComponent(next)}`);
    }
    router.refresh();
  };

  return (
    <div className="flex flex-col gap-1">
      <label
        htmlFor="project-goal-filter"
        className="text-[length:var(--font-size-small)] font-medium text-text-secondary"
      >
        Filter by goal
      </label>
      <select
        id="project-goal-filter"
        value={value}
        onChange={handleChange}
        className="min-h-[44px] w-full max-w-sm rounded-[var(--radius-sm)] border border-border-strong bg-surface-raised px-3 py-2 text-text-primary focus:border-primary focus:outline-none focus:ring-2 focus:ring-[var(--color-focus-ring)]"
      >
        <option value="all">All goals</option>
        {goals.map((goal) => (
          <option key={goal.id} value={goal.id}>
            {goal.goal_text}
          </option>
        ))}
        <option value="none">No goal</option>
      </select>
    </div>
  );
}
