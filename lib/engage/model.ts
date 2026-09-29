/**
 * Engage view model — the single pure builder behind the Engage page (Story 5.3).
 *
 * `buildEngageModel` takes already-loaded goals / projects / actions (RLS-scoped
 * by the caller) and derives the "what do I do now" view:
 *
 *   - Only `committed` next actions appear in the do-now lists — never the full
 *     action list.
 *   - Scope is `active` goals and `active` projects only. A paused / someday /
 *     not_now / completed / archived goal, or a paused / completed / archived
 *     project, is excluded.
 *   - Rows are grouped by goal (goal order preserved from the input). Each goal
 *     group also carries its `stuckProjects` (active + zero committed, via the
 *     shared `isProjectStuck`) at the bottom. Goal-less active projects have
 *     their own groups.
 *   - Standalone committed actions (`project_id === null`, Story 5.2) collect
 *     under a single "Anytime / No project" group.
 *   - `waiting` actions and actions whose `scheduled_for` is a FUTURE date are
 *     excluded from the do-now lists — they are not "do now".
 *   - Each goal group also carries, per project, that project's remaining
 *     `available` actions so the Done→"What's next" prompt can list them
 *     without another query (mirrors ActionList's `nextPrompt`).
 *   - `isEmpty` is true when there are no committed rows anywhere AND no stuck
 *     projects — the honest "all caught up" state.
 *
 * Pure over its inputs (no I/O, no clock beyond the injected `today`), so every
 * matrix row can be unit-tested deterministically.
 */

import { isProjectStuck } from "@/lib/goals/stuck";
import type {
  Action,
  ActionStatus,
  Goal,
  GoalStatus,
  Project,
  ProjectStatus,
} from "@/lib/supabase/schema";

/** Minimal goal shape the model needs. */
export interface EngageGoalInput {
  id: string;
  goal_text: string;
  status: GoalStatus;
}

/** Minimal project shape the model needs. */
export interface EngageProjectInput {
  id: string;
  goal_id: string | null;
  name: string;
  status: ProjectStatus;
}

/** Minimal action shape the model needs. */
export interface EngageActionInput {
  id: string;
  project_id: string | null;
  text: string;
  status: ActionStatus;
  context_tags: string[] | null;
  scheduled_for: string | null;
  sort_order: number;
}

/** One committed action row rendered in a do-now list. */
export interface EngageRow {
  id: string;
  text: string;
  context_tags: string[];
  /** Parent project id, or null for a standalone "Anytime" row. */
  projectId: string | null;
  /** Parent project name, or null for a standalone "Anytime" row. */
  projectName: string | null;
}

/** An available action offered inside the "What's next for [project]?" prompt. */
export interface EngageAvailableAction {
  id: string;
  text: string;
}

/** A single stuck project surfaced at the bottom of its goal group. */
export interface EngageStuckProject {
  id: string;
  name: string;
}

/** A goal group: the goal, its committed rows, and its stuck projects. */
export interface EngageGoalGroup {
  goalId: string;
  goalText: string;
  committed: EngageRow[];
  stuckProjects: EngageStuckProject[];
  /**
   * Per-project remaining `available` actions (project id → actions), used by
   * the Done→"What's next" prompt. Only active projects in this goal appear.
   */
  availableByProject: Record<string, EngageAvailableAction[]>;
}

/** A committed-action group for an active project without an active goal. */
export interface EngageProjectGroup {
  projectId: string;
  projectName: string;
  committed: EngageRow[];
  available: EngageAvailableAction[];
}

export interface EngageModel {
  goalGroups: EngageGoalGroup[];
  projectGroups: EngageProjectGroup[];
  /** Standalone committed rows (project_id === null). */
  anytime: EngageRow[];
  isEmpty: boolean;
}

/** Type guard: is this a schema `Action` (accepts the minimal subset too). */
type ActionLike = Pick<
  Action,
  "id" | "project_id" | "text" | "status" | "context_tags" | "scheduled_for" | "sort_order"
>;
type ProjectLike = Pick<Project, "id" | "goal_id" | "name" | "status">;
type GoalLike = Pick<Goal, "id" | "goal_text" | "status">;

/**
 * True when the action is a "do now" candidate: not `waiting`, and not deferred
 * to a future calendar date. `scheduled_for` is a DATE (YYYY-MM-DD); an action
 * scheduled strictly after `today` is a future action and excluded.
 */
function isDoNow(action: ActionLike, today: string): boolean {
  if (action.status === "waiting") return false;
  if (action.scheduled_for && action.scheduled_for > today) return false;
  return true;
}

function toRow(
  action: ActionLike,
  projectId: string | null,
  projectName: string | null,
): EngageRow {
  return {
    id: action.id,
    text: action.text,
    context_tags: action.context_tags ?? [],
    projectId,
    projectName,
  };
}

function sortBySortOrder<T extends { sort_order: number }>(items: T[]): T[] {
  return [...items].sort((a, b) => a.sort_order - b.sort_order);
}

/**
 * Build the Engage view model from loaded rows.
 *
 * @param goals    the user's goals (any status; filtered to active here)
 * @param projects the user's projects (any status; filtered to active here)
 * @param actions  the user's actions (any status; filtered here)
 * @param today    the reference calendar date (YYYY-MM-DD) for future-scheduled
 *                 exclusion. Injected so the builder stays pure/testable.
 */
export function buildEngageModel(
  goals: readonly GoalLike[],
  projects: readonly ProjectLike[],
  actions: readonly ActionLike[],
  today: string,
): EngageModel {
  // Index actions by project for O(projects + actions) grouping.
  const actionsByProject = new Map<string, ActionLike[]>();
  const standaloneActions: ActionLike[] = [];
  for (const action of actions) {
    if (action.project_id === null) {
      standaloneActions.push(action);
      continue;
    }
    const list = actionsByProject.get(action.project_id);
    if (list) list.push(action);
    else actionsByProject.set(action.project_id, [action]);
  }

  const activeGoalIds = new Set(
    goals.filter((goal) => goal.status === "active").map((goal) => goal.id),
  );

  // Active projects with active parent goals are grouped under those goals.
  const activeProjectsByGoal = new Map<string, ProjectLike[]>();
  for (const project of projects) {
    if (project.status !== "active") continue;
    if (!project.goal_id || !activeGoalIds.has(project.goal_id)) continue;
    const list = activeProjectsByGoal.get(project.goal_id);
    if (list) list.push(project);
    else activeProjectsByGoal.set(project.goal_id, [project]);
  }

  const goalGroups: EngageGoalGroup[] = [];

  for (const goal of goals) {
    if (goal.status !== "active") continue;

    const goalProjects = activeProjectsByGoal.get(goal.id) ?? [];
    const committed: EngageRow[] = [];
    const stuckProjects: EngageStuckProject[] = [];
    const availableByProject: Record<string, EngageAvailableAction[]> = {};

    for (const project of goalProjects) {
      const projectActions = actionsByProject.get(project.id) ?? [];

      // Stuck detection reuses the shared rule (active + zero committed).
      if (isProjectStuck({ status: project.status }, projectActions)) {
        stuckProjects.push({ id: project.id, name: project.name });
      }

      // Committed do-now rows for this project.
      const committedRows = sortBySortOrder(
        projectActions.filter(
          (a) => a.status === "committed" && isDoNow(a, today),
        ),
      );
      for (const a of committedRows) {
        committed.push(toRow(a, project.id, project.name));
      }

      // Remaining available actions for the "What's next" prompt.
      availableByProject[project.id] = sortBySortOrder(
        projectActions.filter((a) => a.status === "available"),
      ).map((a) => ({ id: a.id, text: a.text }));
    }

    goalGroups.push({
      goalId: goal.id,
      goalText: goal.goal_text,
      committed,
      stuckProjects,
      availableByProject,
    });
  }

  // Keep active projects without an active parent goal visible in their own
  // group instead of dropping them between goal groups and standalone actions.
  const projectGroups: EngageProjectGroup[] = [];
  for (const project of projects) {
    if (project.status !== "active") continue;
    if (project.goal_id && activeGoalIds.has(project.goal_id)) continue;

    const projectActions = actionsByProject.get(project.id) ?? [];
    const committed = sortBySortOrder(
      projectActions.filter(
        (action) => action.status === "committed" && isDoNow(action, today),
      ),
    ).map((action) => toRow(action, project.id, project.name));

    if (committed.length === 0) continue;

    projectGroups.push({
      projectId: project.id,
      projectName: project.name,
      committed,
      available: sortBySortOrder(
        projectActions.filter((action) => action.status === "available"),
      ).map((action) => ({ id: action.id, text: action.text })),
    });
  }

  // Standalone committed do-now rows → the "Anytime / No project" group.
  const anytime = sortBySortOrder(
    standaloneActions.filter(
      (a) => a.status === "committed" && isDoNow(a, today),
    ),
  ).map((a) => toRow(a, null, null));

  const hasCommitted =
    anytime.length > 0 ||
    projectGroups.length > 0 ||
    goalGroups.some((group) => group.committed.length > 0);
  const hasStuck = goalGroups.some((group) => group.stuckProjects.length > 0);

  return {
    goalGroups,
    projectGroups,
    anytime,
    isEmpty: !hasCommitted && !hasStuck,
  };
}
