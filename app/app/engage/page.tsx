/**
 * Engage view (server component) inside the authenticated `/app` shell.
 *
 * The single "what do I do now" surface (Story 5.3). Loads the signed-in user's
 * goals, projects, and actions through the server Supabase client (RLS scopes
 * every row to `auth.uid()`) in a fixed number of reads, then delegates all
 * derivation to the pure `buildEngageModel`:
 *
 *   - only `committed` next actions across `active` goals/projects appear;
 *   - rows are grouped by goal, with each goal's stuck (active, zero-committed)
 *     projects surfaced at the bottom of the group;
 *   - standalone committed actions (project_id null) collect under "Anytime";
 *   - `waiting` and future-`scheduled_for` actions are excluded from do-now.
 *
 * The interactive board (Done → next-action prompt, commit, complete, filter)
 * lives in `EngageBoard`, which mutates via the existing action/project routes
 * and calls `router.refresh()`. Any read failure degrades to a safe empty model
 * (mirrors the goals-list `loadGoals` try/catch → empty).
 *
 * The `/app` layout already enforces auth, so no auth check is repeated here.
 */

import EngageBoard from "@/components/engage/EngageBoard";
import {
  buildEngageModel,
  type EngageActionInput,
  type EngageGoalInput,
  type EngageModel,
  type EngageProjectInput,
} from "@/lib/engage/model";
import { createClient } from "@/lib/supabase/server";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Engage — Archer",
};

const EMPTY_MODEL: EngageModel = {
  goalGroups: [],
  projectGroups: [],
  anytime: [],
  isEmpty: true,
};

/** Today's calendar date (YYYY-MM-DD) for future-scheduled exclusion. */
function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Load goals + projects + actions and build the Engage model. Returns a safe
 * empty model on any failure so the page always renders.
 */
async function loadEngageModel(): Promise<EngageModel> {
  try {
    const supabase = await createClient();

    const [{ data: goals }, { data: projects }, { data: actions }] =
      await Promise.all([
        supabase.from("goals").select("id, goal_text, status"),
        supabase.from("projects").select("id, goal_id, name, status"),
        supabase
          .from("actions")
          .select(
            "id, project_id, text, status, context_tags, scheduled_for, sort_order",
          ),
      ]);

    return buildEngageModel(
      (goals ?? []) as EngageGoalInput[],
      (projects ?? []) as EngageProjectInput[],
      (actions ?? []) as EngageActionInput[],
      todayIso(),
    );
  } catch {
    return EMPTY_MODEL;
  }
}

export default async function EngagePage() {
  const model = await loadEngageModel();

  return (
    <section className="flex flex-col gap-[var(--spacing-section-y)]">
      <EngageBoard model={model} />
    </section>
  );
}
