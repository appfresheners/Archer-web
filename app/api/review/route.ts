/**
 * Authenticated weekly-review session endpoint (Story 5.4 — shell).
 *
 *   POST /api/review  — create or return the acting user's review session for
 *   the current ISO week.
 *
 * Idempotent for the current week: if a `review_sessions` row already exists
 * for the user + ISO week (the table's `unique (user_id, week_number,
 * week_year)` enforces one), it is returned as-is (including a completed one);
 * otherwise a fresh row is inserted with the computed week identity + Mon/Sun
 * dates and `current_phase = 'snapshot_open'` (`started_at` defaults to now()
 * at the DB). Returns `{ id, current_phase }`. RLS scopes every row to
 * `auth.uid()`; the explicit `user_id` on read/insert keeps ownership tight.
 *
 * Mirrors the auth/validation/error shape of `app/api/inbox/route.ts`.
 */

import { isoWeek, weekBounds } from "@/lib/review/week";
import type { ReviewSessionInsert } from "@/lib/supabase/schema";
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

async function getAuthenticatedUserId(): Promise<string | null> {
  try {
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    return data.user?.id ?? null;
  } catch {
    return null;
  }
}

export async function POST() {
  const userId = await getAuthenticatedUserId();
  if (!userId) {
    return NextResponse.json({ error: "You must be signed in." }, { status: 401 });
  }

  const now = new Date();
  const { week_number, week_year } = isoWeek(now);
  const { monday, sunday } = weekBounds(now);

  try {
    const supabase = await createClient();

    // Idempotent: return the existing current-week row (in progress OR
    // completed) rather than attempting a duplicate insert.
    const { data: existing, error: readError } = await supabase
      .from("review_sessions")
      .select("id, current_phase")
      .eq("user_id", userId)
      .eq("week_number", week_number)
      .eq("week_year", week_year)
      .maybeSingle();

    if (readError) {
      console.error("[api/review POST] lookup failed:", readError.message);
      return NextResponse.json(
        { error: "Failed to start the review. Please try again." },
        { status: 500 },
      );
    }
    if (existing) {
      return NextResponse.json({
        id: existing.id,
        current_phase: existing.current_phase,
      });
    }

    const row: ReviewSessionInsert = {
      user_id: userId,
      week_number,
      week_year,
      week_start_date: monday,
      week_end_date: sunday,
      // current_phase defaults to 'snapshot_open' at the DB; set explicitly for
      // clarity and so the returned row is predictable.
      current_phase: "snapshot_open",
    };

    const { data, error } = await supabase
      .from("review_sessions")
      .insert(row)
      .select("id, current_phase")
      .maybeSingle();

    if (error) {
      // Concurrency: two Start clicks can both pass the read above and race to
      // insert. The second violates `unique (user_id, week_number, week_year)`
      // (Postgres 23505). Honor the idempotency contract by re-reading and
      // returning the row the winner created, rather than surfacing a 500.
      if ((error as { code?: string }).code === "23505") {
        const { data: raced } = await supabase
          .from("review_sessions")
          .select("id, current_phase")
          .eq("user_id", userId)
          .eq("week_number", week_number)
          .eq("week_year", week_year)
          .maybeSingle();
        if (raced) {
          return NextResponse.json({
            id: raced.id,
            current_phase: raced.current_phase,
          });
        }
      }
      console.error("[api/review POST] insert failed:", error.message);
      return NextResponse.json(
        { error: "Failed to start the review. Please try again." },
        { status: 500 },
      );
    }
    if (!data) {
      console.error("[api/review POST] insert returned no row");
      return NextResponse.json(
        { error: "Failed to start the review. Please try again." },
        { status: 500 },
      );
    }
    return NextResponse.json({ id: data.id, current_phase: data.current_phase });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unexpected error";
    console.error("[api/review POST] threw:", message);
    return NextResponse.json(
      { error: "Failed to start the review. Please try again." },
      { status: 500 },
    );
  }
}
