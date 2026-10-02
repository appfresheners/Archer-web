/**
 * Server-side validation for inbox capture (Story 5.1). Pure + unit-testable,
 * reused by the inbox POST route. Mirrors `lib/actions/validate.ts`.
 *
 * Capture stores raw text only — no classification, no project, no tags. The
 * only constraint is a non-empty trimmed string within the length cap.
 */

export const MAX_INBOX_TEXT = 2000;

/**
 * Validate/trim raw inbox text; returns the trimmed string or null if invalid
 * (non-string, empty/whitespace-only, or over the length cap).
 */
export function sanitizeInboxText(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const trimmed = input.trim();
  if (trimmed.length < 1 || trimmed.length > MAX_INBOX_TEXT) return null;
  return trimmed;
}
