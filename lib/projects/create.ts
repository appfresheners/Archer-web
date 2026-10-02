/**
 * Server-side validation for manual project creation (Story 2.7).
 *
 * Pure functions, reused by `POST /api/projects`. `validateManualProject`
 * accepts an untrusted body and returns a bounded `ManualProjectInput`
 * containing the required `name` and the optional `purpose`,
 * `successful_outcome`, and `goal_id` — or `null` when the body is not a
 * usable create payload. It follows the conventions of
 * `lib/projects/validate.ts`: only known fields are considered, and a present
 * but invalid optional field rejects the whole payload.
 */

import { MAX_PROJECT_NAME, MAX_PROJECT_TEXT } from "./validate";

/** The validated, typed result of a manual project create request. */
export interface ManualProjectInput {
  name: string;
  purpose: string | null;
  successful_outcome: string | null;
  goal_id: string | null;
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Sentinel distinguishing "invalid type" from a legitimate `null` result. */
const INVALID = Symbol("invalid");

/**
 * Optional free text: absent/null → null, blank/whitespace → null, otherwise
 * the trimmed string. Any non-string or over-long (`MAX_PROJECT_TEXT`) value
 * is invalid.
 */
function optionalText(value: unknown): string | null | typeof INVALID {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string") return INVALID;
  const trimmed = value.trim();
  if (trimmed === "") return null;
  if (trimmed.length > MAX_PROJECT_TEXT) return INVALID;
  return trimmed;
}

/**
 * Optional parent goal: absent/null → null, a UUID string → the id, anything
 * else (including a malformed string) is invalid.
 */
function optionalGoalId(value: unknown): string | null | typeof INVALID {
  if (value === undefined || value === null) return null;
  if (typeof value === "string" && UUID_RE.test(value)) return value;
  return INVALID;
}

/**
 * Build a bounded `ManualProjectInput` from an untrusted body. `name` is the
 * only required field (bounded to `MAX_PROJECT_NAME`, mirroring a project
 * edit); the rest are optional. Returns null for a missing/invalid name, a
 * non-object body, or any present-but-invalid optional field.
 */
export function validateManualProject(
  body: unknown,
): ManualProjectInput | null {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return null;
  }
  const obj = body as Record<string, unknown>;

  if (typeof obj.name !== "string") return null;
  const name = obj.name.trim();
  if (name.length < 1 || name.length > MAX_PROJECT_NAME) return null;

  const purpose = optionalText(obj.purpose);
  if (purpose === INVALID) return null;

  const successful_outcome = optionalText(obj.successful_outcome);
  if (successful_outcome === INVALID) return null;

  const goal_id = optionalGoalId(obj.goal_id);
  if (goal_id === INVALID) return null;

  return { name, purpose, successful_outcome, goal_id };
}
