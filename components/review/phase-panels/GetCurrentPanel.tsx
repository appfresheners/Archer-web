"use client";

/**
 * GetCurrentPanel — the "Get Current" beat of the weekly review (Story 5.6).
 *
 * Surfaces each ACTIVE project so the user brings every one current:
 *   - name, its committed action (or the amber stuck band), last-updated date;
 *   - per project: Confirm (keep the committed action — no mutation), commit or
 *     change the action on the project detail page (breadcrumb back here), or
 *     change status to Paused / Completed / Archived (`PATCH /api/projects/[id]`).
 *
 * A project is "reviewed" once the user confirms or changes its
 * status — tracked client-side in the shell via `onReviewed(projectId)`. The
 * shell's advance gate blocks leaving Get Current while any active project is
 * still stuck AND unreviewed. Mutations call `onRefresh` so the server reloads
 * the projects (a committed/status change updates the stuck state).
 *
 */

import StuckIndicator from "@/components/projects/StuckIndicator";
import type { ReviewCurrentProject } from "@/lib/review/reviewData";
import { withFrom } from "@/lib/navigation/from";
import type { ProjectStatus } from "@/lib/supabase/schema";
import Link from "next/link";
import { useState } from "react";

/** Project detail, with a breadcrumb back to the review. */
function projectHref(id: string): string {
  return withFrom(`/app/projects/${id}#actions`, "/app/review");
}

const GENERIC_ERROR = "Something went wrong. Please try again.";

/** Non-active statuses a project can be moved to during Get Current. */
const STATUS_OPTIONS: { value: ProjectStatus; label: string }[] = [
  { value: "paused", label: "Pause" },
  { value: "someday", label: "Someday/Maybe" },
  { value: "completed", label: "Complete" },
  { value: "archived", label: "Archive" },
];

interface GetCurrentPanelProps {
  projects: ReviewCurrentProject[];
  /** Project ids the user has reviewed this session. */
  reviewedIds: ReadonlySet<string>;
  /** Mark a project reviewed (client session state). */
  onReviewed: (projectId: string) => void;
  /** Re-read the server data after a mutation. */
  onRefresh: () => void;
}

/** Format an ISO timestamp as a short date, guarding an unparseable value. */
function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default function GetCurrentPanel({
  projects,
  reviewedIds,
  onReviewed,
  onRefresh,
}: GetCurrentPanelProps) {
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

  async function changeStatus(projectId: string, status: ProjectStatus) {
    if (busyId) return;
    setBusyId(projectId);
    const ok = await call(`/api/projects/${projectId}`, "PATCH", { status });
    setBusyId(null);
    if (ok) {
      onReviewed(projectId);
      onRefresh();
    }
  }

  if (projects.length === 0) {
    return (
      <div className="flex flex-col gap-2 rounded-[var(--radius-md)] border border-border bg-surface p-[var(--spacing-card-p)]">
        <h2 className="text-[length:var(--font-size-card)] font-semibold text-text-primary">
          Get Current
        </h2>
        <p className="text-text-secondary" role="status">
          No active projects to review.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 rounded-[var(--radius-md)] border border-border bg-surface p-[var(--spacing-card-p)]">
      <header className="flex flex-col gap-1">
        <h2 className="text-[length:var(--font-size-card)] font-semibold text-text-primary">
          Get Current
        </h2>
        <p className="text-text-secondary">
          Bring each active project current: confirm its next action, commit a
          new one, or change its status.
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

      <ul className="flex flex-col gap-3">
        {projects.map((project) => {
          const reviewed = reviewedIds.has(project.id);
          // Only the project with an in-flight mutation is disabled — a single
          // busy project must not freeze the whole list.
          const disabled = busyId === project.id;
          return (
            <li
              key={project.id}
              className="flex flex-col gap-3 rounded-[var(--radius-md)] border border-border bg-surface-raised p-[var(--spacing-card-p)]"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-medium text-text-primary">{project.name}</span>
                <span className="text-[length:var(--font-size-small)] text-text-secondary">
                  Updated {formatDate(project.updatedAt)}
                  {reviewed && " · reviewed"}
                </span>
              </div>

              {project.isStuck ? (
                <StuckIndicator commitHref={projectHref(project.id)} />
              ) : (
                <p className="text-text-primary">
                  <span className="text-text-secondary">Committed: </span>
                  {project.committedActionText}
                </p>
              )}

              <div className="flex flex-col gap-2">
                {!project.isStuck && (
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => onReviewed(project.id)}
                      disabled={disabled || reviewed}
                      aria-pressed={reviewed}
                      aria-label={
                        reviewed
                          ? `Next action confirmed for ${project.name}`
                          : `Confirm the next action for ${project.name}`
                      }
                      className="inline-flex min-h-[44px] w-fit items-center rounded-[var(--radius-sm)] bg-primary px-4 py-2 font-medium text-text-inverse transition-colors hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {reviewed ? "✓ Confirmed" : "Confirm next action"}
                    </button>
                    <Link
                      href={projectHref(project.id)}
                      className="inline-flex min-h-[44px] items-center rounded-[var(--radius-sm)] border border-border-strong px-3 py-2 text-[length:var(--font-size-small)] font-medium text-text-primary transition-colors hover:bg-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)]"
                    >
                      Change next action
                    </Link>
                  </div>
                )}

                {/* Change status (Pause / Complete / Archive). */}
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[length:var(--font-size-small)] text-text-secondary">
                    Or set aside:
                  </span>
                  {STATUS_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => changeStatus(project.id, opt.value)}
                      disabled={disabled}
                      aria-label={`${opt.label} ${project.name}`}
                      className="inline-flex min-h-[44px] items-center rounded-[var(--radius-sm)] border border-border-strong px-3 py-2 text-[length:var(--font-size-small)] font-medium text-text-primary transition-colors hover:bg-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)] disabled:opacity-60"
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
