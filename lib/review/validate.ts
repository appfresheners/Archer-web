/**
 * Server-side validation for the review PATCH (Story 5.4). Pure + unit-testable,
 * reused by `PATCH /api/review/[id]`. Mirrors `lib/inbox/process.ts`.
 *
 * For the shell, the only patchable field is `current_phase`, and only the five
 * navigable beats are accepted — the terminal `'complete'` phase is written by
 * the completion step (Story 5.6), not by a plain navigation PATCH. The
 * validator is deliberately kept open so Story 5.5 can extend it to also accept
 * the snapshot fields (`opening_retrospective` / `closing_intention` /
 * `closing_blocker`) without changing the route's shape.
 */

import { isReviewShellPhase } from "@/lib/review/phases";
import type { ReviewSessionUpdate } from "@/lib/supabase/schema";

/**
 * Build a bounded `ReviewSessionUpdate` from an untrusted body. Currently this
 * is just a valid `current_phase` (one of the five beats). Returns `null` when
 * the body is not an object or carries no valid patchable field.
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

  // No valid field to update → not a usable patch.
  if (Object.keys(patch).length === 0) return null;

  return patch;
}
