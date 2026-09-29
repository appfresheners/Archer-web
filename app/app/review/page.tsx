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

interface CurrentWeekSession {
  id: string;
  current_phase: ReviewPhase;
  completed_at: string | null;
}

interface ReviewLanding {
  /** The in-progress current-week session to resume, or null. */
  session: CurrentWeekSession | null;
  /** ISO timestamp of the most recently completed review, or null. */
  lastCompletedAt: string | null;
}

/**
 * Load the current-week session (if any) plus the most recent completed
 * review's timestamp. Returns a safe empty landing on any failure.
 */
async function loadReviewLanding(): Promise<ReviewLanding> {
  try {
    const supabase = await createClient();
    const { week_number, week_year } = isoWeek(new Date());

    const [{ data: current, error: currentError }, { data: lastCompleted }] =
      await Promise.all([
        supabase
          .from("review_sessions")
          .select("id, current_phase, completed_at")
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
      ]);

    if (currentError) return { session: null, lastCompletedAt: null };

    return {
      session: (current as CurrentWeekSession | null) ?? null,
      lastCompletedAt:
        (lastCompleted as { completed_at: string | null } | null)?.completed_at ??
        null,
    };
  } catch {
    return { session: null, lastCompletedAt: null };
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
  const { session, lastCompletedAt } = await loadReviewLanding();

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
