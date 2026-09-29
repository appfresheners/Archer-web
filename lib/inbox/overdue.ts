/**
 * Overdue-capture helpers (Story 5.1). Pure + unit-testable.
 *
 * An inbox item shows the amber "Unprocessed for 7+ days" flag only when it is
 * still `unprocessed` AND was captured strictly MORE than 7 days ago. The
 * boundary is inclusive-exclusive: an item captured exactly 7 days ago is NOT
 * yet flagged — comparison is done in milliseconds so "exactly 7 days" is not
 * mistakenly flagged by day-rounding.
 */

import type { InboxItem } from "@/lib/supabase/schema";

/** Milliseconds in one day. */
const DAY_MS = 24 * 60 * 60 * 1000;

/** The threshold, in days, after which an unprocessed item is flagged. */
export const OVERDUE_DAYS = 7;

/**
 * Whole/fractional days between an ISO timestamp and `now`, in milliseconds
 * precision. Returns `NaN` for an unparseable timestamp so callers can guard.
 */
export function daysSince(iso: string, now: number): number {
  const captured = new Date(iso).getTime();
  if (Number.isNaN(captured)) return NaN;
  return (now - captured) / DAY_MS;
}

/**
 * True when the item is unprocessed AND captured strictly more than 7 days
 * before `now`. An unparseable `captured_at` (NaN) is never flagged.
 */
export function isUnprocessedOverdue(
  item: Pick<InboxItem, "processing_status" | "captured_at">,
  now: number,
): boolean {
  if (item.processing_status !== "unprocessed") return false;
  const days = daysSince(item.captured_at, now);
  if (Number.isNaN(days)) return false;
  return days > OVERDUE_DAYS;
}
