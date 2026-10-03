/** Project list inside the authenticated `/app` shell. */

import StatusBadge from "@/components/goals/StatusBadge";
import ReadErrorState from "@/components/shared/ReadErrorState";
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
}

interface GoalListItem {
  id: string;
  goal_text: string;
}

/** "all" = every project, "none" = goal-less, otherwise a goal uuid. */
type ProjectFilter = string;

interface LoadedProjects {
  projects: ProjectListItem[];
  goals: GoalListItem[];
}

async function loadProjects(): Promise<ReadListResult<LoadedProjects>> {
  try {
    const supabase = await createClient();
    const [{ data: projects, error: projectsError }, { data: goals, error: goalsError }] =
      await Promise.all([
        supabase
          .from("projects")
          .select("id, name, status, goal_id")
          .order("created_at", { ascending: false }),
        supabase
          .from("goals")
          .select("id, goal_text")
          .order("goal_text", { ascending: true }),
      ]);
    if (projectsError || goalsError) {
      return { status: "error" };
    }
    return {
      status: "ok",
      data: {
        projects: (projects ?? []) as ProjectListItem[],
        goals: (goals ?? []) as GoalListItem[],
      },
    };
  } catch {
    return { status: "error" };
  }
}

/**
 * Resolve the `?goal=` query param to a concrete filter. A recognized goal
 * uuid is honored; "none" selects goal-less projects; anything else (missing,
 * "all", or an unknown value) falls back to the all-projects view.
 */
function resolveFilter(
  param: string | undefined,
  goalIds: Set<string>,
): ProjectFilter {
  if (param === "none") return "none";
  if (param && param !== "all" && goalIds.has(param)) return param;
  return "all";
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
  searchParams: Promise<{ goal?: string }>;
}) {
  const [{ goal: goalParam }, result] = await Promise.all([
    searchParams,
    loadProjects(),
  ]);

  if (result.status === "error") {
    return <ReadErrorState />;
  }
  const { projects, goals } = result.data;

  const goalNames = new Map(goals.map((g) => [g.id, g.goal_text]));
  const filter = resolveFilter(goalParam, new Set(goalNames.keys()));

  const visible =
    filter === "all"
      ? projects
      : filter === "none"
        ? projects.filter((p) => p.goal_id === null)
        : projects.filter((p) => p.goal_id === filter);

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

      {goals.length > 0 && (
        <ProjectFilterSelect goals={goals} value={filter} />
      )}

      {projects.length === 0 ? (
        <EmptyState />
      ) : visible.length === 0 ? (
        <p className="rounded-[var(--radius-md)] border border-border bg-surface p-[var(--spacing-card-p)] text-text-secondary">
          No projects match this filter.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {visible.map((project) => (
            <li key={project.id}>
              <Link
                href={`/app/projects/${project.id}`}
                className="flex min-h-[44px] items-center justify-between gap-3 rounded-[var(--radius-md)] border border-border bg-surface-raised p-[var(--spacing-card-p)] transition-colors hover:border-border-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)]"
              >
                <span className="flex min-w-0 flex-col gap-1">
                  <span className="min-w-0 break-words font-semibold text-text-primary">
                    {project.name}
                  </span>
                  {project.goal_id && goalNames.has(project.goal_id) && (
                    <span className="text-[length:var(--font-size-caption)] text-text-secondary">
                      {goalNames.get(project.goal_id)}
                    </span>
                  )}
                </span>
                <StatusBadge status={project.status} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}