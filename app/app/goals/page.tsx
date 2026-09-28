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
import { sortGoals } from "@/lib/goals/sort";
import { countStuckProjects } from "@/lib/goals/stuck";
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

/**
 * Load goals + per-goal project and stuck counts. Returns an empty list on any
 * failure so the page always renders.
 */
async function loadGoals(): Promise<GoalRowData[]> {
  try {
    const supabase = await createClient();

    const { data: goals, error: goalsError } = await supabase
      .from("goals")
      .select("id, goal_text, status, target_date, created_at");

    if (goalsError || !goals || goals.length === 0) {
      return [];
    }

    const [{ data: projects }, { data: actions }] = await Promise.all([
      supabase.from("projects").select("id, goal_id, status"),
      supabase.from("actions").select("project_id, status"),
    ]);

    const projectRecords = (projects ?? []) as ProjectRecord[];
    const actionRecords = (actions ?? []) as ActionRecord[];

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

    const rows: GoalRowData[] = (goals as GoalRecord[]).map((goal) => {
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

    // Sort by (goal status precedence, created_at desc) using the original rows.
    const orderIndex = new Map(
      sortGoals(goals as GoalRecord[]).map((g, i) => [g.id, i] as const),
    );
    rows.sort((a, b) => (orderIndex.get(a.id)! - orderIndex.get(b.id)!));

    return rows;
  } catch {
    return [];
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

export default async function GoalsPage() {
  const goals = await loadGoals();

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

      {goals.length === 0 ? (
        <EmptyState />
      ) : (
        <ul className="flex flex-col gap-3">
          {goals.map((goal) => (
            <GoalRow key={goal.id} goal={goal} />
          ))}
        </ul>
      )}
    </section>
  );
}
