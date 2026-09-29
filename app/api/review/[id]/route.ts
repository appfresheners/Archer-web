/**
 * Authenticated per-review-session endpoint (Story 5.4 — shell).
 *
 *   PATCH /api/review/[id]  — persist the session's `current_phase` as the user
 *   navigates between beats (forward on Next, back on Back).
 *
 * Scoped by the acting user (RLS also enforces ownership) AND to sessions that
 * are not yet completed (`completed_at IS NULL`), so a completed review cannot
 * be silently reopened by rewinding its phase; a non-owned, unknown, or
 * completed id yields 404. The body is validated by `sanitizeReviewPatch`, which
 * for the shell accepts only a valid `current_phase` beat. Story 5.5 extends
 * the validator (and therefore this route, unchanged) to also persist the
 * snapshot fields. Mirrors `app/api/inbox/[id]/route.ts`.
 */

import { sanitizeReviewPatch } from "@/lib/review/validate";
import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

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
    return NextResponse.json({ error: "You must be signed in." }, { status: 401 });
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

  const patch = sanitizeReviewPatch(body);
  if (!patch) {
    return NextResponse.json(
      { error: "No valid review update to record." },
      { status: 400 },
    );
  }

  try {
    const supabase = await createClient();
    // A completed review is terminal — it must not be silently reopened by
    // rewinding its phase. Scoping the update to `completed_at IS NULL` means a
    // completed (or unknown/non-owned) session yields the 404 below.
    const { data, error } = await supabase
      .from("review_sessions")
      .update(patch)
      .eq("id", id)
      .eq("user_id", userId)
      .is("completed_at", null)
      .select("id, current_phase")
      .maybeSingle();

    if (error) {
      console.error("[api/review PATCH] update failed:", error.message);
      return NextResponse.json(
        { error: "Failed to save the review. Please try again." },
        { status: 500 },
      );
    }
    if (!data) {
      return NextResponse.json({ error: "Review not found." }, { status: 404 });
    }
    return NextResponse.json({ id: data.id, current_phase: data.current_phase });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unexpected error";
    console.error("[api/review PATCH] threw:", message);
    return NextResponse.json(
      { error: "Failed to save the review. Please try again." },
      { status: 500 },
    );
  }
}
