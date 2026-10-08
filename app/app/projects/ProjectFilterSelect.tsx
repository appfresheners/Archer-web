import Link from "next/link";
import ListSearch from "@/components/shared/ListSearch";
import Pagination from "@/components/shared/Pagination";
import {
  buildListHref,
  type ListSearchParams,
} from "@/lib/lists/search-pagination";

export interface ProjectFilterGoalOption {
  id: string;
  goal_text: string;
}

export default function ProjectFilterSelect({
  goals,
  selectedGoal,
  value,
  query,
  page,
  total,
  searchParams,
}: {
  goals: ProjectFilterGoalOption[];
  selectedGoal: ProjectFilterGoalOption | null;
  value: string;
  query: string;
  page: number;
  total: number;
  searchParams: ListSearchParams;
}) {
  const filterHref = (goal: string | null) =>
    buildListHref("/app/projects", searchParams, {
      goal,
      page: null,
      goalQ: null,
      goalOptionsPage: null,
    });

  return (
    <section className="flex flex-col gap-3">
      <form
        action="/app/projects"
        method="get"
        className="flex flex-wrap items-end gap-2"
      >
        {Object.entries(searchParams).flatMap(([key, rawValue]) => {
          if (
            key === "goal" ||
            key === "page" ||
            key === "goalQ" ||
            key === "goalOptionsPage" ||
            rawValue === undefined
          ) {
            return [];
          }
          return (Array.isArray(rawValue) ? rawValue : [rawValue]).map(
            (item, index) => (
              <input
                key={`${key}-${index}`}
                type="hidden"
                name={key}
                value={item}
              />
            ),
          );
        })}
        <div className="flex flex-col gap-1">
          <label
            htmlFor="project-goal-filter"
            className="text-[length:var(--font-size-small)] font-medium text-text-secondary"
          >
            Filter by goal
          </label>
          <select
            id="project-goal-filter"
            name="goal"
            defaultValue={value}
            className="min-h-[44px] w-full max-w-sm rounded-[var(--radius-sm)] border border-border-strong bg-surface-raised px-3 py-2 text-text-primary focus:border-primary focus:outline-none focus:ring-2 focus:ring-[var(--color-focus-ring)]"
          >
            <option value="all">All goals</option>
            {selectedGoal && (
              <option value={selectedGoal.id}>{selectedGoal.goal_text}</option>
            )}
            <option value="none">No goal</option>
          </select>
        </div>
        <button
          type="submit"
          className="inline-flex min-h-[44px] items-center rounded-[var(--radius-sm)] border border-border-strong px-4 py-2 font-medium text-text-primary transition-colors hover:bg-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)]"
        >
          Apply filter
        </button>
      </form>

      <ListSearch
        action="/app/projects"
        label="Search goals to filter projects"
        query={query}
        queryKey="goalQ"
        pageKey="goalOptionsPage"
        searchParams={searchParams}
      />

      {query && total === 0 ? (
        <p className="text-text-secondary">No goals match &apos;{query}&apos;.</p>
      ) : goals.length > 0 ? (
        <div className="flex flex-col gap-2">
          <h2 className="text-[length:var(--font-size-small)] font-medium text-text-secondary">
            Matching goals
          </h2>
          <ul className="flex flex-wrap gap-2">
            {goals.map((goal) => (
              <li key={goal.id}>
                <Link
                  href={filterHref(goal.id)}
                  aria-current={goal.id === value ? "true" : undefined}
                  className="inline-flex min-h-[44px] items-center rounded-[var(--radius-sm)] border border-border-strong bg-surface-raised px-3 py-2 text-text-primary hover:bg-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)] aria-[current=true]:border-primary aria-[current=true]:font-semibold"
                >
                  {goal.goal_text}
                </Link>
              </li>
            ))}
          </ul>
          <Pagination
            action="/app/projects"
            page={page}
            total={total}
            searchParams={searchParams}
            pageKey="goalOptionsPage"
          />
        </div>
      ) : null}
    </section>
  );
}