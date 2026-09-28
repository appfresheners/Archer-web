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

export function isProjectStatus(value: unknown): value is ProjectStatus {
  return (
    typeof value === "string" && (PROJECT_STATUSES as string[]).includes(value)
  );
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
    if (v === null) patch.purpose = null;
    else if (typeof v === "string") patch.purpose = v.trim();
    else return null;
  }

  if ("successful_outcome" in obj) {
    const v = obj.successful_outcome;
    if (v === null) patch.successful_outcome = null;
    else if (typeof v === "string") patch.successful_outcome = v.trim();
    else return null;
  }

  if ("status" in obj) {
    if (!isProjectStatus(obj.status)) return null;
    patch.status = obj.status;
  }

  if (Object.keys(patch).length === 0) return null;
  return patch;
}
