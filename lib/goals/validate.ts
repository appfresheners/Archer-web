/**
 * Server-side validation for goal edits (Story 4.2).
 *
 * Pure functions so they are trivially unit-testable and reusable by the
 * `/api/goals/[id]` route handler. `sanitizeGoalPatch` accepts an untrusted
 * JSON body and returns a typed, bounded `GoalUpdate` containing only the
 * editable fields that were present and valid — or `null` when the body is not
 * a usable patch. It never lets an unknown/invalid field through.
 */

import type {
  GoalStatus,
  GoalUpdate,
  SkillFrameworkItem,
} from "@/lib/supabase/schema";

const GOAL_STATUSES: readonly GoalStatus[] = [
  "active",
  "paused",
  "not_now",
  "someday",
  "completed",
  "archived",
];

export const MAX_GOAL_TEXT = 500;
export const MAX_IF_THEN = 2000;
const MIN_LEVEL = 1;
const MAX_LEVEL = 10;

export function isGoalStatus(value: unknown): value is GoalStatus {
  return typeof value === "string" && (GOAL_STATUSES as string[]).includes(value);
}

/** A YYYY-MM-DD date string that represents a real calendar date. */
export function isDateString(value: unknown): value is string {
  if (typeof value !== "string") return false;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  if (m < 1 || m > 12 || d < 1 || d > 31) return false;
  const date = new Date(Date.UTC(y, m - 1, d));
  return (
    date.getUTCFullYear() === y &&
    date.getUTCMonth() === m - 1 &&
    date.getUTCDate() === d
  );
}

function isLevel(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= MIN_LEVEL &&
    value <= MAX_LEVEL
  );
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((v) => typeof v === "string");
}

/** Validate a skill_framework array; returns typed items or null if invalid. */
export function sanitizeFramework(value: unknown): SkillFrameworkItem[] | null {
  if (!Array.isArray(value)) return null;
  const items: SkillFrameworkItem[] = [];
  for (const raw of value) {
    if (typeof raw !== "object" || raw === null) return null;
    const obj = raw as Record<string, unknown>;
    if (typeof obj.name !== "string" || obj.name.trim() === "") return null;
    if (!isLevel(obj.required_level)) return null;
    if (!isLevel(obj.user_rating)) return null;
    items.push({
      name: obj.name.trim(),
      required_level: obj.required_level,
      description: typeof obj.description === "string" ? obj.description : "",
      user_rating: obj.user_rating,
    });
  }
  return items;
}

/**
 * Build a bounded `GoalUpdate` from an untrusted body. Only editable fields
 * are considered; each present field must be valid or the whole patch is
 * rejected (returns null). Returns null for an empty patch (nothing to update).
 */
export function sanitizeGoalPatch(body: unknown): GoalUpdate | null {
  if (typeof body !== "object" || body === null) return null;
  const obj = body as Record<string, unknown>;
  const patch: GoalUpdate = {};

  if ("goal_text" in obj) {
    const t = obj.goal_text;
    if (typeof t !== "string") return null;
    const trimmed = t.trim();
    if (trimmed.length < 1 || trimmed.length > MAX_GOAL_TEXT) return null;
    patch.goal_text = trimmed;
  }

  if ("target_date" in obj) {
    if (!isDateString(obj.target_date)) return null;
    patch.target_date = obj.target_date;
  }

  if ("status" in obj) {
    if (!isGoalStatus(obj.status)) return null;
    patch.status = obj.status;
  }

  if ("drivers" in obj) {
    if (!isStringArray(obj.drivers)) return null;
    patch.drivers = obj.drivers.map((d) => d.trim()).filter((d) => d !== "");
  }

  if ("barriers" in obj) {
    if (!isStringArray(obj.barriers)) return null;
    patch.barriers = obj.barriers.map((b) => b.trim()).filter((b) => b !== "");
  }

  if ("if_then_plan" in obj) {
    const v = obj.if_then_plan;
    if (v !== null) {
      if (typeof v !== "string" || v.length > MAX_IF_THEN) return null;
      patch.if_then_plan = v.trim();
    } else {
      patch.if_then_plan = null;
    }
  }

  if ("skill_framework" in obj) {
    const fw = sanitizeFramework(obj.skill_framework);
    if (fw === null) return null;
    patch.skill_framework = fw;
  }

  if (Object.keys(patch).length === 0) return null;
  return patch;
}
