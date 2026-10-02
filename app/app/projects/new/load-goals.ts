import type { GoalOption } from "@/components/projects/ProjectModeInput";
import { createClient } from "@/lib/supabase/server";

/**
 * Load the signed-in user's goals for the manual parent-goal picker (Story
 * 2.7). RLS scopes the read to `auth.uid()`. Any failure degrades to an empty
 * picker (still valid — a goal-less manual project is permitted).
 */
export async function loadGoalsForPicker(): Promise<GoalOption[]> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("goals")
      .select("id, goal_text");

    if (error || !data) return [];
    return data.map((goal) => ({ id: goal.id, goal_text: goal.goal_text }));
  } catch {
    return [];
  }
}
