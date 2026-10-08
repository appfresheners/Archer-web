/**
 * Goals list (server component) inside the authenticated `/app` shell.
 *
 * Loads the signed-in user's goals plus the minimal project/action data needed
 * to derive each goal's project count and stuck-project count, all through the
 * server Supabase client (RLS scopes every row to `auth.uid()`). The three
 * reads (goals, projects, committed-relevant actions) are aggregated in memory
 * to keep the query count fixed and avoid N+1.
 *
 * Rows are ordered by `sortGoals` (Active-first, then created_at desc). When
 * the user owns no goals, a plain empty state links to the goal wizard. Any
 * read failure degrades to the empty state rather than crashing the page.
 *
 * The `/app` layout already enforces auth, so no auth check is repeated here.
 */

import GoalRow, { type GoalRowData } from "@/components/goals/GoalRow";
import ListSearch from "@/components/shared/ListSearch";
import Pagination from "@/components/shared/Pagination";
import ReadErrorState from "@/components/shared/ReadErrorState";
import { countStuckProjects } from "@/lib/goals/stuck";
import {
  clampPage,
  escapeIlikePattern,
  getPageRange,
  LIST_PAGE_SIZE,
  parseListQuery,
  type ListSearchParams,
} from "@/lib/lists/search-pagination";
import type { ReadListResult } from "@/lib/read-result";
import type { ActionStatus, GoalStatus, ProjectStatus } from "@/lib/supabase/schema";
import { createClient } from "@/lib/supabase/server";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Goals — Archer",
};

interface GoalRecord {
  id: string;
  goal_text: string;
  status: GoalStatus;
  target_date: string;
  created_at: string;
}

interface ProjectRecord {
  id: string;
  goal_id: string | null;
  status: ProjectStatus;
}

interface ActionRecord {
  project_id: string;
  status: ActionStatus;
}

interface LoadedGoals {
  goals: GoalRowData[];
  query: string;
  page: number;
  total: number;
}

/**
 * Load one page of goals plus only the project/action records needed for its
 * counts. RLS scopes each server-side query to the signed-in user.
 */
async function loadGoals(
  searchParams: ListSearchParams,
): Promise<ReadListResult<LoadedGoals>> {
  try {
    const supabase = await createClient();
    const { query, page: requestedPage } = parseListQuery(searchParams);

    const loadPage = (page: number) => {
      const { from, to } = getPageRange(page);
      let request = supabase.from("goals").select(
        "id, goal_text, status, target_date, created_at",
        { count: "exact" },
      );
      if (query) request = request.ilike("goal_text", escapeIlikePattern(query));
      return request
        .order("status", { ascending: true })
        .order("created_at", { ascending: false })
        .order("id", { ascending: true })
        .range(from, to);
    };

    let goalsResult = await loadPage(requestedPage);
    if (goalsResult.error || goalsResult.count == null) {
      return { status: "error" };
    }
    let total = goalsResult.count;
    let page = clampPage(requestedPage, total);
    if (page !== requestedPage) {
      goalsResult = await loadPage(page);
      if (goalsResult.error || goalsResult.count == null) {
        return { status: "error" };
      }
      if (goalsResult.count !== total) {
        total = goalsResult.count;
        const refreshedPage = clampPage(page, total);
        if (refreshedPage !== page) {
          page = refreshedPage;
          goalsResult = await loadPage(page);
          if (goalsResult.error || goalsResult.count == null) {
            return { status: "error" };
          }
          total = goalsResult.count;
        }
      }
    }

    const goalRecords = (goalsResult.data ?? []) as GoalRecord[];
    if (goalRecords.length === 0) {
      return { status: "ok", data: { goals: [], query, page, total } };
    }

    const goalIds = goalRecords.map((goal) => goal.id);
    const { data: projects, error: projectsError } = await supabase
      .from("projects")
      .select("id, goal_id, status")
      .in("goal_id", goalIds);
    if (projectsError) return { status: "error" };

    const projectRecords = (projects ?? []) as ProjectRecord[];
    const projectIds = projectRecords.map((project) => project.id);
    let actionRecords: ActionRecord[] = [];
    if (projectIds.length > 0) {
      const { data: actions, error: actionsError } = await supabase
        .from("actions")
        .select("project_id, status")
        .in("project_id", projectIds);
      if (actionsError) return { status: "error" };
      actionRecords = (actions ?? []) as ActionRecord[];
    }

    // Group actions by project so stuck detection is O(projects + actions).
    const actionsByProject = new Map<string, ActionRecord[]>();
    for (const action of actionRecords) {
      const list = actionsByProject.get(action.project_id);
      if (list) list.push(action);
      else actionsByProject.set(action.project_id, [action]);
    }

    // Group projects by their parent goal (goal-less projects are ignored here).
    const projectsByGoal = new Map<string, ProjectRecord[]>();
    for (const project of projectRecords) {
      if (!project.goal_id) continue;
      const list = projectsByGoal.get(project.goal_id);
      if (list) list.push(project);
      else projectsByGoal.set(project.goal_id, [project]);
    }

    const rows: GoalRowData[] = goalRecords.map((goal) => {
      const goalProjects = projectsByGoal.get(goal.id) ?? [];
      const stuckCount = countStuckProjects(
        goalProjects.map((p) => ({
          status: p.status,
          actions: actionsByProject.get(p.id) ?? [],
        })),
      );
      return {
        id: goal.id,
        goal_text: goal.goal_text,
        status: goal.status,
        target_date: goal.target_date,
        projectCount: goalProjects.length,
        stuckCount,
      };
    });

    return { status: "ok", data: { goals: rows, query, page, total } };
  } catch {
    return { status: "error" };
  }
}

function EmptyState() {
  return (
    <div className="flex flex-col items-start gap-4 rounded-[var(--radius-md)] border border-border bg-surface p-[var(--spacing-card-p)]">
      <p className="text-text-secondary">No goals yet. Start one.</p>
      <Link
        href="/app/goals/new"
        className="inline-flex min-h-[44px] items-center rounded-[var(--radius-sm)] bg-primary px-4 py-2 font-medium text-text-inverse transition-colors hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)]"
      >
        New goal
      </Link>
    </div>
  );
}

export default async function GoalsPage({
  searchParams,
}: {
  searchParams: Promise<ListSearchParams>;
}) {
  const params = await searchParams;
  const result = await loadGoals(params);

  if (result.status === "error") {
    return <ReadErrorState />;
  }
  const { goals, query, page, total } = result.data;

  return (
    <section className="flex flex-col gap-[var(--spacing-section-y)]">
      <header className="flex items-center justify-between gap-4">
        <h1 className="text-[length:var(--font-size-section)] font-bold text-text-primary">
          Goals
        </h1>
        {goals.length > 0 && (
          <Link
            href="/app/goals/new"
            className="inline-flex min-h-[44px] items-center rounded-[var(--radius-sm)] bg-primary px-4 py-2 font-medium text-text-inverse transition-colors hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)]"
          >
            New goal
          </Link>
        )}
      </header>

      <ListSearch
        action="/app/goals"
        label="Search Goals"
        query={query}
        searchParams={params}
      />

      {query && total === 0 ? (
        <p className="rounded-[var(--radius-md)] border border-border bg-surface p-[var(--spacing-card-p)] text-text-secondary">
          No matches for &apos;{query}&apos;.
        </p>
      ) : total === 0 ? (
        <EmptyState />
      ) : (
        <ul className="flex flex-col gap-3">
          {goals.map((goal) => (
            <GoalRow key={goal.id} goal={goal} />
          ))}
        </ul>
      )}
      <Pagination
        action="/app/goals"
        page={page}
        total={total}
        pageSize={LIST_PAGE_SIZE}
        searchParams={params}
      />
    </section>
  );
}
