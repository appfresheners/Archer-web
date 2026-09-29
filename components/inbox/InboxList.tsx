"use client";

/**
 * InboxList — the captured-items list on the Inbox page (Story 5.1).
 *
 * Renders each item's raw text, a formatted capture timestamp, and Process +
 * Delete controls. An unprocessed item captured strictly more than 7 days ago
 * shows the amber "Unprocessed for 7+ days" flag (same warning tokens as
 * `StuckIndicator`). Delete calls `DELETE /api/inbox/[id]` then
 * `router.refresh()`; failures surface as an inline `role="alert"` error.
 *
 * "Process" is a placeholder affordance for Story 5.2 (the clarify/processing
 * flow) — it navigates toward the item but carries no processing logic here.
 * Empty state reads "Inbox zero." with no celebration.
 */

import { isUnprocessedOverdue } from "@/lib/inbox/overdue";
import type { InboxItem } from "@/lib/supabase/schema";
import { useRouter } from "next/navigation";
import { useState } from "react";

const GENERIC_ERROR = "Something went wrong. Please try again.";
export const OVERDUE_FLAG_LABEL = "Unprocessed for 7+ days";

export type InboxListItem = Pick<
  InboxItem,
  "id" | "raw_text" | "processing_status" | "captured_at"
>;

/**
 * Format an ISO timestamp as a short date + time. Guards an unparseable /
 * `Invalid Date` value by falling back to the raw string rather than rendering
 * "Invalid Date".
 */
function formatCapturedAt(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function InboxList({ items }: { items: InboxListItem[] }) {
  const router = useRouter();
  // Capture "now" once at mount — the 7-day flag is presentational, so a stable
  // reference avoids re-computing (and the impure call) on every render.
  const [now] = useState(() => Date.now());
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function handleDelete(id: string) {
    if (busyId) return;
    setError("");
    setBusyId(id);
    try {
      const res = await fetch(`/api/inbox/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const payload = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        setError(payload?.error || GENERIC_ERROR);
        setBusyId(null);
        return;
      }
      setBusyId(null);
      router.refresh();
    } catch {
      setError(GENERIC_ERROR);
      setBusyId(null);
    }
  }

  if (items.length === 0) {
    return <p className="text-text-secondary">Inbox zero.</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      {error && (
        <div
          role="alert"
          aria-live="assertive"
          className="rounded-[var(--radius-sm)] bg-destructive-subtle px-3 py-2 text-[length:var(--font-size-small)] text-destructive"
        >
          {error}
        </div>
      )}

      <ul className="flex flex-col gap-2">
        {items.map((item) => {
          const overdue = isUnprocessedOverdue(item, now);
          return (
            <li
              key={item.id}
              className="flex flex-col gap-2 rounded-[var(--radius-md)] border border-border bg-surface-raised p-[var(--spacing-card-p)]"
            >
              <p className="break-words text-[length:var(--font-size-card)] text-text-primary">
                {item.raw_text}
              </p>

              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[length:var(--font-size-small)] text-text-secondary">
                <span>{formatCapturedAt(item.captured_at)}</span>
                {overdue && (
                  <span className="inline-flex items-center rounded-[var(--radius-xs)] border border-[var(--color-warning)] bg-warning-subtle px-2 py-0.5 font-medium text-warning">
                    {OVERDUE_FLAG_LABEL}
                  </span>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {/* Process is a placeholder affordance for Story 5.2. */}
                <button
                  type="button"
                  onClick={() => router.push(`/app/inbox/${item.id}`)}
                  disabled={busyId !== null}
                  className="inline-flex min-h-[44px] items-center rounded-[var(--radius-sm)] border border-border-strong px-4 py-2 font-medium text-text-primary transition-colors hover:bg-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Process
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(item.id)}
                  disabled={busyId !== null}
                  aria-label="Delete inbox item"
                  className="inline-flex min-h-[44px] items-center rounded-[var(--radius-sm)] border border-border-strong px-4 py-2 font-medium text-destructive transition-colors hover:bg-destructive-subtle focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Delete
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
