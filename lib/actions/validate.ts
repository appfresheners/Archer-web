/**
 * Server-side validation for action edits (Story 4.4). Pure + unit-testable,
 * reused by the action mutation routes.
 */

import type { ActionStatus, ActionUpdate } from "@/lib/supabase/schema";
import { sanitizeContextTags } from "./tags";

export const MAX_ACTION_TEXT = 500;

const ACTION_STATUSES: readonly ActionStatus[] = [
  "available",
  "committed",
  "done",
];

export function isActionStatus(value: unknown): value is ActionStatus {
  return (
    typeof value === "string" && (ACTION_STATUSES as string[]).includes(value)
  );
}

/** Validate/trim action text; returns the trimmed string or null if invalid. */
export function sanitizeActionText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (trimmed.length < 1 || trimmed.length > MAX_ACTION_TEXT) return null;
  return trimmed;
}

/**
 * Build a bounded `ActionUpdate` from an untrusted body for the per-action
 * PATCH. Handles `text`, `context_tags`, and a completion toggle via `status`.
 *
 * IMPORTANT: `status` here is restricted to `available` / `done` — a plain
 * completion toggle. Setting `committed` is NOT allowed through this generic
 * patch; committing a single next action is Story 4.5's dedicated path (which
 * relies on the `fn_commit_action` DB trigger to decommit siblings). Returns
 * null for an invalid or empty patch.
 */
export function sanitizeActionPatch(body: unknown): ActionUpdate | null {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return null;
  }
  const obj = body as Record<string, unknown>;
  const patch: ActionUpdate = {};

  if ("text" in obj) {
    const text = sanitizeActionText(obj.text);
    if (text === null) return null;
    patch.text = text;
  }

  if ("context_tags" in obj) {
    const tags = sanitizeContextTags(obj.context_tags);
    if (tags === null) return null;
    patch.context_tags = tags;
  }

  if ("status" in obj) {
    // Only completion toggling is permitted here — never `committed`.
    if (obj.status !== "available" && obj.status !== "done") return null;
    patch.status = obj.status;
  }

  if (Object.keys(patch).length === 0) return null;
  return patch;
}
