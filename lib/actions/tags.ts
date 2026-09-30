/**
 * Context-tag rules for actions (Story 4.4) — the single source of truth for
 * the `@key:value` context tags stored in `actions.context_tags` (a Postgres
 * text[]). Keys are limited to the GTD contexts in scope for v1.
 *
 * Pure functions so they are trivially unit-testable and reusable by the
 * action mutation routes and the tag editor UI.
 */

/** Fixed energy choices; GTD leaves the exact energy taxonomy to the user. */
export const ENERGY_OPTIONS = [
  { value: "high", label: "High focus" },
  { value: "medium", label: "Medium focus" },
  { value: "low", label: "Low focus" },
] as const;

/** Common GTD location contexts. */
export const LOCATION_OPTIONS = [
  { value: "home", label: "Home" },
  { value: "home-office", label: "Home office" },
  { value: "office", label: "Office" },
  { value: "mall", label: "Mall / shopping" },
  { value: "grocery-store", label: "Grocery store" },
  { value: "errands", label: "Errands" },
  { value: "outdoors", label: "Outdoors" },
  { value: "anywhere", label: "Anywhere" },
] as const;

/** Only GTD location and energy dimensions are offered as tags. */
export const CONTEXT_TAG_KEYS = ["location", "energy"] as const;
export type ContextTagKey = (typeof CONTEXT_TAG_KEYS)[number];

/** Max length of a single tag string (defensive cap). */
const MAX_TAG_LENGTH = 60;

/**
 * A valid new context tag must use one of the fixed location or energy values.
 */
export function isValidContextTag(tag: unknown): tag is string {
  if (typeof tag !== "string") return false;
  if (tag.length > MAX_TAG_LENGTH) return false;
  const match = /^@([a-z]+):(.+)$/.exec(tag);
  if (!match) return false;
  const [, key, value] = match;
  if (key === "energy") {
    return ENERGY_OPTIONS.some((option) => option.value === value.toLowerCase());
  }
  if (key === "location") {
    return LOCATION_OPTIONS.some((option) => option.value === value.toLowerCase());
  }
  return false;
}

/**
 * Normalize + validate an untrusted context-tag list. Lowercases the key,
 * trims the value, drops empties, dedupes, and returns the cleaned array — or
 * `null` if any entry is malformed or an unknown key. An empty array in →
 * empty array out (untagged is valid).
 */
export function sanitizeContextTags(
  value: unknown,
  legacyTags: readonly string[] = [],
): string[] | null {
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
    if (val === "") return null;
    const normalized = `@${key}:${val}`;
    const fixedTag = `@${key}:${val.toLowerCase()}`;
    if (!isValidContextTag(fixedTag) && !legacyTags.includes(normalized)) {
      return null;
    }
    const acceptedTag = isValidContextTag(fixedTag) ? fixedTag : normalized;
    if (acceptedTag.length > MAX_TAG_LENGTH) return null;
    if (!seen.has(acceptedTag)) {
      seen.add(acceptedTag);
      out.push(acceptedTag);
    }
  }
  return out;
}
