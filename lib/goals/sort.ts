/**
 * Deterministic goals-list ordering (Story 4.1).
 *
 * Precedence by status, then most-recently-created first within each tier:
 *   Active → Paused → Not now → Someday → Completed → Archived
 *
 * Pure and stable so it is trivially unit-testable and reused wherever goals
 * are listed.
 */

import type { GoalStatus } from "@/lib/supabase/schema";

/** Lower rank sorts earlier. */
const STATUS_RANK: Record<GoalStatus, number> = {
  active: 0,
  paused: 1,
  not_now: 2,
  someday: 3,
  completed: 4,
  archived: 5,
};

/** Minimal goal shape needed for ordering. */
export interface SortableGoal {
  status: GoalStatus;
  created_at: string;
}

/**
 * Return a new array ordered by status precedence, then created_at descending.
 * Does not mutate the input.
 */
export function sortGoals<T extends SortableGoal>(goals: readonly T[]): T[] {
  return [...goals].sort((a, b) => {
    const rankDiff = STATUS_RANK[a.status] - STATUS_RANK[b.status];
    if (rankDiff !== 0) return rankDiff;
    // created_at desc — newest first. ISO timestamps compare lexicographically.
    if (a.created_at < b.created_at) return 1;
    if (a.created_at > b.created_at) return -1;
    return 0;
  });
}
