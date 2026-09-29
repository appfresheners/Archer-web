/**
 * Pure phase-list helpers for the weekly review shell (Story 5.4).
 *
 * The review is a five-beat sequence with the two snapshot beats as bookends:
 *   snapshot_open → get_clear → get_current → get_creative → snapshot_close
 *
 * `ReviewPhase` (from the schema) also includes `'complete'`, which is the
 * terminal state written when the review finishes (Story 5.6) — it is NOT one
 * of the five navigable beats, so it is excluded from `REVIEW_PHASES`.
 *
 * Navigation is forward/back only through this ordered list: `nextPhase` /
 * `prevPhase` return the neighbour or `null` at the ends. Because the shell can
 * only ever move to a neighbour, skipping forward is impossible by
 * construction (see the spec's "No-skip via next/prev only" design note).
 */

import type { ReviewPhase } from "@/lib/supabase/schema";

/** The five navigable beats, in order. */
export const REVIEW_PHASES = [
  "snapshot_open",
  "get_clear",
  "get_current",
  "get_creative",
  "snapshot_close",
] as const;

/** A phase the shell can sit on (the five beats — not `'complete'`). */
export type ReviewShellPhase = (typeof REVIEW_PHASES)[number];

/** Human-facing label per beat, shown in the phase bar and announcements. */
export const PHASE_LABELS: Record<ReviewShellPhase, string> = {
  snapshot_open: "Snapshot open",
  get_clear: "Get Clear",
  get_current: "Get Current",
  get_creative: "Get Creative",
  snapshot_close: "Snapshot close",
};

/** Total number of beats (5) — handy for "Phase N of TOTAL" labels. */
export const PHASE_COUNT = REVIEW_PHASES.length;

/** Type guard: is `value` one of the five navigable beats? */
export function isReviewShellPhase(value: unknown): value is ReviewShellPhase {
  return (
    typeof value === "string" &&
    (REVIEW_PHASES as readonly string[]).includes(value)
  );
}

/**
 * 0-based index of a phase in the ordered list, or `-1` if it is not one of the
 * five beats (e.g. `'complete'`).
 */
export function phaseIndex(phase: ReviewPhase): number {
  return (REVIEW_PHASES as readonly string[]).indexOf(phase);
}

/**
 * The next beat after `phase`, or `null` if `phase` is the last beat
 * (`snapshot_close`) or not a beat at all.
 */
export function nextPhase(phase: ReviewPhase): ReviewShellPhase | null {
  const i = phaseIndex(phase);
  if (i < 0 || i >= REVIEW_PHASES.length - 1) return null;
  return REVIEW_PHASES[i + 1];
}

/**
 * The previous beat before `phase`, or `null` if `phase` is the first beat
 * (`snapshot_open`) or not a beat at all.
 */
export function prevPhase(phase: ReviewPhase): ReviewShellPhase | null {
  const i = phaseIndex(phase);
  if (i <= 0) return null;
  return REVIEW_PHASES[i - 1];
}

/**
 * Whether a phase is a bookend (the opening or closing snapshot beat). Bookends
 * render narrower in the phase bar.
 */
export function isBookend(phase: ReviewPhase): boolean {
  return phase === "snapshot_open" || phase === "snapshot_close";
}
