"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
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
  const router = useRouter();
  const pickerId = useId();
  const listboxId = `${pickerId}-goals`;
  const activeOptionRef = useRef<HTMLDivElement | null>(null);
  const [goalQuery, setGoalQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const normalizedQuery = goalQuery.trim().toLowerCase();
  const matchingGoals = normalizedQuery
    ? goals.filter((goal) => goal.goal_text.toLowerCase().includes(normalizedQuery))
    : goals;
  const visibleGoals = matchingGoals.slice(0, 50);
  const activeGoal = visibleGoals[activeIndex];
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

  useEffect(() => {
    if (isOpen) activeOptionRef.current?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, isOpen]);

  function openPicker() {
    setIsOpen(true);
    setActiveIndex(-1);
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setIsOpen(true);
      setActiveIndex((current) =>
        Math.min(current < 0 ? 0 : current + 1, visibleGoals.length - 1),
      );
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setIsOpen(true);
      setActiveIndex((current) =>
        Math.max(current < 0 ? visibleGoals.length - 1 : current - 1, 0),
      );
    } else if (event.key === "Enter" && isOpen && activeGoal) {
      event.preventDefault();
      setIsOpen(false);
      setActiveIndex(-1);
      router.push(filterHref(activeGoal.id));
    } else if (event.key === "Escape" && isOpen) {
      event.preventDefault();
      setIsOpen(false);
      setActiveIndex(-1);
      setGoalQuery("");
    } else if (event.key === "Tab") {
      setIsOpen(false);
      setActiveIndex(-1);
    }
  }

  const matchAnnouncement = `${matchingGoals.length} matching ${matchingGoals.length === 1 ? "goal" : "goals"}${
    normalizedQuery ? ` for ${goalQuery.trim()}` : ""
  }`;

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
        <div className="flex flex-col gap-1">
          <label
            htmlFor={`${pickerId}-input`}
            className="flex min-w-0 flex-1 flex-col gap-1 text-[length:var(--font-size-small)] font-medium text-text-secondary"
          >
            Search goals to filter projects
            <input
              id={`${pickerId}-input`}
              type="search"
              role="combobox"
              aria-autocomplete="list"
              aria-expanded={isOpen}
              aria-controls={listboxId}
              aria-activedescendant={activeGoal ? `${pickerId}-option-${activeGoal.id}` : undefined}
              autoComplete="off"
              value={goalQuery}
              onFocus={openPicker}
              onClick={openPicker}
              onChange={(event) => {
                setGoalQuery(event.target.value);
                setIsOpen(true);
                setActiveIndex(-1);
              }}
              onKeyDown={handleKeyDown}
              onBlur={() => {
                setIsOpen(false);
                setActiveIndex(-1);
              }}
              disabled={goalOptionsError}
              className="min-h-[44px] w-full rounded-[var(--radius-sm)] border border-border-strong bg-surface-raised px-3 py-2 text-text-primary focus:border-primary focus:outline-none focus:ring-2 focus:ring-[var(--color-focus-ring)]"
            />
          </label>
        </div>
        {(goalQuery || query) && (
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
      ) : (
        <div
          hidden={!isOpen}
          className="rounded-[var(--radius-sm)] border border-border-strong bg-surface-raised shadow-lg"
        >
          {normalizedQuery && matchingGoals.length === 0 && (
            <p role="status" className="px-3 py-3 text-text-secondary">
              No goals match
            </p>
          )}
          {!normalizedQuery && matchingGoals.length === 0 && (
            <p role="status" className="px-3 py-3 text-text-secondary">
              No goals available
            </p>
          )}
          <ul
            id={listboxId}
            role="listbox"
            aria-label="Matching goals"
            className="max-h-64 overflow-y-auto"
          >
            {visibleGoals.map((goal, index) => (
              <li key={goal.id}>
                <div
                  ref={index === activeIndex ? activeOptionRef : undefined}
                  id={`${pickerId}-option-${goal.id}`}
                  role="option"
                  aria-selected={goal.id === value}
                  aria-current={goal.id === value ? "true" : undefined}
                  onMouseDown={(event) => event.preventDefault()}
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => {
                    setIsOpen(false);
                    setActiveIndex(-1);
                    setGoalQuery("");
                    router.push(filterHref(goal.id));
                  }}
                  className={`block min-h-[44px] cursor-pointer px-3 py-2 text-[length:var(--font-size-small)] text-text-primary ${
                    index === activeIndex
                      ? "bg-primary-subtle"
                      : goal.id === value
                        ? "border-l-2 border-primary bg-surface"
                        : "hover:bg-surface"
                  }`}
                >
                  {goal.goal_text}
                </div>
              </li>
            ))}
          </ul>
          {matchingGoals.length > 50 && (
            <p className="border-t border-border px-3 py-2 text-[length:var(--font-size-small)] text-text-secondary">
              Keep typing to narrow results
            </p>
          )}
        </div>
      )}
      <span className="sr-only" aria-live="polite" aria-atomic="true">
        {matchAnnouncement}
      </span>
    </section>
  );
}