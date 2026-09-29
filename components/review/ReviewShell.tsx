"use client";

/**
 * ReviewShell — the client-side driver for the weekly review (Story 5.4 shell).
 *
 * Owns the `current_phase` state (seeded from the persisted session) and renders:
 *   - the five-beat `PhaseBar`,
 *   - an `aria-live="polite"` region that announces the current phase name,
 *   - the active phase's placeholder panel (`PHASE_PANELS[phase]`),
 *   - Back / Next controls, and an inline `role="alert"` error.
 *
 * Navigation is no-skip by construction: the shell only ever moves to
 * `nextPhase(current)` or `prevPhase(current)` — it never sets an arbitrary
 * phase — so a forward jump past an unvisited beat is impossible. Each
 * transition persists the new `current_phase` via `PATCH /api/review/[id]`
 * before advancing the local state, so a later resume opens at the saved beat.
 * Back persists too, keeping the resume point exact. The review is NOT timed —
 * there is no timer anywhere.
 *
 * Accessibility note (repo lint: react-hooks): the phase is announced by
 * *rendering* the phase name inside a live region, not by a setState-in-effect.
 * When `phase` state changes the region's text changes on the next render and
 * the assistive tech announces it — no effect required.
 */

import PhaseBar from "@/components/review/PhaseBar";
import { PHASE_PANELS } from "@/components/review/phase-panels";
import {
  nextPhase,
  PHASE_COUNT,
  PHASE_LABELS,
  phaseIndex,
  prevPhase,
  type ReviewShellPhase,
} from "@/lib/review/phases";
import { useState } from "react";

const GENERIC_ERROR = "Something went wrong. Please try again.";

interface ReviewShellProps {
  sessionId: string;
  initialPhase: ReviewShellPhase;
}

export default function ReviewShell({ sessionId, initialPhase }: ReviewShellProps) {
  const [phase, setPhase] = useState<ReviewShellPhase>(initialPhase);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const forward = nextPhase(phase);
  const back = prevPhase(phase);
  const positionLabel = `Phase ${phaseIndex(phase) + 1} of ${PHASE_COUNT}: ${PHASE_LABELS[phase]}`;

  /**
   * Persist `target` as the session's current_phase, then move there locally.
   * Used by both Back and Next so resume fidelity is identical in either
   * direction. On failure we stay on the current phase and surface the error.
   */
  async function goTo(target: ReviewShellPhase) {
    if (busy) return;
    setError("");
    setBusy(true);
    try {
      const res = await fetch(`/api/review/${sessionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ current_phase: target }),
      });
      if (!res.ok) {
        const payload = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        setError(payload?.error || GENERIC_ERROR);
        setBusy(false);
        return;
      }
      // The shell owns the phase locally; the persisted value only matters on a
      // fresh load (resume). We deliberately do NOT `router.refresh()` here —
      // re-seeding the server component with a new `initialPhase` would not
      // update this component's `useState` and only risks a flicker.
      setPhase(target);
      setBusy(false);
    } catch {
      setError(GENERIC_ERROR);
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-[var(--spacing-section-y)]">
      <PhaseBar current={phase} />

      {/* Polite live region: its text is derived from `phase` and re-rendered
          on change, so the new phase is announced without a setState-in-effect. */}
      <p aria-live="polite" className="sr-only">
        {positionLabel}
      </p>

      {PHASE_PANELS[phase]}

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
        <button
          type="button"
          onClick={() => forward && goTo(forward)}
          disabled={busy || forward === null}
          className="inline-flex min-h-[44px] items-center rounded-[var(--radius-sm)] bg-primary px-4 py-2 font-medium text-text-inverse transition-colors hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)] disabled:cursor-not-allowed disabled:opacity-60"
        >
          Next
        </button>
      </div>
    </div>
  );
}
