"use client";

/**
 * GetCreativePanel — the "Get Creative" beat of the weekly review (Story 5.6).
 *
 *   - Review each Someday/Maybe item (an `inbox_items` row with
 *     `processing_status = 'someday'`). Two explicit actions: Activate (move
 *     back to `unprocessed` via `PATCH /api/inbox/[id]`) or Delete (`DELETE`).
 *     "Keep" is the implicit default — leaving an item alone needs no control.
 *   - Capture "anything missing?" to the inbox (reuses `InboxCaptureForm`).
 *   - A read-only goal-alignment summary across ACTIVE goals (project + stuck
 *     counts).
 *
 * Get Creative has no forward gate of its own — the hard gate is the closing
 * snapshot (Story 5.5). Mutations call `onRefresh` so the server reloads the
 * someday list.
 */

import InboxCaptureForm from "@/components/inbox/InboxCaptureForm";
import StatusBadge from "@/components/goals/StatusBadge";
import type {
  ReviewAreaRollup,
  ReviewGoalAlignment,
  ReviewSomedayItem,
} from "@/lib/review/reviewData";
import Link from "next/link";
import { useState } from "react";

const GENERIC_ERROR = "Something went wrong. Please try again.";

interface GetCreativePanelProps {
  somedayItems: ReviewSomedayItem[];
  goalAlignment: ReviewGoalAlignment[];
  focusAreas: ReviewAreaRollup[];
  focusAreasError: boolean;
  /** Re-read the server data after a mutation. */
  onRefresh: () => void;
}

export default function GetCreativePanel({
  somedayItems,
  goalAlignment,
  focusAreas,
  focusAreasError,
  onRefresh,
}: GetCreativePanelProps) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function call(url: string, method: string, body?: unknown): Promise<boolean> {
    setError("");
    try {
      const res = await fetch(url, {
        method,
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      if (!res.ok) {
        const payload = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        setError(payload?.error || GENERIC_ERROR);
        return false;
      }
      return true;
    } catch {
      setError(GENERIC_ERROR);
      return false;
    }
  }

  async function activate(id: string) {
    if (busyId) return;
    setBusyId(id);
    const ok = await call(`/api/inbox/${id}`, "PATCH", { status: "unprocessed" });
    setBusyId(null);
    if (ok) onRefresh();
  }

  async function remove(id: string) {
    if (busyId) return;
    setBusyId(id);
    const ok = await call(`/api/inbox/${id}`, "DELETE");
    setBusyId(null);
    if (ok) onRefresh();
  }

  return (
    <div className="flex flex-col gap-4 rounded-[var(--radius-md)] border border-border bg-surface p-[var(--spacing-card-p)]">
      <header className="flex flex-col gap-1">
        <h2 className="text-[length:var(--font-size-card)] font-semibold text-text-primary">
          Get Creative
        </h2>
        <p className="text-text-secondary">
          Revisit your Someday/Maybe list, capture anything new, and check your
          goals still line up.
        </p>
      </header>

      {error && (
        <div
          role="alert"
          aria-live="assertive"
          className="rounded-[var(--radius-sm)] bg-destructive-subtle px-3 py-2 text-[length:var(--font-size-small)] text-destructive"
        >
          {error}
        </div>
      )}

      <section className="flex flex-col gap-2">
        <h3 className="font-medium text-text-primary">Someday / Maybe</h3>
        {somedayItems.length === 0 ? (
          <p className="text-text-secondary" role="status">
            Nothing on the someday list.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {somedayItems.map((item) => {
              const disabled = busyId !== null;
              return (
                <li
                  key={item.id}
                  className="flex flex-col gap-2 rounded-[var(--radius-sm)] border border-border bg-surface-raised p-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <span className="break-words text-text-primary">{item.raw_text}</span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => activate(item.id)}
                      disabled={disabled}
                      className="inline-flex min-h-[44px] items-center rounded-[var(--radius-sm)] border border-border-strong px-3 py-2 text-[length:var(--font-size-small)] font-medium text-text-primary transition-colors hover:bg-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)] disabled:opacity-60"
                    >
                      Activate
                    </button>
                    <button
                      type="button"
                      onClick={() => remove(item.id)}
                      disabled={disabled}
                      aria-label={`Delete someday item: ${item.raw_text}`}
                      className="inline-flex min-h-[44px] items-center rounded-[var(--radius-sm)] border border-border-strong px-3 py-2 text-[length:var(--font-size-small)] font-medium text-destructive transition-colors hover:bg-destructive-subtle focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)] disabled:opacity-60"
                    >
                      Delete
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <h3 className="font-medium text-text-primary">Anything missing?</h3>
        <InboxCaptureForm />
      </section>

      <section className="flex flex-col gap-2">
        <h3 className="font-medium text-text-primary">Goal alignment</h3>
        {goalAlignment.length === 0 ? (
          <p className="text-text-secondary" role="status">
            No active goals.
          </p>
        ) : (
          <ul className="flex flex-col gap-1">
            {goalAlignment.map((goal) => (
              <li
                key={goal.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-[var(--radius-sm)] border border-border bg-surface-raised px-3 py-2"
              >
                <span className="text-text-primary">{goal.goalText}</span>
                <span className="text-[length:var(--font-size-small)] text-text-secondary">
                  {goal.projectCount}{" "}
                  {goal.projectCount === 1 ? "project" : "projects"}
                  {goal.stuckCount > 0 && (
                    <span className="text-warning"> · {goal.stuckCount} stuck</span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="focus-review-heading" className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 id="focus-review-heading" className="font-medium text-text-primary">
            Focus review (optional)
          </h3>
          <Link
            href="/app/focus"
            className="inline-flex min-h-[44px] items-center rounded-[var(--radius-sm)] border border-border-strong px-3 py-2 text-[length:var(--font-size-small)] font-medium text-text-primary transition-colors hover:bg-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)]"
          >
            Review Focus
          </Link>
        </div>
        {focusAreasError ? (
          <p role="alert" className="text-text-secondary">
            Life Areas could not be loaded. Use Review Focus to retry.
          </p>
        ) : focusAreas.length === 0 ? (
          <p className="text-text-secondary" role="status">
            No Areas yet.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {focusAreas.map((area) => (
              <li key={area.id} className="flex flex-col gap-2 py-3">
                <h4 className="flex flex-wrap items-center gap-2 font-medium text-text-primary">
                  {area.name}
                  {area.archived_at && <StatusBadge status="archived" />}
                </h4>
                {area.goals.length === 0 && area.projects.length === 0 ? (
                  <p className="text-[length:var(--font-size-small)] text-text-secondary">
                    No linked Goals or standalone Projects.
                  </p>
                ) : (
                  <ul className="divide-y divide-border">
                    {area.goals.map((goal) => (
                      <li key={`goal-${goal.id}`}>
                        <Link
                          href={`/app/goals/${goal.id}`}
                          className="flex min-h-[44px] items-center justify-between gap-3 py-2 focus-visible:rounded-[var(--radius-sm)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)]"
                        >
                          <span className="min-w-0 break-words text-text-primary">
                            {goal.goalText}
                          </span>
                          <StatusBadge status={goal.status} />
                        </Link>
                      </li>
                    ))}
                    {area.projects.map((project) => (
                      <li key={`project-${project.id}`}>
                        <Link
                          href={`/app/projects/${project.id}`}
                          className="flex min-h-[44px] items-center justify-between gap-3 py-2 focus-visible:rounded-[var(--radius-sm)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)]"
                        >
                          <span className="min-w-0 break-words text-text-primary">
                            {project.name}
                          </span>
                          <StatusBadge status={project.status} />
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
