/**
 * Server-side validation for the review COMPLETE POST (Story 5.5). Pure +
 * unit-testable, reused by `POST /api/review/[id]/complete`. Mirrors the shape
 * of `lib/review/validate.ts`.
 *
 * Completion writes an immutable `weekly_snapshots` row, whose `intention` and
 * `blocker` are NOT NULL in the schema. Unlike the PATCH persistence validator
 * (which accepts empty strings for in-progress saves), this validator is a GATE:
 * it re-checks — server-side, never trusting the client — that both closing
 * fields are present, string, and non-empty after trimming. The trimmed values
 * are returned so the row stores the cleaned text.
 */

import { SNAPSHOT_FIELD_MAX_LENGTH } from "@/lib/review/validate";

export interface SanitizedReviewComplete {
  intention: string;
  blocker: string;
}

/**
 * Validate a completion body. Requires `intention` and `blocker` to each be a
 * non-empty (after trim) string within the snapshot field bound. Returns the
 * trimmed `{ intention, blocker }` or `null` if either is missing, the wrong
 * type, empty/whitespace, or too long.
 */
export function sanitizeReviewComplete(
  body: unknown,
): SanitizedReviewComplete | null {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return null;
  }
  const obj = body as Record<string, unknown>;

  const intention = cleanRequired(obj.intention);
  const blocker = cleanRequired(obj.blocker);
  if (intention === null || blocker === null) return null;

  return { intention, blocker };
}

/**
 * A required snapshot field: must be a string, non-empty after trimming, and
 * within the shared length bound. Returns the trimmed value or `null`.
 */
function cleanRequired(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (trimmed.length === 0) return null;
  if (trimmed.length > SNAPSHOT_FIELD_MAX_LENGTH) return null;
  return trimmed;
}
