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
import Breadcrumbs from "@/components/shared/Breadcrumbs";
import ReadErrorState from "@/components/shared/ReadErrorState";
import {
  buildEngageModel,
  type EngageActionInput,
  type EngageGoalInput,
  type EngageModel,
  type EngageProjectInput,
} from "@/lib/engage/model";
import type { ReadListResult } from "@/lib/read-result";
import { createClient } from "@/lib/supabase/server";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Engage — Archer",
};

const WEEKLY_COMMITMENT_TIMEOUT_MS = 3_000;

interface WeeklyCommitment {
  intention: string;
  created_at: string;
}

type WeeklyCommitmentResult =
  | { status: "ok"; data: WeeklyCommitment | null }
  | { status: "error" };

/** Today's calendar date (YYYY-MM-DD) for future-scheduled exclusion. */
function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Load goals + projects + actions and build the Engage model. Returns a safe
 * empty model on any failure so the page always renders.
 */
async function loadEngageModel(): Promise<ReadListResult<EngageModel>> {
  try {
    const supabase = await createClient();

    const [
      { data: goals, error: goalsError },
      { data: projects, error: projectsError },
      { data: actions, error: actionsError },
    ] = await Promise.all([
      supabase.from("goals").select("id, goal_text, status"),
      supabase.from("projects").select("id, goal_id, name, status"),
      supabase
        .from("actions")
        .select(
          "id, project_id, text, status, context_tags, time_available_minutes, scheduled_for, sort_order",
        ),
    ]);

    if (goalsError || projectsError || actionsError) {
      return { status: "error" };
    }

    return {
      status: "ok",
      data: buildEngageModel(
        (goals ?? []) as EngageGoalInput[],
        (projects ?? []) as EngageProjectInput[],
        (actions ?? []) as EngageActionInput[],
        todayIso(),
      ),
    };
  } catch {
    return { status: "error" };
  }
}

async function loadWeeklyCommitment(): Promise<WeeklyCommitmentResult> {
  try {
    const supabase = await createClient();
    const { data: session, error: sessionError } = await supabase
      .from("review_sessions")
      .select("id, completed_at")
      .not("completed_at", "is", null)
      .order("completed_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (sessionError) return { status: "error" };
    if (!session) return { status: "ok", data: null };

    const { data: snapshot, error: snapshotError } = await supabase
      .from("weekly_snapshots")
      .select("intention, created_at")
      .eq("review_session_id", session.id)
      .maybeSingle();

    if (snapshotError) return { status: "error" };
    return {
      status: "ok",
      data: (snapshot as WeeklyCommitment | null) ?? null,
    };
  } catch {
    return { status: "error" };
  }
}

async function loadWeeklyCommitmentWithTimeout(): Promise<WeeklyCommitmentResult> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      loadWeeklyCommitment(),
      new Promise<WeeklyCommitmentResult>((resolve) => {
        timeoutId = setTimeout(
          () => resolve({ status: "error" }),
          WEEKLY_COMMITMENT_TIMEOUT_MS,
        );
      }),
    ]);
  } finally {
    if (timeoutId !== undefined) clearTimeout(timeoutId);
  }
}

function formatSavedDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

export default async function EngagePage() {
  const [result, commitmentResult] = await Promise.all([
    loadEngageModel(),
    loadWeeklyCommitmentWithTimeout(),
  ]);

  if (result.status === "error") {
    return (
      <section className="flex flex-col gap-[var(--spacing-section-y)]">
        <Breadcrumbs items={[{ label: "Engage" }]} />
        <ReadErrorState />
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-[var(--spacing-section-y)]">
      <Breadcrumbs items={[{ label: "Engage" }]} />
      {commitmentResult.status === "error" ? (
        <p role="status" className="border-l-4 border-border-strong bg-surface px-4 py-3 text-text-secondary">
          Weekly commitment is unavailable right now.
        </p>
      ) : commitmentResult.data ? (
        <aside
          aria-label="Weekly commitment"
          className="flex flex-col gap-1 border-l-4 border-primary bg-primary-subtle px-4 py-3"
        >
          <p className="text-[length:var(--font-size-small)] font-semibold text-text-primary">
            Weekly commitment
          </p>
          <p className="break-words text-text-primary">
            {commitmentResult.data.intention}
          </p>
          <p className="text-[length:var(--font-size-small)] text-text-secondary">
            Saved {formatSavedDate(commitmentResult.data.created_at)}
          </p>
        </aside>
      ) : null}
      <EngageBoard model={result.data} />
    </section>
  );
}
