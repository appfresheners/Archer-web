/**
 * Server-side validation for the review PATCH (Story 5.4, extended in 5.5).
 * Pure + unit-testable, reused by `PATCH /api/review/[id]`. Mirrors
 * `lib/inbox/process.ts`.
 *
 * The shell patches `current_phase` (one of the five navigable beats — the
 * terminal `'complete'` phase is written by the completion route, not a plain
 * navigation PATCH) and, since Story 5.5, the three snapshot text fields
 * (`opening_retrospective` / `closing_intention` / `closing_blocker`).
 *
 * Persistence vs. gates (see spec Design Notes): the snapshot fields accept the
 * EMPTY string here so in-progress typing/blur can save partial input and a
 * resumed review restores it. The NON-EMPTY requirement is enforced by the UI
 * gates (opening advance, closing complete) and re-checked server-side by
 * `sanitizeReviewComplete` — the persistence validator does not gate on it.
 */

import { isReviewShellPhase } from "@/lib/review/phases";
import type { ReviewSessionUpdate } from "@/lib/supabase/schema";

/** Upper bound on a persisted snapshot text field. */
export const SNAPSHOT_FIELD_MAX_LENGTH = 2000;

/** The snapshot text fields the PATCH may persist, in schema order. */
const SNAPSHOT_TEXT_FIELDS = [
  "opening_retrospective",
  "closing_intention",
  "closing_blocker",
] as const;

/**
 * Build a bounded `ReviewSessionUpdate` from an untrusted body. Accepts a valid
 * `current_phase` beat and/or any of the three snapshot text fields (each a
 * string ≤ 2000 chars; empty allowed for in-progress persistence). Returns
 * `null` when the body is not an object, carries no valid patchable field, or
 * any present field is the wrong type / too long.
 */
export function sanitizeReviewPatch(body: unknown): ReviewSessionUpdate | null {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return null;
  }
  const obj = body as Record<string, unknown>;

  const patch: ReviewSessionUpdate = {};

  if ("current_phase" in obj) {
    if (!isReviewShellPhase(obj.current_phase)) return null;
    patch.current_phase = obj.current_phase;
  }

  for (const field of SNAPSHOT_TEXT_FIELDS) {
    if (field in obj) {
      const value = obj[field];
      // A present snapshot field must be a string within bounds. Empty is
      // allowed (in-progress save); the gates enforce non-empty elsewhere.
      if (typeof value !== "string" || value.length > SNAPSHOT_FIELD_MAX_LENGTH) {
        return null;
      }
      patch[field] = value;
    }
  }

  // No valid field to update → not a usable patch.
  if (Object.keys(patch).length === 0) return null;

  return patch;
}
