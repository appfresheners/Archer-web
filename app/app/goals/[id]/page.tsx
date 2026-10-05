/**
 * Goal detail view (server component) inside the authenticated `/app` shell.
 *
 * Loads the goal, its projects (ordered), and those projects' action statuses
 * (to derive per-project stuckness) through the RLS-scoped server client. A
 * missing or non-owned id renders as 404 via `notFound()`.
 *
 * The page renders the read-only structure — header, collapsible gap analysis
 * (skill framework table + drivers/barriers/if–then), project cards with a
 * stuck band, and a collapsible Monthly Goal Check placeholder (its behavior
 * lands in Epic 5). All interactivity (edit, status change, delete) is owned by
 * `GoalDetailClient`, which mutates via `/api/goals/[id]` and refreshes.
 */

import StatusBadge from "@/components/goals/StatusBadge";
import type { AreaOption } from "@/components/focus/AreaSelect";
import { STUCK_MESSAGE } from "@/components/projects/StuckIndicator";
import ReadErrorState from "@/components/shared/ReadErrorState";
import { isProjectStuck } from "@/lib/goals/stuck";
import type { ReadResult } from "@/lib/read-result";
import type {
  ActionStatus,
  GoalStatus,
  ProjectStatus,
  SkillFrameworkItem,
} from "@/lib/supabase/schema";
import { createClient } from "@/lib/supabase/server";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import AttachProjectControl, {
  type AttachableProject,
} from "./AttachProjectControl";
import GoalDetailClient from "./GoalDetailClient";
import { loadAreasForPicker } from "@/app/app/projects/new/load-goals";

interface GoalDetailPageProps {
  params: Promise<{ id: string }>;
}

export interface LoadedGoal {
  id: string;
  area_id: string | null;
  goal_text: string;
  why: string | null;
  status: GoalStatus;
  target_date: string;
  last_checked_at: string | null;
  skill_framework: SkillFrameworkItem[] | null;
  drivers: string[] | null;
  barriers: string[] | null;
  if_then_plans: string[] | null;
  goal_statement: string | null;
  success_criteria: string[] | null;
}

interface LoadedProjectCard {
  id: string;
  name: string;
  status: ProjectStatus;
  stuck: boolean;
}

interface LoadResult {
  goal: LoadedGoal;
  projects: LoadedProjectCard[];
  assignedArea: (AreaOption & { archived: boolean }) | null;
}

async function loadGoalDetail(id: string): Promise<ReadResult<LoadResult>> {
  try {
    const supabase = await createClient();

    const { data: goal, error } = await supabase
      .from("goals")
      .select(
        "id, area_id, goal_text, why, status, target_date, last_checked_at, skill_framework, drivers, barriers, if_then_plans, goal_statement, success_criteria",
      )
      .eq("id", id)
      .maybeSingle();

    if (error) return { status: "error" };
    if (!goal) return { status: "not-found" };

    let assignedArea: LoadResult["assignedArea"] = null;
    if (goal.area_id) {
      const { data: area, error: areaError } = await supabase
        .from("areas_of_focus")
        .select("id, name, archived_at")
        .eq("id", goal.area_id)
        .maybeSingle();
      if (areaError) return { status: "error" };
      if (area) {
        assignedArea = {
          id: area.id,
          name: area.name,
          archived: area.archived_at !== null,
        };
      }
    }

    const { data: projects, error: projectsError } = await supabase
      .from("projects")
      .select("id, name, status, sort_order")
      .eq("goal_id", id)
      .order("sort_order", { ascending: true });

    if (projectsError) return { status: "error" };

    const projectRows = (projects ?? []) as {
      id: string;
      name: string;
      status: ProjectStatus;
      sort_order: number;
    }[];

    let projectCards: LoadedProjectCard[] = [];
    if (projectRows.length > 0) {
      const { data: actions, error: actionsError } = await supabase
        .from("actions")
        .select("project_id, status")
        .in(
          "project_id",
          projectRows.map((p) => p.id),
        );

      if (actionsError) return { status: "error" };

      const actionsByProject = new Map<string, { status: ActionStatus }[]>();
      for (const a of (actions ?? []) as {
        project_id: string;
        status: ActionStatus;
      }[]) {
        const list = actionsByProject.get(a.project_id);
        if (list) list.push({ status: a.status });
        else actionsByProject.set(a.project_id, [{ status: a.status }]);
      }

      projectCards = projectRows.map((p) => ({
        id: p.id,
        name: p.name,
        status: p.status,
        stuck: isProjectStuck(
          { status: p.status },
          actionsByProject.get(p.id) ?? [],
        ),
      }));
    }

    return {
      status: "ok",
      data: { goal: goal as LoadedGoal, projects: projectCards, assignedArea },
    };
  } catch {
    return { status: "error" };
  }
}

/**
 * Load the signed-in user's projects for the attach-existing-project control.
 * RLS scopes to owned rows only; `AttachProjectControl` filters out projects
 * already linked to this goal, leaving goal-less and other-goal projects.
 */
async function loadAttachableProjects(): Promise<AttachableProject[]> {
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("projects")
      .select("id, name, goal_id");
    return (data ?? []) as AttachableProject[];
  } catch {
    return [];
  }
}

export async function generateMetadata({
  params,
}: GoalDetailPageProps): Promise<Metadata> {
  const { id } = await params;
  const result = await loadGoalDetail(id);
  const text = result.status === "ok" ? result.data.goal.goal_text : undefined;
  return {
    title: text
      ? `${text.slice(0, 40)}${text.length > 40 ? "…" : ""} — Archer`
      : "Goal — Archer",
  };
}

/** Collapsible disclosure section (keyboard-native via <details>). */
function Collapsible({
  title,
  defaultOpen,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  return (
    <details
      open={defaultOpen}
      className="rounded-[var(--radius-md)] border border-border bg-surface-raised"
    >
      <summary className="cursor-pointer rounded-[var(--radius-md)] px-[var(--spacing-card-p)] py-3 text-[length:var(--font-size-subheading)] font-semibold text-text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)]">
        {title}
      </summary>
      <div className="flex flex-col gap-4 px-[var(--spacing-card-p)] pb-[var(--spacing-card-p)] pt-1">
        {children}
      </div>
    </details>
  );
}

function GapAnalysis({ goal }: { goal: LoadedGoal }) {
  const framework = goal.skill_framework ?? [];
  const drivers = goal.drivers ?? [];
  const barriers = goal.barriers ?? [];
  const ifThenPlans = goal.if_then_plans ?? [];

  const hasContent =
    framework.length > 0 ||
    drivers.length > 0 ||
    barriers.length > 0 ||
    ifThenPlans.length > 0;

  if (!hasContent) return null;

  return (
    <Collapsible title="Gap analysis">
      {framework.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[length:var(--font-size-small)]">
            <thead>
              <tr className="border-b border-border text-left text-text-secondary">
                <th className="py-2 pr-3 font-medium">Skill</th>
                <th className="py-2 pr-3 font-medium">Required</th>
                <th className="py-2 pr-3 font-medium">You</th>
                <th className="py-2 font-medium">Gap</th>
              </tr>
            </thead>
            <tbody>
              {framework.map((item, i) => {
                const gap = Math.max(0, item.required_level - item.user_rating);
                return (
                  <tr key={i} className="border-b border-border">
                    <td className="py-2 pr-3 text-text-primary">{item.name}</td>
                    <td className="py-2 pr-3 text-text-primary">
                      {item.required_level}
                    </td>
                    <td className="py-2 pr-3 text-text-primary">
                      {item.user_rating}
                    </td>
                    <td className="py-2 font-medium text-text-primary">
                      {gap > 0 ? gap : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {drivers.length > 0 && (
        <div className="flex flex-col gap-1">
          <h3 className="text-[length:var(--font-size-small)] font-semibold text-text-secondary">
            Drivers
          </h3>
          <ul className="list-disc pl-6 text-text-primary">
            {drivers.map((d, i) => (
              <li key={i}>{d}</li>
            ))}
          </ul>
        </div>
      )}

      {barriers.length > 0 && (
        <div className="flex flex-col gap-1">
          <h3 className="text-[length:var(--font-size-small)] font-semibold text-text-secondary">
            Barriers
          </h3>
          <ul className="list-disc pl-6 text-text-primary">
            {barriers.map((b, i) => (
              <li key={i}>{b}</li>
            ))}
          </ul>
        </div>
      )}

      {ifThenPlans.length > 0 && (
        <div className="flex flex-col gap-1">
          <h3 className="text-[length:var(--font-size-small)] font-semibold text-text-secondary">
            If–then plans
          </h3>
          <ul className="list-disc pl-6 text-text-primary">
            {ifThenPlans.map((plan, i) => (
              <li key={i}>{plan}</li>
            ))}
          </ul>
        </div>
      )}
    </Collapsible>
  );
}

/**
 * The unnumbered "My Goal" section: the AI-refined goal statement (falling
 * back to the user's original `goal_text` for goals generated before this
 * change) plus the success criteria, hidden when there are none. Deliberately
 * NOT a "Step 1" heading — the target horizon comes from `target_date`, not a
 * hardcoded "3-Month" label.
 */
function MyGoalSection({ goal }: { goal: LoadedGoal }) {
  const statement = goal.goal_statement ?? goal.goal_text;
  const criteria = goal.success_criteria ?? [];

  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-[length:var(--font-size-subheading)] font-semibold text-text-primary">
        My Goal
      </h2>
      <p className="whitespace-pre-wrap text-text-primary">{statement}</p>
      {criteria.length > 0 && (
        <div className="flex flex-col gap-1">
          <h3 className="text-[length:var(--font-size-small)] font-semibold text-text-secondary">
            Success criteria
          </h3>
          <ul className="list-disc pl-6 text-text-primary">
            {criteria.map((c, i) => (
              <li key={i}>{c}</li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

function ProjectCards({ projects }: { projects: LoadedProjectCard[] }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-[length:var(--font-size-subheading)] font-semibold text-text-primary">
        Projects
      </h2>
      {projects.length === 0 ? (
        <p className="text-text-secondary">No projects for this goal yet.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {projects.map((project) => (
            <li key={project.id}>
              <Link
                href={`/app/projects/${project.id}`}
                className="flex flex-col gap-2 rounded-[var(--radius-md)] border border-border bg-surface-raised p-[var(--spacing-card-p)] transition-colors hover:border-border-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)]"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="min-w-0 truncate font-medium text-text-primary">
                    {project.name}
                  </span>
                  <StatusBadge status={project.status} />
                </div>
                {project.stuck && (
                  <p
                    role="alert"
                    className="rounded-[var(--radius-sm)] border-l-4 border-[var(--color-warning)] bg-warning-subtle px-3 py-2 text-[length:var(--font-size-small)] font-medium text-warning"
                  >
                    {STUCK_MESSAGE}
                  </p>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default async function GoalDetailPage({ params }: GoalDetailPageProps) {
  const { id } = await params;
  const [result, attachable, areas] = await Promise.all([
    loadGoalDetail(id),
    loadAttachableProjects(),
    loadAreasForPicker(),
  ]);

  if (result.status === "error") {
    return <ReadErrorState />;
  }
  if (result.status === "not-found") {
    notFound();
  }

  const { goal, projects, assignedArea } = result.data;

  return (
    <article className="flex flex-col gap-[var(--spacing-section-y)]">
      <GoalDetailClient
        goal={goal}
        areas={areas}
        assignedArea={assignedArea}
      />

      <MyGoalSection goal={goal} />

      <section className="flex flex-col gap-2">
        <h2 className="text-[length:var(--font-size-subheading)] font-semibold text-text-primary">
          Why this goal matters
        </h2>
        <p className="whitespace-pre-wrap text-text-primary">
          {goal.why || "No reason was recorded for this goal."}
        </p>
      </section>

      <GapAnalysis goal={goal} />

      <ProjectCards projects={projects} />

      <AttachProjectControl goalId={goal.id} projects={attachable} />

      <Collapsible title="Monthly Goal Check">
        <p className="text-text-secondary">
          Last checked: {goal.last_checked_at ? new Date(goal.last_checked_at).toLocaleDateString() : "Never"}
        </p>
        <Link
          href={`/app/review/monthly/${goal.id}`}
          className="inline-flex min-h-[44px] w-fit items-center rounded-[var(--radius-sm)] bg-primary px-4 py-2 font-medium text-text-inverse transition-colors hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)]"
        >
          Start monthly goal check
        </Link>
      </Collapsible>
    </article>
  );
}
