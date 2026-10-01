import type { GoalStatus } from "@/lib/supabase/schema";

export const MONTHLY_GOAL_CHECK_INTERVAL_MS = 30 * 24 * 60 * 60 * 1000;

export function getMonthlyGoalCheckCutoff(): string {
  return new Date(Date.now() - MONTHLY_GOAL_CHECK_INTERVAL_MS).toISOString();
}

export interface MonthlyCheckGoal {
  status: GoalStatus;
  last_checked_at: string | null;
  created_at: string;
}

export function isMonthlyGoalCheckDue(
  goal: MonthlyCheckGoal,
  now: Date,
): boolean {
  if (goal.status !== "active") return false;

  const baseline = new Date(goal.last_checked_at ?? goal.created_at).getTime();
  return (
    Number.isFinite(baseline) &&
    now.getTime() - baseline >= MONTHLY_GOAL_CHECK_INTERVAL_MS
  );
}