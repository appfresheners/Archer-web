/**
 * Stuck-project detection — the single source of truth for the GTD "stuck"
 * rule, shared across the goals list (Story 4.1), commit/stuck detection
 * (Story 4.5), and the Engage view (Epic 5).
 *
 * A project is **stuck** when it is `active` and has zero `committed` actions.
 * Only `active` projects can be stuck (a paused/completed/archived project is
 * not expected to have a committed next action). Only the `committed` action
 * status matters — available/done actions are irrelevant to stuckness.
 *
 * These are intentionally pure functions over already-loaded rows so callers
 * can aggregate in memory and avoid N+1 queries.
 */

import type { ProjectStatus, ActionStatus } from "@/lib/supabase/schema";

/** Minimal project shape needed to decide stuckness. */
export interface StuckProjectInput {
  status: ProjectStatus;
}

/** Minimal action shape needed to decide stuckness. */
export interface StuckActionInput {
  status: ActionStatus;
}

/**
 * True when the project is `active` and none of its actions are `committed`.
 */
export function isProjectStuck(
  project: StuckProjectInput,
  actions: readonly StuckActionInput[],
): boolean {
  if (project.status !== "active") return false;
  return !actions.some((a) => a.status === "committed");
}

/** A project plus its actions, keyed for aggregation. */
export interface ProjectWithActions extends StuckProjectInput {
  actions: readonly StuckActionInput[];
}

/**
 * Count how many of the given projects are stuck. Used to render the inline
 * amber stuck count on a goal row.
 */
export function countStuckProjects(
  projects: readonly ProjectWithActions[],
): number {
  return projects.reduce(
    (count, p) => (isProjectStuck(p, p.actions) ? count + 1 : count),
    0,
  );
}
