/**
 * Context-tag rules for actions (Story 4.4) — the single source of truth for
 * the `@key:value` context tags stored in `actions.context_tags` (a Postgres
 * text[]). Keys are limited to the GTD contexts in scope for v1.
 *
 * Pure functions so they are trivially unit-testable and reusable by the
 * action mutation routes and the tag editor UI.
 */

/** The context-tag keys in scope for v1. */
export const CONTEXT_TAG_KEYS = ["energy", "location", "tool"] as const;
export type ContextTagKey = (typeof CONTEXT_TAG_KEYS)[number];

/** Max length of a single tag string (defensive cap). */
const MAX_TAG_LENGTH = 60;

/**
 * A valid context tag is `@key:value` where key ∈ CONTEXT_TAG_KEYS and value is
 * a non-empty string with no whitespace-only content.
 */
export function isValidContextTag(tag: unknown): tag is string {
  if (typeof tag !== "string") return false;
  if (tag.length > MAX_TAG_LENGTH) return false;
  const match = /^@([a-z]+):(.+)$/.exec(tag);
  if (!match) return false;
  const [, key, value] = match;
  return (
    (CONTEXT_TAG_KEYS as readonly string[]).includes(key) &&
    value.trim().length > 0
  );
}

/**
 * Normalize + validate an untrusted context-tag list. Lowercases the key,
 * trims the value, drops empties, dedupes, and returns the cleaned array — or
 * `null` if any entry is malformed or an unknown key. An empty array in →
 * empty array out (untagged is valid).
 */
export function sanitizeContextTags(value: unknown): string[] | null {
  if (value === null || value === undefined) return [];
  if (!Array.isArray(value)) return null;

  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of value) {
    if (typeof raw !== "string") return null;
    const match = /^@?([A-Za-z]+):(.+)$/.exec(raw.trim());
    if (!match) return null;
    const key = match[1].toLowerCase();
    const val = match[2].trim();
    if (!(CONTEXT_TAG_KEYS as readonly string[]).includes(key)) return null;
    if (val === "") return null;
    const normalized = `@${key}:${val}`;
    if (normalized.length > MAX_TAG_LENGTH) return null;
    if (!seen.has(normalized)) {
      seen.add(normalized);
      out.push(normalized);
    }
  }
  return out;
}
