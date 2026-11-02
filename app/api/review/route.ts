/**
 * Authenticated weekly-review session endpoint (Story 5.4 — shell).
 *
 *   POST /api/review  — create or return the acting user's review session for
 *   the target ISO week.
 *
 * The request body may carry `{ week_number, week_year }` to target a specific
 * week (used when the user missed their Sunday review and needs to catch up on
 * the prior week). If omitted or invalid, defaults to the current ISO week.
 * The target week must not be in the future and must be within the last 2 weeks
 * as a sanity bound.
 *
 * Idempotent for the target week: if a `review_sessions` row already exists
 * for the user + ISO week (the table's `unique (user_id, week_number,
 * week_year)` enforces one), it is returned as-is (including a completed one);
 * otherwise a fresh row is inserted with the computed week identity + Mon/Sun
 * dates and `current_phase = 'snapshot_open'` (`started_at` defaults to now()
 * at the DB). Returns `{ id, current_phase }`. RLS scopes every row to
 * `auth.uid()`; the explicit `user_id` on read/insert keeps ownership tight.
 *
 * Mirrors the auth/validation/error shape of `app/api/inbox/route.ts`.
 */

import { withHttpMetrics } from "@/lib/observability/http";
import { isoWeek, weekBounds } from "@/lib/review/week";
import type { ReviewSessionInsert } from "@/lib/supabase/schema";
import { createClient } from "@/lib/supabase/server";
import { NextResponse, type NextRequest } from "next/server";

async function getAuthenticatedUserId(): Promise<string | null> {
  try {
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    return data.user?.id ?? null;
  } catch {
    return null;
  }
}

/**
 * Resolve the target week from the request body. Accepts `{ week_number,
 * week_year }` if both are integers and the week is not in the future and
 * no more than 2 weeks in the past. Falls back to the current week.
 */
async function resolveTargetWeek(
  req: NextRequest,
): Promise<{ week_number: number; week_year: number; monday: string; sunday: string }> {
  const now = new Date();
  const current = isoWeek(now);

  try {
    const body = await req.json().catch(() => null);
    if (
      body &&
      typeof body.week_number === "number" &&
      typeof body.week_year === "number" &&
      Number.isInteger(body.week_number) &&
      Number.isInteger(body.week_year) &&
      body.week_number >= 1 &&
      body.week_number <= 53
    ) {
      const { week_number, week_year } = body as { week_number: number; week_year: number };

      // Reject future weeks.
      const isFuture =
        week_year > current.week_year ||
        (week_year === current.week_year && week_number > current.week_number);
      if (isFuture) throw new Error("future week");

      // Reject anything older than 2 weeks as a sanity bound.
      const weeksAgo =
        (current.week_year - week_year) * 52 + (current.week_number - week_number);
      if (weeksAgo > 2) throw new Error("too far in the past");

      // Compute Mon/Sun for the requested week by stepping back from now.
      // We find the Monday of the target week via ISO week arithmetic.
      const targetMonday = new Date(
        Date.UTC(week_year, 0, 1 + (week_number - 1) * 7),
      );
      // Adjust to the actual Monday of that ISO week.
      const dayOfWeek = targetMonday.getUTCDay() === 0 ? 7 : targetMonday.getUTCDay();
      const monday = new Date(targetMonday.getTime() - (dayOfWeek - 1) * 24 * 60 * 60 * 1000);
      // Verify the computed date actually maps to the requested ISO week.
      const check = isoWeek(monday);
      if (check.week_number !== week_number || check.week_year !== week_year) {
        throw new Error("week identity mismatch");
      }
      const sunday = new Date(monday.getTime() + 6 * 24 * 60 * 60 * 1000);
      const fmt = (d: Date) =>
        `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
      return { week_number, week_year, monday: fmt(monday), sunday: fmt(sunday) };
    }
  } catch {
    // fall through to current week
  }

  const { monday, sunday } = weekBounds(now);
  return { ...current, monday, sunday };
}

async function postHandler(req: NextRequest) {
  const userId = await getAuthenticatedUserId();
  if (!userId) {
    return NextResponse.json({ error: "You must be signed in." }, { status: 401 });
  }

  const { week_number, week_year, monday, sunday } = await resolveTargetWeek(req);

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

export const POST = withHttpMetrics(
  {
    method: "POST",
    route: "/api/review",
    expectedStatusCodes: [200, 401],
  },
  postHandler,
);
