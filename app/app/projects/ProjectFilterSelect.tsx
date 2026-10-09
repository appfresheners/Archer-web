"use client";

import Link from "next/link";
import { useState } from "react";
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
  goalOptionsError,
  selectedGoal,
  value,
  query,
  searchParams,
}: {
  goals: ProjectFilterGoalOption[];
  goalOptionsError: boolean;
  selectedGoal: ProjectFilterGoalOption | null;
  value: string;
  query: string;
  searchParams: ListSearchParams;
}) {
  const [goalQuery, setGoalQuery] = useState(query);
  const normalizedQuery = goalQuery.trim().toLowerCase();
  const matchingGoals = normalizedQuery
    ? goals.filter((goal) => goal.goal_text.toLowerCase().includes(normalizedQuery))
    : [];
  const visibleGoals = matchingGoals.slice(0, 50);
  const filterHref = (goal: string | null) =>
    buildListHref("/app/projects", searchParams, {
      goal,
      page: null,
      goalQ: null,
      goalOptionsPage: null,
    });
  const clearSearchHref = buildListHref("/app/projects", searchParams, {
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

      <div className="flex flex-col gap-2" role="search">
          <label
            htmlFor="goalQ-search"
            className="flex min-w-0 flex-1 flex-col gap-1 text-[length:var(--font-size-small)] font-medium text-text-secondary"
          >
            Search goals to filter projects
            <input
              id="goalQ-search"
              type="search"
              value={goalQuery}
              onChange={(event) => setGoalQuery(event.target.value)}
              disabled={goalOptionsError}
              className="min-h-[44px] w-full rounded-[var(--radius-sm)] border border-border-strong bg-surface-raised px-3 py-2 text-text-primary focus:border-primary focus:outline-none focus:ring-2 focus:ring-[var(--color-focus-ring)]"
            />
          </label>
        {goalQuery && (
          <Link
            href={clearSearchHref}
            onClick={() => setGoalQuery("")}
            className="inline-flex min-h-[44px] w-fit items-center text-[length:var(--font-size-small)] font-medium text-primary underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)]"
          >
            Clear search
          </Link>
        )}
      </div>

      {goalOptionsError ? (
        <p role="alert" className="text-text-secondary">
          Goal search is unavailable. Projects are still shown.
        </p>
      ) : normalizedQuery && matchingGoals.length === 0 ? (
        <p role="status" className="text-text-secondary">
          No goals match &apos;{goalQuery.trim()}&apos;.
        </p>
      ) : matchingGoals.length > 0 ? (
        <div className="flex flex-col gap-2">
          <h2 className="text-[length:var(--font-size-small)] font-medium text-text-secondary">
            Matching goals
          </h2>
          <ul className="flex flex-wrap gap-2">
            {visibleGoals.map((goal) => (
              <li key={goal.id}>
                <Link
                  href={filterHref(goal.id)}
                  onClick={() => setGoalQuery("")}
                  aria-current={goal.id === value ? "true" : undefined}
                  className="inline-flex min-h-[44px] items-center rounded-[var(--radius-sm)] border border-border-strong bg-surface-raised px-3 py-2 text-text-primary hover:bg-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)] aria-[current=true]:border-primary aria-[current=true]:font-semibold"
                >
                  {goal.goal_text}
                </Link>
              </li>
            ))}
          </ul>
          {matchingGoals.length > 50 && (
            <p className="text-[length:var(--font-size-small)] text-text-secondary">
              Keep typing to narrow results
            </p>
          )}
        </div>
      ) : null}
    </section>
  );
}