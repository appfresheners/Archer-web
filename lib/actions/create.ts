/**
 * Server-side validation for creating an action (Story 5.2 — Clarify Wizard).
 *
 * Pure + unit-testable, reused by `POST /api/actions`. Composes
 * `sanitizeActionText` with the clarify outcomes:
 *
 *   - standalone next action  → project_id null, status 'available'
 *   - delegate (waiting)      → status 'waiting', delegated_to required
 *   - defer to calendar       → scheduled_for date
 *   - assigned to a project   → project_id uuid (trusted to RLS as owned)
 *
 * Returns a bounded `ActionInsert`-shaped patch (minus user_id, which the
 * route supplies) or `null` when the body is not a usable create instruction.
 */

import type { ActionStatus } from "@/lib/supabase/schema";
import { sanitizeActionText } from "./validate";

/** Statuses an action may be CREATED with via clarify. */
const CREATE_STATUSES = ["available", "waiting"] as const;
export type CreateActionStatus = (typeof CREATE_STATUSES)[number];

/** The bounded, validated fields the route inserts (user_id added by route). */
export interface SanitizedActionCreate {
  text: string;
  project_id: string | null;
  status: CreateActionStatus;
  delegated_to: string | null;
  scheduled_for: string | null;
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_RE.test(value);
}

function isCreateStatus(value: unknown): value is CreateActionStatus {
  return (
    typeof value === "string" &&
    (CREATE_STATUSES as readonly string[]).includes(value)
  );
}

/**
 * Accepts a calendar date. Valid = an ISO `YYYY-MM-DD` string that names a
 * real calendar date (round-trips through Date without drift). Postgres stores
 * a `date`, so a bare day is the canonical form.
 */
export function isCalendarDate(value: unknown): value is string {
  if (typeof value !== "string") return false;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return (
    dt.getUTCFullYear() === y &&
    dt.getUTCMonth() === m - 1 &&
    dt.getUTCDate() === d
  );
}

/**
 * Build a bounded action-create from an untrusted body.
 *
 * Rules:
 *   - `text`: required, 1..500 (via sanitizeActionText).
 *   - `project_id`: optional; a valid uuid or explicit null. Absent → null
 *     (standalone by default).
 *   - `status`: optional; 'available' | 'waiting'. Absent → 'available'.
 *   - `delegated_to`: required non-empty when status is 'waiting'; must be
 *     absent/empty otherwise-tolerated (ignored → null) when not waiting.
 *   - `scheduled_for`: optional; a valid calendar date or explicit null.
 */
export function sanitizeActionCreate(
  body: unknown,
): SanitizedActionCreate | null {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return null;
  }
  const obj = body as Record<string, unknown>;

  const text = sanitizeActionText(obj.text);
  if (text === null) return null;

  // project_id: uuid | null (absent → standalone).
  let project_id: string | null = null;
  if ("project_id" in obj && obj.project_id !== undefined) {
    const v = obj.project_id;
    if (v === null) project_id = null;
    else if (isUuid(v)) project_id = v;
    else return null;
  }

  // status: available | waiting (absent → available).
  let status: CreateActionStatus = "available";
  if ("status" in obj && obj.status !== undefined) {
    if (!isCreateStatus(obj.status)) return null;
    status = obj.status;
  }

  // delegated_to: required non-empty iff waiting.
  let delegated_to: string | null = null;
  if ("delegated_to" in obj && obj.delegated_to !== null && obj.delegated_to !== undefined) {
    if (typeof obj.delegated_to !== "string") return null;
    const trimmed = obj.delegated_to.trim();
    delegated_to = trimmed.length > 0 ? trimmed : null;
  }
  if (status === "waiting" && !delegated_to) return null;
  if (status !== "waiting") delegated_to = null; // only meaningful when waiting

  // scheduled_for: valid calendar date | null.
  let scheduled_for: string | null = null;
  if ("scheduled_for" in obj && obj.scheduled_for !== undefined) {
    const v = obj.scheduled_for;
    if (v === null) scheduled_for = null;
    else if (isCalendarDate(v)) scheduled_for = v;
    else return null;
  }

  return { text, project_id, status, delegated_to, scheduled_for };
}

// Re-export the status enum for the route's insert typing.
export type { ActionStatus };
