/**
 * Server-side validation for inbox processing (Story 5.2 — Clarify Wizard;
 * extended in Story 5.6 with the reactivation path).
 *
 * Pure + unit-testable, reused by `PATCH /api/inbox/[id]`. The clarify flow
 * ends an item in exactly one terminal state; this sanitizer takes an
 * untrusted body and returns the bounded fields to persist, or `null` when the
 * body is not a usable process instruction.
 *
 * Two distinct transitions are supported:
 *   1. Clarify (5.2): move an UNPROCESSED item INTO a terminal state
 *      (`processed`/`trashed`/`someday`/`reference`), optionally linking a
 *      `resolved_project_id` when `processed`. The route stamps `processed_at`.
 *   2. Reactivate (5.6): move a someday/reference item BACK to `unprocessed`
 *      so it re-enters the inbox. This clears `processed_at` and
 *      `resolved_project_id`. `resolved_project_id` is NOT accepted on this
 *      path (a reactivated item carries no resolution).
 */

import type { InboxItemUpdate, InboxProcessingStatus } from "@/lib/supabase/schema";

/** Terminal statuses a clarify decision can set. */
const PROCESSED_STATUSES: readonly InboxProcessingStatus[] = [
  "processed",
  "trashed",
  "someday",
  "reference",
];

export type ProcessedStatus =
  | "processed"
  | "trashed"
  | "someday"
  | "reference";

export function isProcessedStatus(value: unknown): value is ProcessedStatus {
  return (
    typeof value === "string" &&
    (PROCESSED_STATUSES as string[]).includes(value)
  );
}

/** Canonical v4-ish UUID shape check (mirrors what Postgres/RLS will accept). */
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_RE.test(value);
}

/**
 * Build a bounded `InboxItemUpdate` from an untrusted body for the process
 * PATCH: a required terminal `status` and an optional `resolved_project_id`
 * (a valid uuid, or explicit null to clear). Returns null when the status is
 * missing/invalid or when a present `resolved_project_id` is neither null nor
 * a valid uuid.
 *
 * `processed_at` is intentionally NOT set here — this function is pure so it
 * can be unit-tested deterministically. The route stamps `processed_at=now()`
 * on the sanitized patch before persisting.
 */
export function sanitizeInboxProcess(body: unknown): InboxItemUpdate | null {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return null;
  }
  const obj = body as Record<string, unknown>;

  // Reactivation path (5.6): someday/reference → unprocessed. This clears the
  // resolution stamped by a prior clarify decision so the item is a clean
  // inbox item again. `resolved_project_id` is not accepted here.
  if (obj.status === "unprocessed") {
    if ("resolved_project_id" in obj && obj.resolved_project_id != null) {
      return null;
    }
    return {
      processing_status: "unprocessed",
      processed_at: null,
      resolved_project_id: null,
    };
  }

  if (!isProcessedStatus(obj.status)) return null;

  const patch: InboxItemUpdate = {
    processing_status: obj.status,
  };

  if ("resolved_project_id" in obj) {
    const v = obj.resolved_project_id;
    if (v === null) patch.resolved_project_id = null;
    else if (isUuid(v)) {
      // Linking to a project is only meaningful when the item is actionable
      // and resolved (`processed`). A trashed/someday/reference item must not
      // carry a resolved_project_id.
      if (obj.status !== "processed") return null;
      patch.resolved_project_id = v;
    } else return null;
  }

  return patch;
}
