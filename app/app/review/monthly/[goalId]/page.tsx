import StatusBadge from "@/components/goals/StatusBadge";
import ReadErrorState from "@/components/shared/ReadErrorState";
import { isProjectStuck } from "@/lib/goals/stuck";
import type { ReadResult } from "@/lib/read-result";
import type {
  ActionStatus,
  GoalStatus,
  ProjectStatus,
} from "@/lib/supabase/schema";
import { createClient } from "@/lib/supabase/server";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import MonthlyGoalCheckClient from "./MonthlyGoalCheckClient";

interface MonthlyGoalCheckPageProps {
  params: Promise<{ goalId: string }>;
}

interface LoadedGoal {
  id: string;
  goal_text: string;
  status: GoalStatus;
  last_checked_at: string | null;
  created_at: string;
}

interface LoadedProject {
  id: string;
  name: string;
  status: ProjectStatus;
  stuck: boolean;
}

interface LoadedMonthlyCheck {
  goal: LoadedGoal;
  projects: LoadedProject[];
  stuckCount: number;
}

async function loadMonthlyCheck(goalId: string): Promise<ReadResult<LoadedMonthlyCheck>> {
  try {
    const supabase = await createClient();
    const { data: goal, error } = await supabase
      .from("goals")
      .select("id, goal_text, status, last_checked_at, created_at")
      .eq("id", goalId)
      .maybeSingle();

    if (error) return { status: "error" };
    if (!goal) return { status: "not-found" };

    const { data: projects, error: projectsError } = await supabase
      .from("projects")
      .select("id, name, status, sort_order")
      .eq("goal_id", goalId)
      .order("sort_order", { ascending: true });

    if (projectsError) return { status: "error" };

    const projectRows = (projects ?? []) as {
      id: string;
      name: string;
      status: ProjectStatus;
      sort_order: number;
    }[];
    const actionsByProject = new Map<string, ActionStatus[]>();

    if (projectRows.length > 0) {
      const { data: actions, error: actionsError } = await supabase
        .from("actions")
        .select("project_id, status")
        .in(
          "project_id",
          projectRows.map((project) => project.id),
        );

      if (actionsError) return { status: "error" };
      for (const action of (actions ?? []) as {
        project_id: string;
        status: ActionStatus;
      }[]) {
        const list = actionsByProject.get(action.project_id) ?? [];
        list.push(action.status);
        actionsByProject.set(action.project_id, list);
      }
    }

    const loadedProjects = projectRows.map((project) => ({
      id: project.id,
      name: project.name,
      status: project.status,
      stuck: isProjectStuck(
        { status: project.status },
        (actionsByProject.get(project.id) ?? []).map((status) => ({ status })),
      ),
    }));

    return {
      status: "ok",
      data: {
        goal: goal as LoadedGoal,
        projects: loadedProjects,
        stuckCount: loadedProjects.filter((project) => project.stuck).length,
      },
    };
  } catch {
    return { status: "error" };
  }
}

export async function generateMetadata({
  params,
}: MonthlyGoalCheckPageProps): Promise<Metadata> {
  const { goalId } = await params;
  const result = await loadMonthlyCheck(goalId);
  return {
    title: result.status === "ok" ? `Monthly Check — ${result.data.goal.goal_text}` : "Monthly Check — Archer",
  };
}

export default async function MonthlyGoalCheckPage({
  params,
}: MonthlyGoalCheckPageProps) {
  const { goalId } = await params;
  const res = await loadMonthlyCheck(goalId);
  if (res.status === "error") {
    return <ReadErrorState />;
  }
  if (res.status === "not-found") {
    notFound();
  }
  const result = res.data;

  const lastChecked = result.goal.last_checked_at
    ? new Date(result.goal.last_checked_at).toLocaleDateString()
    : "Never";

  return (
    <article className="flex flex-col gap-[var(--spacing-section-y)]">
      <header className="flex flex-col gap-3">
        <Link
          href={`/app/goals/${result.goal.id}`}
          className="w-fit text-[length:var(--font-size-small)] text-primary underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)]"
        >
          Back to goal
        </Link>
        <h1 className="text-[length:var(--font-size-section)] font-bold text-text-primary">
          Monthly Goal Check
        </h1>
        <p className="text-[length:var(--font-size-subheading)] text-text-primary">
          {result.goal.goal_text}
        </p>
        <p className="text-[length:var(--font-size-small)] text-text-secondary">
          Last checked: {lastChecked}
        </p>
      </header>

      <section aria-labelledby="project-health-heading" className="flex flex-col gap-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2
            id="project-health-heading"
            className="text-[length:var(--font-size-subheading)] font-semibold text-text-primary"
          >
            Linked project health
          </h2>
          <p className="text-[length:var(--font-size-small)] text-text-secondary">
            {result.stuckCount} stuck {result.stuckCount === 1 ? "project" : "projects"}
          </p>
        </div>
        {result.projects.length === 0 ? (
          <p className="text-text-secondary">No linked projects.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {result.projects.map((project) => (
              <li
                key={project.id}
                className="flex flex-wrap items-center justify-between gap-2 border-b border-border py-3"
              >
                <Link
                  href={`/app/projects/${project.id}`}
                  className="font-medium text-primary underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)]"
                >
                  {project.name}
                </Link>
                <span className="flex items-center gap-2">
                  <StatusBadge status={project.status} />
                  {project.stuck && (
                    <span className="text-[length:var(--font-size-caption)] font-medium text-warning">
                      Stuck
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <MonthlyGoalCheckClient goal={result.goal} />
    </article>
  );
}