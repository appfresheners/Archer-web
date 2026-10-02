"use client";

/**
 * AttachProjectControl — the goal detail "attach an existing project" control.
 *
 * Lists the signed-in user's projects that are not already linked to this goal
 * and attaches the chosen project through the authenticated
 * `PATCH /api/projects/[id]` route (which owns the goal-ownership check).
 *
 * Attaching a goal-less project happens immediately. Attaching a project that
 * is already linked to a *different* goal opens a confirmation dialog — moving
 * a project from another goal requires confirmation. Cancelling the dialog
 * performs no write and leaves the project's prior relationship unchanged.
 *
 * On success it calls `router.refresh()` so the server page re-renders from
 * the database (the single source of truth).
 */

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

export interface AttachableProject {
  id: string;
  name: string;
  goal_id: string | null;
}

const GENERIC_ERROR = "Something went wrong. Please try again.";

export default function AttachProjectControl({
  goalId,
  projects,
}: {
  goalId: string;
  projects: AttachableProject[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [pending, setPending] = useState<AttachableProject | null>(null);

  const dialogRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (pending) dialogRef.current?.focus();
  }, [pending]);

  // Only projects not already linked to this goal are attachable.
  const eligible = projects.filter((p) => p.goal_id !== goalId);

  async function attach(project: AttachableProject) {
    setError("");
    setBusy(true);
    try {
      const res = await fetch(`/api/projects/${project.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ goal_id: goalId }),
      });
      const payload = (await res.json().catch(() => null)) as {
        error?: string;
      } | null;
      if (!res.ok) {
        setError(payload?.error || GENERIC_ERROR);
        setBusy(false);
        setSelectedId("");
        return;
      }
      setBusy(false);
      setSelectedId("");
      router.refresh();
    } catch {
      setError(GENERIC_ERROR);
      setBusy(false);
      setSelectedId("");
    }
  }

  function handleSelect(value: string) {
    if (value === "" || busy) return;
    const project = projects.find((p) => p.id === value);
    if (!project) return;
    if (project.goal_id && project.goal_id !== goalId) {
      setPending(project);
      return;
    }
    void attach(project);
  }

  function handleConfirm() {
    if (!pending || busy) return;
    const project = pending;
    setPending(null);
    void attach(project);
  }

  function handleCancel() {
    setPending(null);
    setSelectedId("");
  }

  const selectClass =
    "min-h-[44px] rounded-[var(--radius-sm)] border border-border-strong bg-surface-raised px-3 py-2 text-[length:var(--font-size-small)] text-text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)] disabled:cursor-not-allowed disabled:opacity-60";
  const btnPrimary =
    "inline-flex min-h-[44px] items-center rounded-[var(--radius-sm)] bg-primary px-4 py-2 font-medium text-text-inverse transition-colors hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)] disabled:cursor-not-allowed disabled:opacity-60";
  const btnSecondary =
    "inline-flex min-h-[44px] items-center rounded-[var(--radius-sm)] border border-border-strong px-4 py-2 font-medium text-text-primary transition-colors hover:bg-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)] disabled:cursor-not-allowed disabled:opacity-60";

  return (
    <div className="flex flex-col gap-2">
      <label className="flex flex-col gap-1 text-[length:var(--font-size-small)] font-medium text-text-secondary">
        Attach existing project
        <select
          aria-label="Attach existing project"
          value={selectedId}
          disabled={busy || eligible.length === 0}
          onChange={(e) => {
            setSelectedId(e.target.value);
            handleSelect(e.target.value);
          }}
          className={selectClass}
        >
          <option value="">
            {eligible.length === 0 ? "No projects available" : "Choose a project…"}
          </option>
          {eligible.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </label>

      {error && (
        <div
          role="alert"
          aria-live="assertive"
          className="rounded-[var(--radius-sm)] bg-destructive-subtle px-3 py-2 text-[length:var(--font-size-small)] text-destructive"
        >
          {error}
        </div>
      )}

      {pending && (
        <div
          ref={dialogRef}
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="attach-move-title"
          aria-describedby="attach-move-desc"
          tabIndex={-1}
          onKeyDown={(e) => {
            if (e.key === "Escape" && !busy) handleCancel();
          }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 focus:outline-none"
        >
          <div className="flex w-full max-w-md flex-col gap-4 rounded-[var(--radius-lg)] bg-surface-raised p-6 shadow-lg">
            <h2
              id="attach-move-title"
              className="text-[length:var(--font-size-subheading)] font-semibold text-text-primary"
            >
              Move this project?
            </h2>
            <p id="attach-move-desc" className="text-text-secondary">
              &ldquo;{pending.name}&rdquo; is already linked to a different goal.
              Attaching it here moves it to this goal.
            </p>
            <div className="flex flex-wrap justify-end gap-3">
              <button
                type="button"
                className={btnSecondary}
                onClick={handleCancel}
                disabled={busy}
              >
                Cancel
              </button>
              <button
                type="button"
                className={btnPrimary}
                onClick={handleConfirm}
                disabled={busy}
              >
                {busy ? "Moving…" : "Move project"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
