/**
 * Authenticated goal-mutation endpoint (Story 4.2).
 *
 * Establishes the Epic 4 CRUD convention: a thin, per-resource route handler
 * that (1) guards auth before any DB work (401 on no session), (2) validates
 * the untrusted body server-side, and (3) mutates through the RLS-scoped
 * server Supabase client so a user can only ever touch their own rows.
 *
 *   PATCH  /api/goals/[id]  — edit goal fields and/or change status.
 *                            Never regenerates or deletes projects.
 *   DELETE /api/goals/[id]  — SOFT delete: archive the goal AND its linked
 *                            projects AND those projects' actions. No row is
 *                            ever hard-deleted; archived rows are retained.
 *
 * The soft-delete cascade (archive the goal AND its linked projects) runs as a
 * single atomic `archive_goal_cascade` RPC, so a failure can never leave a
 * partially-archived state.
 */

import { sanitizeGoalPatch } from "@/lib/goals/validate";
import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

/** Read the authenticated user id, or null on no session / transient error. */
async function getAuthenticatedUserId(): Promise<string | null> {
  try {
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    return data.user?.id ?? null;
  } catch {
    return null;
  }
}

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const userId = await getAuthenticatedUserId();
  if (!userId) {
    return NextResponse.json(
      { error: "You must be signed in." },
      { status: 401 },
    );
  }

  const { id } = await context.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Request body must be valid JSON." },
      { status: 400 },
    );
  }

  const patch = sanitizeGoalPatch(body);
  if (!patch) {
    return NextResponse.json(
      { error: "No valid goal fields to update." },
      { status: 400 },
    );
  }

  try {
    const supabase = await createClient();
    // RLS scopes to the owner; the explicit user_id guard is defense-in-depth.
    const { data, error } = await supabase
      .from("goals")
      .update(patch)
      .eq("id", id)
      .eq("user_id", userId)
      .select("id")
      .maybeSingle();

    if (error) {
      console.error("[api/goals PATCH] update failed:", error.message);
      return NextResponse.json(
        { error: "Failed to update the goal. Please try again." },
        { status: 500 },
      );
    }

    if (!data) {
      // No owned row matched — unknown id or not the user's goal.
      return NextResponse.json({ error: "Goal not found." }, { status: 404 });
    }

    return NextResponse.json({ id: data.id });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unexpected error";
    console.error("[api/goals PATCH] threw:", message);
    return NextResponse.json(
      { error: "Failed to update the goal. Please try again." },
      { status: 500 },
    );
  }
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  const userId = await getAuthenticatedUserId();
  if (!userId) {
    return NextResponse.json(
      { error: "You must be signed in." },
      { status: 401 },
    );
  }

  const { id } = await context.params;

  try {
    const supabase = await createClient();

    // Confirm the goal exists and is owned before cascading.
    const { data: goal, error: goalReadError } = await supabase
      .from("goals")
      .select("id")
      .eq("id", id)
      .eq("user_id", userId)
      .maybeSingle();

    if (goalReadError) {
      console.error("[api/goals DELETE] goal read failed:", goalReadError.message);
      return NextResponse.json(
        { error: "Failed to delete the goal. Please try again." },
        { status: 500 },
      );
    }
    if (!goal) {
      return NextResponse.json({ error: "Goal not found." }, { status: 404 });
    }

    // Archive the goal and all its projects in one atomic RPC. The projects'
    // actions are archived transitively via their parent project (action_status
    // has no `archived` member by design), so nothing is orphaned or left
    // half-archived on a failure.
    const { error: archiveError } = await supabase.rpc("archive_goal_cascade", {
      p_goal_id: id,
    });

    if (archiveError) {
      if ((archiveError as { code?: string }).code === "P0002") {
        return NextResponse.json({ error: "Goal not found." }, { status: 404 });
      }
      console.error(
        "[api/goals DELETE] archive RPC failed:",
        archiveError.message,
      );
      return NextResponse.json(
        { error: "Failed to delete the goal. Please try again." },
        { status: 500 },
      );
    }

    return NextResponse.json({ id });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unexpected error";
    console.error("[api/goals DELETE] threw:", message);
    return NextResponse.json(
      { error: "Failed to delete the goal. Please try again." },
      { status: 500 },
    );
  }
}
