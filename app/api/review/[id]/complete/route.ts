/**
 * Authenticated review-completion endpoint (Story 5.5).
 *
 *   POST /api/review/[id]/complete  — finish a weekly review: write the
 *   immutable `weekly_snapshots` row and mark the `review_sessions` row
 *   complete.
 *
 * Flow (owned, not-yet-completed session only):
 *   1. Read the session for its week identity + `opening_retrospective`. Scoped
 *      to the acting user AND `completed_at IS NULL`, so an unknown, non-owned,
 *      or already-completed id yields 404 (no silent re-completion).
 *   2. Validate the body's closing fields via `sanitizeReviewComplete` — both
 *      `intention` and `blocker` must be non-empty (400 otherwise). Never trust
 *      the client; the PATCH persistence validator allows empties, this gate
 *      does not.
 *   3. INSERT the immutable `weekly_snapshots` row (week identity + opening
 *      retrospective from the session, intention/blocker from the body).
 *   4. UPDATE the session `completed_at = now()`, `current_phase = 'complete'`.
 *
 * Write ordering + retry tolerance (see spec Design Notes): the snapshot is
 * inserted FIRST so a completed review always has its snapshot. If step 4 fails
 * after step 3, we return 500 — the immutable snapshot exists but the session
 * isn't marked complete; the user can retry. On retry the insert re-runs and
 * violates `unique (user_id, week_number, week_year)` (Postgres 23505); we treat
 * that as "snapshot already recorded" and proceed to the session update. True
 * single-transaction atomicity would need an RPC (flagged Ask-First in the
 * spec); this retry-tolerant sequential ordering is the app's pattern.
 *
 * Mirrors the auth/error shape of `app/api/review/[id]/route.ts`.
 */

import { sanitizeReviewComplete } from "@/lib/review/complete";
import type { WeeklySnapshotInsert } from "@/lib/supabase/schema";
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

export async function POST(request: NextRequest, context: RouteContext) {
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

  const closing = sanitizeReviewComplete(body);
  if (!closing) {
    return NextResponse.json(
      { error: "Both an intention and a blocker are required to complete the review." },
      { status: 400 },
    );
  }

  try {
    const supabase = await createClient();

    // 1) Load the session's week identity + opening retrospective. Scoped to
    // the acting user and not-yet-completed so a completed/unknown/non-owned id
    // resolves to 404 below.
    const { data: session, error: readError } = await supabase
      .from("review_sessions")
      .select(
        "id, week_number, week_year, week_start_date, week_end_date, opening_retrospective",
      )
      .eq("id", id)
      .eq("user_id", userId)
      .is("completed_at", null)
      .maybeSingle();

    if (readError) {
      console.error("[api/review complete POST] read failed:", readError.message);
      return NextResponse.json(
        { error: "Failed to complete the review. Please try again." },
        { status: 500 },
      );
    }
    if (!session) {
      return NextResponse.json({ error: "Review not found." }, { status: 404 });
    }

    // 2) INSERT the immutable snapshot FIRST. A retry (session update failed
    // earlier) re-runs this insert and hits the per-user+week unique — treat
    // 23505 as "already recorded" and fall through to the session update.
    const snapshot: WeeklySnapshotInsert = {
      user_id: userId,
      review_session_id: session.id,
      week_number: session.week_number,
      week_year: session.week_year,
      week_start_date: session.week_start_date,
      week_end_date: session.week_end_date,
      intention: closing.intention,
      blocker: closing.blocker,
      opening_retrospective: session.opening_retrospective,
    };

    const { error: insertError } = await supabase
      .from("weekly_snapshots")
      .insert(snapshot);

    if (insertError && (insertError as { code?: string }).code !== "23505") {
      console.error(
        "[api/review complete POST] snapshot insert failed:",
        insertError.message,
      );
      return NextResponse.json(
        { error: "Failed to complete the review. Please try again." },
        { status: 500 },
      );
    }

    // 3) Mark the session complete. Still scoped to the owner + not-completed
    // so a concurrent completion can't double-write.
    const { data: updated, error: updateError } = await supabase
      .from("review_sessions")
      .update({ completed_at: new Date().toISOString(), current_phase: "complete" })
      .eq("id", id)
      .eq("user_id", userId)
      .is("completed_at", null)
      .select("id")
      .maybeSingle();

    if (updateError) {
      // The immutable snapshot exists but the session update failed — return
      // 500; a retry tolerates the pre-existing snapshot (23505 above).
      console.error(
        "[api/review complete POST] session update failed:",
        updateError.message,
      );
      return NextResponse.json(
        { error: "Failed to complete the review. Please try again." },
        { status: 500 },
      );
    }
    if (!updated) {
      // The session vanished / was completed between the read and the update.
      return NextResponse.json({ error: "Review not found." }, { status: 404 });
    }

    return NextResponse.json({ id: updated.id });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unexpected error";
    console.error("[api/review complete POST] threw:", message);
    return NextResponse.json(
      { error: "Failed to complete the review. Please try again." },
      { status: 500 },
    );
  }
}
