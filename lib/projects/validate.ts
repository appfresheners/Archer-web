/**
 * Server-side validation for project edits (Story 4.3).
 *
 * Pure functions, reused by `PATCH /api/projects/[id]`. `sanitizeProjectPatch`
 * accepts an untrusted body and returns a bounded `ProjectUpdate` containing
 * only the editable fields that were present and valid — or `null` when the
 * body is not a usable patch.
 */

import type { ProjectStatus, ProjectUpdate } from "@/lib/supabase/schema";

const PROJECT_STATUSES: readonly ProjectStatus[] = [
  "active",
  "paused",
  "completed",
  "archived",
];

export const MAX_PROJECT_NAME = 200;

/** Shared cap for free-text project fields (`purpose`, `successful_outcome`). */
export const MAX_PROJECT_TEXT = 2000;

export function isProjectStatus(value: unknown): value is ProjectStatus {
  return (
    typeof value === "string" && (PROJECT_STATUSES as string[]).includes(value)
  );
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_RE.test(value);
}

/**
 * Build a bounded `ProjectUpdate` from an untrusted body. Only editable fields
 * are considered; each present field must be valid or the whole patch is
 * rejected (null). Returns null for an empty patch.
 */
export function sanitizeProjectPatch(body: unknown): ProjectUpdate | null {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return null;
  }
  const obj = body as Record<string, unknown>;
  const patch: ProjectUpdate = {};

  if ("name" in obj) {
    const n = obj.name;
    if (typeof n !== "string") return null;
    const trimmed = n.trim();
    if (trimmed.length < 1 || trimmed.length > MAX_PROJECT_NAME) return null;
    patch.name = trimmed;
  }

  if ("purpose" in obj) {
    const v = obj.purpose;
    if (v === null) {
      patch.purpose = null;
    } else if (typeof v === "string") {
      const trimmed = v.trim();
      if (trimmed.length > MAX_PROJECT_TEXT) return null;
      patch.purpose = trimmed;
    } else {
      return null;
    }
  }

  if ("successful_outcome" in obj) {
    const v = obj.successful_outcome;
    if (v === null) {
      patch.successful_outcome = null;
    } else if (typeof v === "string") {
      const trimmed = v.trim();
      if (trimmed.length > MAX_PROJECT_TEXT) return null;
      patch.successful_outcome = trimmed;
    } else {
      return null;
    }
  }

  if ("status" in obj) {
    if (!isProjectStatus(obj.status)) return null;
    patch.status = obj.status;
  }

  // goal_id — link this project to a goal (uuid) or clear the link (null).
  // Enables goal↔project linking from the clarify flow (Story 5.2). A present
  // but non-uuid, non-null value rejects the whole patch.
  if ("goal_id" in obj) {
    const v = obj.goal_id;
    if (v === null) patch.goal_id = null;
    else if (isUuid(v)) patch.goal_id = v;
    else return null;
  }

  if ("area_id" in obj) {
    const value = obj.area_id;
    if (value === null) patch.area_id = null;
    else if (isUuid(value)) patch.area_id = value;
    else return null;
  }

  if (patch.goal_id && patch.area_id) return null;
  if (patch.goal_id) patch.area_id = null;

  if (Object.keys(patch).length === 0) return null;
  return patch;
}
