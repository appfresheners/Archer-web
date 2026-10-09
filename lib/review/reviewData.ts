/**
 * Pure builder for the weekly-review middle-phase data (Story 5.6).
 *
 * `buildReviewData` takes already-loaded (RLS-scoped) rows and derives exactly
 * what the Get Clear / Get Current / Get Creative panels + their advance gates
 * need:
 *
 *   - `unprocessedCount` — inbox items still `unprocessed` (the Get Clear gate;
 *     someday/reference/processed/trashed are already out of the inbox).
 *   - `currentProjects` — each ACTIVE project with its single committed action
 *     (or null), its remaining `available` actions (to commit a new one), its
 *     `updatedAt`, and whether it is stuck (active + zero committed).
 *   - `somedayItems` — inbox items with `processing_status = 'someday'` (the
 *     Get Creative activate/delete/keep list).
 *   - `somedayProjects` — projects with `status = 'someday'` (the distinct
 *     Get Creative activation list).
 *   - `goalAlignment` — ACTIVE goals with their project + stuck counts (the
 *     read-only Get Creative alignment summary).
 *
 * Pure over its inputs (no I/O), so every shape is unit-testable.
 */

import { isProjectStuck } from "@/lib/goals/stuck";
import type {
  ActionStatus,
  GoalStatus,
  InboxProcessingStatus,
  ProjectStatus,
} from "@/lib/supabase/schema";

export interface ReviewInboxInput {
  id: string;
  raw_text: string;
  processing_status: InboxProcessingStatus;
}

export interface ReviewProjectInput {
  id: string;
  name: string;
  status: ProjectStatus;
  updated_at: string;
  /** Parent goal, for the alignment counts (null = goal-less project). */
  goal_id: string | null;
  /** Direct Area parent; Goal-linked projects inherit their Area instead. */
  area_id: string | null;
}

export interface ReviewActionInput {
  id: string;
  project_id: string | null;
  text: string;
  status: ActionStatus;
  sort_order: number;
}

export interface ReviewGoalInput {
  id: string;
  goal_text: string;
  status: GoalStatus;
  area_id: string | null;
}

export interface ReviewAreaInput {
  id: string;
  name: string;
  sort_order: number;
  archived_at: string | null;
}

export interface ReviewAreaRollup {
  id: string;
  name: string;
  archived_at: string | null;
  goals: { id: string; goalText: string; status: GoalStatus }[];
  projects: { id: string; name: string; status: ProjectStatus }[];
}

/** An available action offered when committing a new next action. */
export interface ReviewAvailableAction {
  id: string;
  text: string;
}

/** One ACTIVE project as surfaced in Get Current. */
export interface ReviewCurrentProject {
  id: string;
  name: string;
  updatedAt: string;
  /** The project's single committed action text, or null when none. */
  committedActionText: string | null;
  /** Remaining `available` actions to commit from. */
  availableActions: ReviewAvailableAction[];
  /** Active + zero committed. */
  isStuck: boolean;
}

/** One Someday/Maybe inbox item as surfaced in Get Creative. */
export interface ReviewSomedayItem {
  id: string;
  raw_text: string;
}

/** One Someday/Maybe project as surfaced in Get Creative. */
export interface ReviewSomedayProject {
  id: string;
  name: string;
}

/** One ACTIVE goal in the alignment summary. */
export interface ReviewGoalAlignment {
  id: string;
  goalText: string;
  projectCount: number;
  stuckCount: number;
}

export interface ReviewData {
  unprocessedCount: number;
  currentProjects: ReviewCurrentProject[];
  somedayItems: ReviewSomedayItem[];
  somedayProjects: ReviewSomedayProject[];
  goalAlignment: ReviewGoalAlignment[];
  focusAreas: ReviewAreaRollup[];
  focusAreasError: boolean;
}

function sortBySortOrder<T extends { sort_order: number }>(items: T[]): T[] {
  return [...items].sort((a, b) => a.sort_order - b.sort_order);
}

/**
 * Build the review middle-phase data from loaded rows.
 *
 * @param inbox    the user's non-trashed inbox items
 * @param projects the user's projects (any status; carry goal_id for alignment)
 * @param actions  the user's actions (any status)
 * @param goals    the user's goals (any status; filtered to active here)
 */
export function buildReviewData(
  inbox: readonly ReviewInboxInput[],
  projects: readonly ReviewProjectInput[],
  actions: readonly ReviewActionInput[],
  goals: readonly ReviewGoalInput[],
  areas: readonly ReviewAreaInput[] = [],
): ReviewData {
  // Index actions by project.
  const actionsByProject = new Map<string, ReviewActionInput[]>();
  for (const action of actions) {
    if (action.project_id === null) continue;
    const list = actionsByProject.get(action.project_id);
    if (list) list.push(action);
    else actionsByProject.set(action.project_id, [action]);
  }

  // Get Clear gate source: unprocessed inbox items only.
  const unprocessedCount = inbox.filter(
    (i) => i.processing_status === "unprocessed",
  ).length;

  // Get Creative: someday/maybe items.
  const somedayItems: ReviewSomedayItem[] = inbox
    .filter((i) => i.processing_status === "someday")
    .map((i) => ({ id: i.id, raw_text: i.raw_text }));
  const somedayProjects: ReviewSomedayProject[] = projects
    .filter((project) => project.status === "someday")
    .map((project) => ({ id: project.id, name: project.name }));

  // Get Current: each ACTIVE project with committed/available/stuck + updatedAt.
  const currentProjects: ReviewCurrentProject[] = [];
  for (const project of projects) {
    if (project.status !== "active") continue;
    const projectActions = actionsByProject.get(project.id) ?? [];
    const committed = projectActions.find((a) => a.status === "committed");
    const availableActions = sortBySortOrder(
      projectActions.filter((a) => a.status === "available"),
    ).map((a) => ({ id: a.id, text: a.text }));
    currentProjects.push({
      id: project.id,
      name: project.name,
      updatedAt: project.updated_at,
      committedActionText: committed?.text ?? null,
      availableActions,
      isStuck: isProjectStuck({ status: project.status }, projectActions),
    });
  }

  // Get Creative alignment: for each ACTIVE goal, count its ACTIVE projects and
  // how many are stuck. Group active projects by goal_id first.
  const activeProjectsByGoal = new Map<string, ReviewProjectInput[]>();
  for (const project of projects) {
    if (project.status !== "active" || !project.goal_id) continue;
    const list = activeProjectsByGoal.get(project.goal_id);
    if (list) list.push(project);
    else activeProjectsByGoal.set(project.goal_id, [project]);
  }

  const goalAlignment: ReviewGoalAlignment[] = goals
    .filter((g) => g.status === "active")
    .map((g) => {
      const goalProjects = activeProjectsByGoal.get(g.id) ?? [];
      const stuckCount = goalProjects.reduce(
        (n, p) =>
          isProjectStuck(
            { status: p.status },
            actionsByProject.get(p.id) ?? [],
          )
            ? n + 1
            : n,
        0,
      );
      return {
        id: g.id,
        goalText: g.goal_text,
        projectCount: goalProjects.length,
        stuckCount,
      };
    });

  const focusAreas: ReviewAreaRollup[] = [...areas]
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((area) => ({
      id: area.id,
      name: area.name,
      archived_at: area.archived_at,
      goals: goals
        .filter((goal) => goal.area_id === area.id)
        .sort((a, b) => a.goal_text.localeCompare(b.goal_text))
        .map((goal) => ({
          id: goal.id,
          goalText: goal.goal_text,
          status: goal.status,
        })),
      projects: projects
        .filter((project) => project.area_id === area.id && project.goal_id === null)
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((project) => ({
          id: project.id,
          name: project.name,
          status: project.status,
        })),
    }));

  return {
    unprocessedCount,
    currentProjects,
    somedayItems,
    somedayProjects,
    goalAlignment,
    focusAreas,
    focusAreasError: false,
  };
}
