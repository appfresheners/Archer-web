/**
 * Daily Shutdown (server component) — Story 10.1.
 *
 * Loads today's shutdown completion (if any), unprocessed inbox count, and
 * completed actions for the current calendar day. When a shutdown has already
 * been completed today, renders the already-complete state with saved data.
 * Otherwise renders the full flow with inbox check, progress, intention input,
 * and termination phrase.
 *
 * Query logic:
 *   - Today's completion: filter `completed_at` by UTC date (YYYY-MM-DD).
 *   - Unprocessed inbox: count where `processing_status = 'unprocessed'`.
 *   - Today's done actions: filter `status = 'done'` AND `updated_at` by UTC
 *     date, join with projects for parent project name.
 *
 * Any query failure degrades gracefully to empty state (no crash).
 */

import Breadcrumbs from "@/components/shared/Breadcrumbs";
import ReadErrorState from "@/components/shared/ReadErrorState";
import ShutdownAlreadyComplete from "@/components/shutdown/ShutdownAlreadyComplete";
import ShutdownFlow from "@/components/shutdown/ShutdownFlow";
import { createClient } from "@/lib/supabase/server";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Daily Shutdown — Archer",
};

interface CompletedAction {
  id: string;
  text: string;
  project_name: string | null;
}

interface ShutdownData {
  alreadyCompleted: boolean;
  completedAt?: string;
  savedIntention?: string | null;
  unprocessedCount: number;
  completedActions: CompletedAction[];
}

async function loadShutdownData(): Promise<{
  status: "ok" | "error";
  data?: ShutdownData;
}> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { status: "error" };

    // Today's date range (UTC)
    const now = new Date();
    const todayStart = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
    );
    const tomorrowStart = new Date(todayStart);
    tomorrowStart.setUTCDate(tomorrowStart.getUTCDate() + 1);

    const todayStartISO = todayStart.toISOString();
    const tomorrowStartISO = tomorrowStart.toISOString();

    // Check if shutdown already completed today
    const { data: existingShutdown, error: shutdownError } = await supabase
      .from("daily_shutdowns")
      .select("completed_at, intention")
      .eq("user_id", user.id)
      .gte("completed_at", todayStartISO)
      .lt("completed_at", tomorrowStartISO)
      .maybeSingle();

    if (shutdownError && shutdownError.code !== "PGRST116") {
      // PGRST116 = no rows, which is fine (not completed yet)
      return { status: "error" };
    }

    if (existingShutdown) {
      return {
        status: "ok",
        data: {
          alreadyCompleted: true,
          completedAt: existingShutdown.completed_at,
          savedIntention: existingShutdown.intention,
          unprocessedCount: 0,
          completedActions: [],
        },
      };
    }

    // Not completed yet — load data for the full flow

    // Unprocessed inbox count
    const { count: unprocessedCount, error: inboxError } = await supabase
      .from("inbox_items")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("processing_status", "unprocessed");

    if (inboxError) return { status: "error" };

    // Today's completed actions with project names
    const { data: actionsData, error: actionsError } = await supabase
      .from("actions")
      .select(
        `
        id,
        text,
        projects!left(name)
      `,
      )
      .eq("user_id", user.id)
      .eq("status", "done")
      .gte("updated_at", todayStartISO)
      .lt("updated_at", tomorrowStartISO)
      .order("updated_at", { ascending: false });

    if (actionsError) return { status: "error" };

    // Transform the joined data
    const completedActions: CompletedAction[] = (actionsData ?? []).map(
      (row) => ({
        id: row.id as string,
        text: row.text as string,
        project_name: (row.projects as unknown as { name: string } | null)?.name ?? null,
      }),
    );

    return {
      status: "ok",
      data: {
        alreadyCompleted: false,
        unprocessedCount: unprocessedCount ?? 0,
        completedActions,
      },
    };
  } catch {
    return { status: "error" };
  }
}

export default async function ShutdownPage() {
  const result = await loadShutdownData();

  if (result.status === "error" || !result.data) {
    return (
      <section className="flex flex-col gap-[var(--spacing-section-y)]">
        <Breadcrumbs items={[{ label: "Daily Shutdown" }]} />
        <ReadErrorState />
      </section>
    );
  }

  const { alreadyCompleted, completedAt, savedIntention, unprocessedCount, completedActions } =
    result.data;

  return (
    <section className="flex flex-col gap-[var(--spacing-section-y)]">
      <Breadcrumbs items={[{ label: "Daily Shutdown" }]} />

      {alreadyCompleted && completedAt ? (
        <ShutdownAlreadyComplete
          completedAt={completedAt}
          intention={savedIntention ?? null}
        />
      ) : (
        <ShutdownFlow
          unprocessedCount={unprocessedCount}
          completedActions={completedActions}
        />
      )}
    </section>
  );
}
