import type { GoalOption } from "@/components/projects/ProjectModeInput";
import type { GoalStatus } from "@/lib/supabase/schema";
import { createClient } from "@/lib/supabase/server";

/**
 * Goal statuses a project may still be attached to. Completed and archived
 * goals are terminal, so they are excluded from the picker.
 */
const ATTACHABLE_GOAL_STATUSES: GoalStatus[] = [
  "active",
  "paused",
  "not_now",
  "someday",
];

/**
 * Load the signed-in user's non-terminal goals for the manual parent-goal
 * picker (Story 2.7), ordered by name. RLS scopes the read to `auth.uid()`.
 * Any failure degrades to an empty picker (still valid — a goal-less manual
 * project is permitted).
 */
export async function loadGoalsForPicker(): Promise<GoalOption[]> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("goals")
      .select("id, goal_text")
      .in("status", ATTACHABLE_GOAL_STATUSES)
      .order("goal_text", { ascending: true });

    if (error || !data) return [];
    return data.map((goal) => ({ id: goal.id, goal_text: goal.goal_text }));
  } catch {
    return [];
  }
}
