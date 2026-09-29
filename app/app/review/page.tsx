/**
 * Weekly Review (server component) inside the authenticated `/app` shell
 * (Story 5.4 — shell).
 *
 * Resolves the current ISO week, then reads two things through the server
 * Supabase client (RLS scopes every row to `auth.uid()`):
 *   1. the user's current-week `review_sessions` row (if any), and
 *   2. the most recent completed session's `completed_at` for the "last review"
 *      line on the landing.
 *
 * Render decision:
 *   - An in-progress current-week row (a navigable beat, no `completed_at`) →
 *     render `ReviewShell` seeded at that phase (resume).
 *   - A completed current-week row → show the landing with the last-review date;
 *     do NOT silently reopen it (re-start is out of scope for this story).
 *   - No current-week row → show the landing with an explicit "Start weekly
 *     review" control (and the last-review date if there is one).
 *
 * Session creation is deferred to an explicit Start (see the spec's design
 * note) rather than lazily on load, so glancing at the page never writes an
 * empty session. Any read failure degrades to a safe landing rather than
 * crashing. The `/app` layout already enforces auth.
 */

import type { PriorSnapshotDisplay } from "@/components/review/phase-panels/SnapshotOpenPanel";
import ReviewShell from "@/components/review/ReviewShell";
import StartReview from "@/components/review/StartReview";
import { isReviewShellPhase, type ReviewShellPhase } from "@/lib/review/phases";
import { isoWeek } from "@/lib/review/week";
import type { ReviewPhase } from "@/lib/supabase/schema";
import { createClient } from "@/lib/supabase/server";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Weekly Review — Archer",
};

/** Milliseconds in one day (for computing the prior ISO week). */
const DAY_MS = 24 * 60 * 60 * 1000;

interface CurrentWeekSession {
  id: string;
  current_phase: ReviewPhase;
  completed_at: string | null;
  week_number: number;
  week_start_date: string;
  week_end_date: string;
  opening_retrospective: string | null;
  closing_intention: string | null;
  closing_blocker: string | null;
}

interface ReviewLanding {
  /** The in-progress current-week session to resume, or null. */
  session: CurrentWeekSession | null;
  /** ISO timestamp of the most recently completed review, or null. */
  lastCompletedAt: string | null;
  /** The prior week's closing snapshot, or null. */
  priorSnapshot: PriorSnapshotDisplay | null;
}

/**
 * Load the current-week session (if any) plus the most recent completed
 * review's timestamp. Returns a safe empty landing on any failure.
 */
async function loadReviewLanding(): Promise<ReviewLanding> {
  const empty: ReviewLanding = {
    session: null,
    lastCompletedAt: null,
    priorSnapshot: null,
  };
  try {
    const supabase = await createClient();
    const now = new Date();
    const { week_number, week_year } = isoWeek(now);
    // The prior week's identity = the ISO week of seven days ago. This drives
    // the "Last week you said:" read of `weekly_snapshots` (closed loop).
    const prior = isoWeek(new Date(now.getTime() - 7 * DAY_MS));

    const [
      { data: current, error: currentError },
      { data: lastCompleted },
      { data: priorSnapshotRow },
    ] = await Promise.all([
      supabase
        .from("review_sessions")
        .select(
          "id, current_phase, completed_at, week_number, week_start_date, week_end_date, opening_retrospective, closing_intention, closing_blocker",
        )
        .eq("week_number", week_number)
        .eq("week_year", week_year)
        .maybeSingle(),
      supabase
        .from("review_sessions")
        .select("completed_at")
        .not("completed_at", "is", null)
        .order("completed_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("weekly_snapshots")
        .select("intention, blocker, opening_retrospective")
        .eq("week_number", prior.week_number)
        .eq("week_year", prior.week_year)
        .maybeSingle(),
    ]);

    if (currentError) return empty;

    return {
      session: (current as CurrentWeekSession | null) ?? null,
      lastCompletedAt:
        (lastCompleted as { completed_at: string | null } | null)?.completed_at ??
        null,
      priorSnapshot: (priorSnapshotRow as PriorSnapshotDisplay | null) ?? null,
    };
  } catch {
    return empty;
  }
}

/** Format an ISO timestamp as a short date, guarding an unparseable value. */
function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/** Landing shown when there is no in-progress session to resume. */
function Landing({
  lastCompletedAt,
  currentWeekCompleted,
}: {
  lastCompletedAt: string | null;
  currentWeekCompleted: boolean;
}) {
  return (
    <div className="flex flex-col items-start gap-4 rounded-[var(--radius-md)] border border-border bg-surface p-[var(--spacing-card-p)]">
      {lastCompletedAt && (
        <p className="text-text-secondary">
          Last review completed {formatDate(lastCompletedAt)}.
        </p>
      )}
      {currentWeekCompleted ? (
        <p className="text-text-secondary">
          You&rsquo;ve completed this week&rsquo;s review.
        </p>
      ) : (
        <>
          <p className="text-text-secondary">
            Ready to run this week&rsquo;s review?
          </p>
          <StartReview />
        </>
      )}
    </div>
  );
}

export default async function ReviewPage() {
  const { session, lastCompletedAt, priorSnapshot } = await loadReviewLanding();

  // Resume only an in-progress session parked on a navigable beat (not the
  // terminal 'complete' phase and with no completed_at).
  const resumable =
    session &&
    session.completed_at === null &&
    isReviewShellPhase(session.current_phase);

  return (
    <section className="flex flex-col gap-[var(--spacing-section-y)]">
      <header className="flex items-center justify-between gap-4">
        <h1 className="text-[length:var(--font-size-section)] font-bold text-text-primary">
          Weekly Review
        </h1>
      </header>

      {resumable ? (
        <ReviewShell
          sessionId={session.id}
          initialPhase={session.current_phase as ReviewShellPhase}
          weekNumber={session.week_number}
          weekStartDate={session.week_start_date}
          weekEndDate={session.week_end_date}
          priorSnapshot={priorSnapshot}
          initialSnapshot={{
            opening_retrospective: session.opening_retrospective ?? "",
            closing_intention: session.closing_intention ?? "",
            closing_blocker: session.closing_blocker ?? "",
          }}
        />
      ) : (
        <Landing
          lastCompletedAt={lastCompletedAt}
          currentWeekCompleted={session?.completed_at != null}
        />
      )}
    </section>
  );
}
