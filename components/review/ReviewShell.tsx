"use client";

/**
 * ReviewShell — the client-side driver for the weekly review (Story 5.4 shell,
 * extended in 5.5 with the two snapshot bookends + completion).
 *
 * Owns the `current_phase` state (seeded from the persisted session) and renders:
 *   - the five-beat `PhaseBar`,
 *   - an `aria-live="polite"` region that announces the current phase name,
 *   - the active phase panel: the props-driven `SnapshotOpenPanel` /
 *     `SnapshotClosePanel` for the bookends, or the static middle placeholder,
 *   - Back / Next (or "Complete review" on the closing beat), and an inline
 *     `role="alert"` error.
 *
 * Snapshot fields (5.5): the shell holds `opening_retrospective`,
 * `closing_intention`, `closing_blocker` seeded from the session. Each is
 * persisted via `PATCH /api/review/[id]` on blur (commit) so a resumed review
 * restores them. The `snapshot_open → get_clear` advance is GATED on a
 * non-empty (trimmed) retrospective — the only tightening of the otherwise
 * permissive 5.4 navigation, applied to this phase alone. The middle beats keep
 * the permissive advance (their content + gates land in 5.6).
 *
 * Completion (5.5): on `snapshot_close`, Next is replaced by the panel's
 * "Complete review" action, which POSTs `/api/review/[id]/complete`; on success
 * the shell navigates to `/app/engage`.
 *
 * Navigation is no-skip by construction: the shell only ever moves to
 * `nextPhase(current)` or `prevPhase(current)`. The review is NOT timed.
 *
 * Accessibility / lint (repo react-hooks rules): the phase is announced by
 * *rendering* the phase name inside a live region — no setState-in-effect.
 * Snapshot field state is seeded from props at render time via a "sentinel"
 * pattern (compare the last-seen seed captured in state to the incoming prop
 * and reset during render), NOT via an effect — satisfying
 * react-hooks/set-state-in-effect.
 */

import PhaseBar from "@/components/review/PhaseBar";
import GetClearPanel from "@/components/review/phase-panels/GetClearPanel";
import GetCreativePanel from "@/components/review/phase-panels/GetCreativePanel";
import GetCurrentPanel from "@/components/review/phase-panels/GetCurrentPanel";
import SnapshotClosePanel from "@/components/review/phase-panels/SnapshotClosePanel";
import SnapshotOpenPanel, {
  type PriorSnapshotDisplay,
} from "@/components/review/phase-panels/SnapshotOpenPanel";
import {
  nextPhase,
  PHASE_COUNT,
  PHASE_LABELS,
  phaseIndex,
  prevPhase,
  type ReviewShellPhase,
} from "@/lib/review/phases";
import type { ReviewData } from "@/lib/review/reviewData";
import { useRouter } from "next/navigation";
import { useState } from "react";

const GENERIC_ERROR = "Something went wrong. Please try again.";

export interface ReviewShellSnapshotInput {
  opening_retrospective: string;
  closing_intention: string;
  closing_blocker: string;
}

interface ReviewShellProps {
  sessionId: string;
  initialPhase: ReviewShellPhase;
  /** Week identity for the opening header. */
  weekNumber: number;
  weekStartDate: string;
  weekEndDate: string;
  /** The prior week's closing snapshot, or null. */
  priorSnapshot: PriorSnapshotDisplay | null;
  /** Snapshot field values persisted on the session (seed the editors). */
  initialSnapshot: ReviewShellSnapshotInput;
  /** Middle-phase data (Get Clear/Current/Creative), from the page loader. */
  reviewData: ReviewData;
}

export default function ReviewShell({
  sessionId,
  initialPhase,
  weekNumber,
  weekStartDate,
  weekEndDate,
  priorSnapshot,
  initialSnapshot,
  reviewData,
}: ReviewShellProps) {
  const router = useRouter();
  const [phase, setPhase] = useState<ReviewShellPhase>(initialPhase);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [showClosingErrors, setShowClosingErrors] = useState(false);
  // Client-side, per-session record of the active projects the user has
  // reviewed (confirmed / committed / status-changed) during Get Current.
  // Not persisted — leaving mid-phase resets it, which errs toward MORE review
  // (safe). There is no durable per-project review-state store.
  const [reviewedProjectIds, setReviewedProjectIds] = useState<Set<string>>(
    () => new Set(),
  );
  const markReviewed = (projectId: string) =>
    setReviewedProjectIds((prev) => {
      if (prev.has(projectId)) return prev;
      const next = new Set(prev);
      next.add(projectId);
      return next;
    });
  const refresh = () => router.refresh();

  // Snapshot field editors. Seeded from `initialSnapshot`. If the session's
  // seed identity changes (e.g. the page re-seeds after a resume), reset the
  // editors during render — a purity-safe alternative to a setState-in-effect.
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const [seed, setSeed] = useState(initialSnapshot);
  if (seed !== initialSnapshot) {
    setSeed(initialSnapshot);
    setSnapshot(initialSnapshot);
  }

  const forward = nextPhase(phase);
  const back = prevPhase(phase);
  const positionLabel = `Phase ${phaseIndex(phase) + 1} of ${PHASE_COUNT}: ${PHASE_LABELS[phase]}`;

  const retrospectiveEmpty = snapshot.opening_retrospective.trim().length === 0;
  // Opening gate: block advancing out of snapshot_open until the retrospective
  // is non-empty.
  const openingGateBlocks = phase === "snapshot_open" && retrospectiveEmpty;

  // Get Clear gate: cannot advance until the inbox is at zero unprocessed items.
  const getClearGateBlocks =
    phase === "get_clear" && reviewData.unprocessedCount > 0;

  // The "current projects satisfied" rule, shared by the Get Current advance
  // gate AND the final completion gate: every active project must have a
  // committed action (not stuck) OR have been reviewed (confirmed / committed /
  // status-changed) this session.
  const anyProjectUnresolved = reviewData.currentProjects.some(
    (p) => p.isStuck && !reviewedProjectIds.has(p.id),
  );

  // Get Current gate: cannot advance while any active project is still stuck
  // and unreviewed.
  const getCurrentGateBlocks = phase === "get_current" && anyProjectUnresolved;

  // Completion gate (AC): a review cannot be COMPLETED until all inbox items
  // are processed AND every active project is resolved. Re-checked here (not
  // only at Get Clear / Get Current) because Get Creative can re-inject inbox
  // items (activate / "anything missing?") after those phases passed.
  const completionBlocked =
    reviewData.unprocessedCount > 0 || anyProjectUnresolved;
  const completionBlockReason =
    reviewData.unprocessedCount > 0
      ? "Process every inbox item before completing the review."
      : anyProjectUnresolved
        ? "Give each stuck project a committed action or change its status before completing."
        : "";

  const gateBlocks = openingGateBlocks || getClearGateBlocks || getCurrentGateBlocks;

  /**
   * Persist a partial snapshot update (and/or a phase) for the session. Returns
   * true on success. On failure surfaces the error and leaves state intact.
   */
  async function persist(patch: Record<string, unknown>): Promise<boolean> {
    setError("");
    try {
      const res = await fetch(`/api/review/${sessionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!res.ok) {
        const payload = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        setError(payload?.error || GENERIC_ERROR);
        return false;
      }
      return true;
    } catch {
      setError(GENERIC_ERROR);
      return false;
    }
  }

  /** Persist the current value of a single snapshot field (blur commit). */
  async function commitField(field: keyof ReviewShellSnapshotInput) {
    if (busy) return;
    await persist({ [field]: snapshot[field] });
  }

  /** Persist both closing fields in ONE PATCH (avoids racing requests). */
  async function commitClosing() {
    if (busy) return;
    await persist({
      closing_intention: snapshot.closing_intention,
      closing_blocker: snapshot.closing_blocker,
    });
  }

  /**
   * Persist `target` as the session's current_phase, then move there locally.
   * Used by both Back and Next. On failure we stay put and surface the error.
   */
  async function goTo(target: ReviewShellPhase) {
    if (busy) return;
    setBusy(true);
    const ok = await persist({ current_phase: target });
    if (ok) setPhase(target);
    setBusy(false);
  }

  /** Next handler that respects the active phase's gate. */
  async function handleNext() {
    if (!forward) return;
    if (gateBlocks) return; // guarded by disabled button too
    if (busy) return;
    // On the opening advance, persist the retrospective ALONGSIDE the phase.
    // Blur-commit alone is not enough: keyboard/fast activation of "Start
    // review →" can advance before a blur fires, and the completion route reads
    // `opening_retrospective` from the session row — so we must save the text
    // here or the closed-loop snapshot would capture a stale/empty value.
    if (phase === "snapshot_open") {
      setBusy(true);
      const ok = await persist({
        current_phase: forward,
        opening_retrospective: snapshot.opening_retrospective,
      });
      if (ok) setPhase(forward);
      setBusy(false);
      return;
    }
    await goTo(forward);
  }

  /**
   * Complete the review: POST the completion route with the closing fields,
   * then navigate to Engage. Blocks (and reveals inline validation) if either
   * closing field is empty.
   */
  async function handleComplete() {
    if (busy) return;
    const intention = snapshot.closing_intention.trim();
    const blocker = snapshot.closing_blocker.trim();
    if (intention.length === 0 || blocker.length === 0) {
      setShowClosingErrors(true);
      return;
    }
    // Enforce the AC completion gate: block finishing while the inbox is
    // non-empty or an active project is unresolved (e.g. items re-injected
    // during Get Creative). Surface the specific reason.
    if (completionBlocked) {
      setError(completionBlockReason);
      return;
    }
    setError("");
    setBusy(true);
    try {
      const res = await fetch(`/api/review/${sessionId}/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ intention, blocker }),
      });
      if (!res.ok) {
        const payload = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        setError(payload?.error || GENERIC_ERROR);
        setBusy(false);
        return;
      }
      router.push("/app/engage");
    } catch {
      setError(GENERIC_ERROR);
      setBusy(false);
    }
  }

  function renderPanel() {
    if (phase === "snapshot_open") {
      return (
        <SnapshotOpenPanel
          weekNumber={weekNumber}
          weekStartDate={weekStartDate}
          weekEndDate={weekEndDate}
          priorSnapshot={priorSnapshot}
          value={snapshot.opening_retrospective}
          onChange={(value) =>
            setSnapshot((s) => ({ ...s, opening_retrospective: value }))
          }
          onCommit={() => commitField("opening_retrospective")}
          disabled={busy}
        />
      );
    }
    if (phase === "snapshot_close") {
      return (
        <SnapshotClosePanel
          intention={snapshot.closing_intention}
          blocker={snapshot.closing_blocker}
          onIntentionChange={(value) =>
            setSnapshot((s) => ({ ...s, closing_intention: value }))
          }
          onBlockerChange={(value) =>
            setSnapshot((s) => ({ ...s, closing_blocker: value }))
          }
          onCommit={commitClosing}
          onComplete={handleComplete}
          busy={busy}
          showErrors={showClosingErrors}
        />
      );
    }
    if (phase === "get_clear") {
      return (
        <GetClearPanel
          unprocessedCount={reviewData.unprocessedCount}
          onRefresh={refresh}
        />
      );
    }
    if (phase === "get_current") {
      return (
        <GetCurrentPanel
          projects={reviewData.currentProjects}
          reviewedIds={reviewedProjectIds}
          onReviewed={markReviewed}
          onRefresh={refresh}
        />
      );
    }
    // get_creative
    return (
      <GetCreativePanel
        somedayItems={reviewData.somedayItems}
        somedayProjects={reviewData.somedayProjects}
        goalAlignment={reviewData.goalAlignment}
        focusAreas={reviewData.focusAreas}
        focusAreasError={reviewData.focusAreasError}
        onRefresh={refresh}
      />
    );
  }

  const isClosing = phase === "snapshot_close";

  return (
    <div className="flex flex-col gap-[var(--spacing-section-y)]">
      <PhaseBar current={phase} />

      {/* Polite live region: text derived from `phase`, re-rendered on change. */}
      <p aria-live="polite" className="sr-only">
        {positionLabel}
      </p>

      {renderPanel()}

      {error && (
        <div
          role="alert"
          aria-live="assertive"
          className="rounded-[var(--radius-sm)] bg-destructive-subtle px-3 py-2 text-[length:var(--font-size-small)] text-destructive"
        >
          {error}
        </div>
      )}

      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => back && goTo(back)}
          disabled={busy || back === null}
          className="inline-flex min-h-[44px] items-center rounded-[var(--radius-sm)] border border-border-strong px-4 py-2 font-medium text-text-primary transition-colors hover:bg-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)] disabled:cursor-not-allowed disabled:opacity-60"
        >
          Back
        </button>
        {isClosing ? (
          // The closing beat completes the review instead of navigating on. The
          // panel renders its own "Complete review" action; this Next is hidden
          // so there is no phantom forward control on the final beat.
          <span aria-hidden="true" />
        ) : (
          <button
            type="button"
            onClick={handleNext}
            disabled={busy || forward === null || gateBlocks}
            className="inline-flex min-h-[44px] items-center rounded-[var(--radius-sm)] bg-primary px-4 py-2 font-medium text-text-inverse transition-colors hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {phase === "snapshot_open" ? "Start review →" : "Next"}
          </button>
        )}
      </div>

      {gateBlocks && (
        <p className="text-[length:var(--font-size-small)] text-text-muted">
          {openingGateBlocks &&
            "Add a short retrospective to start the review."}
          {getClearGateBlocks &&
            "Process every inbox item to reach inbox zero before continuing."}
          {getCurrentGateBlocks &&
            "Give each stuck project a committed action or change its status before continuing."}
        </p>
      )}
    </div>
  );
}
