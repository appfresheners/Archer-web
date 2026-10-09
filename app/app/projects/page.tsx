/** Project list inside the authenticated `/app` shell. */

import StatusBadge from "@/components/goals/StatusBadge";
import Breadcrumbs from "@/components/shared/Breadcrumbs";
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
  goalOptionsError: boolean;
  selectedGoal: GoalListItem | null;
  goalQuery: string;
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
    const goalOptions: GoalListItem[] = [];
    const goalOptionsBatchSize = 1000;
    let goalOptionsError = false;
    let lastGoalId: string | null = null;
    for (let from = 0; ; from += goalOptionsBatchSize) {
      let request = supabase
        .from("goals")
        .select("id, goal_text")
        .order("id", { ascending: true })
        .range(0, goalOptionsBatchSize - 1);
      if (lastGoalId) request = request.gt("id", lastGoalId);
      const { data, error } = await request;
      if (error || data == null) {
        goalOptionsError = true;
        goalOptions.length = 0;
        break;
      }
      goalOptions.push(...(data as GoalListItem[]));
      if (data.length < goalOptionsBatchSize) break;
      lastGoalId = data[data.length - 1].id;
    }
    goalOptions.sort(
      (left, right) =>
        left.goal_text.localeCompare(right.goal_text) || left.id.localeCompare(right.id),
    );

    const goalParam = Array.isArray(searchParams.goal)
      ? searchParams.goal[0]
      : searchParams.goal;
    let filter: ProjectFilter = "all";
    let selectedGoal: GoalListItem | null = null;
    if (goalParam === "none") {
      filter = "none";
    } else if (goalParam && goalParam !== "all") {
      selectedGoal = goalOptions.find((goal) => goal.id === goalParam) ?? null;
      if (selectedGoal) filter = selectedGoal.id;
      else if (goalOptionsError) {
        filter = goalParam;
        selectedGoal = { id: goalParam, goal_text: "Selected goal" };
      }
    }

    const { query, page: requestedPage } = parseListQuery(searchParams);
    const goalQuery = Array.isArray(searchParams.goalQ)
      ? searchParams.goalQ[0] ?? ""
      : searchParams.goalQ ?? "";

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
        goalOptionsError,
        selectedGoal,
        goalQuery,
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
    return (
      <section className="flex flex-col gap-[var(--spacing-section-y)]">
        <Breadcrumbs items={[{ label: "Projects" }]} />
        <ReadErrorState />
      </section>
    );
  }
  const {
    projects,
    goalOptions,
    goalOptionsError,
    selectedGoal,
    goalQuery,
    filter,
    query,
    page,
    total,
    hasAnyProjects,
  } = result.data;

  return (
    <section className="flex flex-col gap-[var(--spacing-section-y)]">
      <Breadcrumbs items={[{ label: "Projects" }]} />
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
        key={`${goalQuery}:${filter}`}
        goals={goalOptions}
        goalOptionsError={goalOptionsError}
        selectedGoal={selectedGoal}
        value={filter}
        query={goalQuery}
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