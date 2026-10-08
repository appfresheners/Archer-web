/** Project list inside the authenticated `/app` shell. */

import StatusBadge from "@/components/goals/StatusBadge";
import ListSearch from "@/components/shared/ListSearch";
import Pagination from "@/components/shared/Pagination";
import ReadErrorState from "@/components/shared/ReadErrorState";
import {
  clampPage,
  escapeIlikePattern,
  escapePostgrestFilterValue,
  getPageRange,
  LIST_PAGE_SIZE,
  parseListQuery,
  type ListSearchParams,
} from "@/lib/lists/search-pagination";
import type { ReadListResult } from "@/lib/read-result";
import type { ProjectStatus } from "@/lib/supabase/schema";
import { createClient } from "@/lib/supabase/server";
import type { Metadata } from "next";
import Link from "next/link";
import ProjectFilterSelect from "./ProjectFilterSelect";

export const metadata: Metadata = {
  title: "Projects — Archer",
};

interface ProjectListItem {
  id: string;
  name: string;
  status: ProjectStatus;
  goal_id: string | null;
  parent_goal_text: string | null;
}

interface GoalListItem {
  id: string;
  goal_text: string;
}

/** "all" = every project, "none" = goal-less, otherwise a goal uuid. */
type ProjectFilter = string;

interface LoadedProjects {
  projects: ProjectListItem[];
  goalOptions: GoalListItem[];
  selectedGoal: GoalListItem | null;
  goalQuery: string;
  goalOptionsPage: number;
  goalOptionsTotal: number;
  filter: ProjectFilter;
  query: string;
  page: number;
  total: number;
  hasAnyProjects: boolean;
}

async function loadProjects(
  searchParams: ListSearchParams,
): Promise<ReadListResult<LoadedProjects>> {
  try {
    const supabase = await createClient();
    const goalParam = Array.isArray(searchParams.goal)
      ? searchParams.goal[0]
      : searchParams.goal;
    let filter: ProjectFilter = "all";
    let selectedGoal: GoalListItem | null = null;
    if (goalParam === "none") {
      filter = "none";
    } else if (goalParam && goalParam !== "all") {
      const { data, error } = await supabase
        .from("goals")
        .select("id, goal_text")
        .eq("id", goalParam)
        .maybeSingle();
      if (error) return { status: "error" };
      selectedGoal = (data as GoalListItem | null) ?? null;
      if (selectedGoal) filter = selectedGoal.id;
    }

    const { query, page: requestedPage } = parseListQuery(searchParams);
    const {
      query: goalQuery,
      page: requestedGoalOptionsPage,
    } = parseListQuery(searchParams, "goalQ", "goalOptionsPage");

    let goalOptions: GoalListItem[] = [];
    let goalOptionsPage = 1;
    let goalOptionsTotal = 0;
    if (goalQuery) {
      const loadGoalOptions = (goalPage: number) => {
        const { from, to } = getPageRange(goalPage);
        return supabase
          .from("goals")
          .select("id, goal_text", { count: "exact" })
          .ilike("goal_text", escapeIlikePattern(goalQuery))
          .order("goal_text", { ascending: true })
          .order("id", { ascending: true })
          .range(from, to);
      };

      let goalResult = await loadGoalOptions(requestedGoalOptionsPage);
      if (goalResult.error || goalResult.count == null) {
        return { status: "error" };
      }
      goalOptionsTotal = goalResult.count;
      goalOptionsPage = clampPage(requestedGoalOptionsPage, goalOptionsTotal);
      if (goalOptionsPage !== requestedGoalOptionsPage) {
        goalResult = await loadGoalOptions(goalOptionsPage);
        if (goalResult.error || goalResult.count == null) {
          return { status: "error" };
        }
        goalOptionsTotal = goalResult.count;
        const refreshedPage = clampPage(goalOptionsPage, goalOptionsTotal);
        if (refreshedPage !== goalOptionsPage) {
          goalOptionsPage = refreshedPage;
          goalResult = await loadGoalOptions(goalOptionsPage);
          if (goalResult.error || goalResult.count == null) {
            return { status: "error" };
          }
          goalOptionsTotal = goalResult.count;
        }
      }
      goalOptions = (goalResult.data ?? []) as GoalListItem[];
    }

    const loadPage = (page: number) => {
      const { from, to } = getPageRange(page);
      let request = supabase
        .from("project_search")
        .select("id, name, status, goal_id, parent_goal_text, created_at", {
          count: "exact",
        });

      if (query) {
        const pattern = escapePostgrestFilterValue(escapeIlikePattern(query));
        request = request.or(
          `name.ilike."${pattern}",parent_goal_text.ilike."${pattern}"`,
        );
      }
      if (filter === "none") request = request.is("goal_id", null);
      else if (filter !== "all") request = request.eq("goal_id", filter);

      return request
        .order("created_at", { ascending: false })
        .order("id", { ascending: true })
        .range(from, to);
    };

    let projectResult = await loadPage(requestedPage);
    if (projectResult.error || projectResult.count == null) {
      return { status: "error" };
    }

    let total = projectResult.count;
    let page = clampPage(requestedPage, total);
    if (page !== requestedPage) {
      projectResult = await loadPage(page);
      if (projectResult.error || projectResult.count == null) {
        return { status: "error" };
      }
      if (projectResult.count !== total) {
        total = projectResult.count;
        const refreshedPage = clampPage(page, total);
        if (refreshedPage !== page) {
          page = refreshedPage;
          projectResult = await loadPage(page);
          if (projectResult.error || projectResult.count == null) {
            return { status: "error" };
          }
          total = projectResult.count;
        }
      }
    }

    let hasAnyProjects = total > 0;
    if (!query && total === 0 && filter !== "all") {
      const { count, error } = await supabase
        .from("projects")
        .select("id", { count: "exact", head: true });
      if (error || count == null) return { status: "error" };
      hasAnyProjects = count > 0;
    }

    return {
      status: "ok",
      data: {
        projects: (projectResult.data ?? []) as ProjectListItem[],
        goalOptions,
        selectedGoal,
        goalQuery,
        goalOptionsPage,
        goalOptionsTotal,
        filter,
        query,
        page,
        total,
        hasAnyProjects,
      },
    };
  } catch {
    return { status: "error" };
  }
}

function EmptyState() {
  return (
    <div className="flex flex-col items-start gap-4 rounded-[var(--radius-md)] border border-border bg-surface p-[var(--spacing-card-p)]">
      <p className="text-text-secondary">No projects yet.</p>
      <Link
        href="/app/projects/new"
        className="inline-flex min-h-[44px] items-center rounded-[var(--radius-sm)] bg-primary px-4 py-2 font-medium text-text-inverse transition-colors hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)]"
      >
        New project
      </Link>
    </div>
  );
}

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<ListSearchParams>;
}) {
  const params = await searchParams;
  const result = await loadProjects(params);

  if (result.status === "error") {
    return <ReadErrorState />;
  }
  const {
    projects,
    goalOptions,
    selectedGoal,
    goalQuery,
    goalOptionsPage,
    goalOptionsTotal,
    filter,
    query,
    page,
    total,
    hasAnyProjects,
  } = result.data;

  return (
    <section className="flex flex-col gap-[var(--spacing-section-y)]">
      <header className="flex items-center justify-between gap-4">
        <h1 className="text-[length:var(--font-size-section)] font-bold text-text-primary">
          Projects
        </h1>
        <Link
          href="/app/projects/new"
          className="inline-flex min-h-[44px] items-center rounded-[var(--radius-sm)] bg-primary px-4 py-2 font-medium text-text-inverse transition-colors hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)]"
        >
          New project
        </Link>
      </header>

      <ListSearch
        action="/app/projects"
        label="Search Projects"
        query={query}
        searchParams={params}
      />

      <ProjectFilterSelect
        goals={goalOptions}
        selectedGoal={selectedGoal}
        value={filter}
        query={goalQuery}
        page={goalOptionsPage}
        total={goalOptionsTotal}
        searchParams={params}
      />

      {query && total === 0 ? (
        <p className="rounded-[var(--radius-md)] border border-border bg-surface p-[var(--spacing-card-p)] text-text-secondary">
          No matches for &apos;{query}&apos;.
        </p>
      ) : total === 0 && !hasAnyProjects ? (
        <EmptyState />
      ) : total === 0 && hasAnyProjects ? (
        <p className="rounded-[var(--radius-md)] border border-border bg-surface p-[var(--spacing-card-p)] text-text-secondary">
          No projects match this filter.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {projects.map((project) => {
            const parentGoalText = project.parent_goal_text;

            return (
              <li key={project.id}>
                <Link
                  href={`/app/projects/${project.id}`}
                  className="flex min-h-[44px] items-center justify-between gap-3 rounded-[var(--radius-md)] border border-border bg-surface-raised p-[var(--spacing-card-p)] transition-colors hover:border-border-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)]"
                >
                  <span className="flex min-w-0 flex-col gap-1">
                    <span className="min-w-0 break-words font-semibold text-text-primary">
                      {project.name}
                    </span>
                    {parentGoalText && (
                      <span className="text-[length:var(--font-size-caption)] text-text-secondary">
                        {parentGoalText}
                      </span>
                    )}
                  </span>
                  <StatusBadge status={project.status} />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
      <Pagination
        action="/app/projects"
        page={page}
        total={total}
        pageSize={LIST_PAGE_SIZE}
        searchParams={params}
      />
    </section>
  );
}