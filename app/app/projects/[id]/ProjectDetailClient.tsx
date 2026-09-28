"use client";

/**
 * ProjectDetailClient — the interactive header for the project detail view.
 *
 * Owns three interactions, backed by `/api/projects/[id]`:
 *   1. Status change — `ProjectStatusSelect` PATCHes `{ status }`.
 *   2. Edit — a view/edit toggle over name/purpose/successful_outcome; Save
 *      PATCHes the fields.
 *   3. Regenerate — a confirmation modal; on confirm, POSTs to
 *      `/regenerate`, which replaces only this project's AI content + actions.
 *
 * On any success it calls `router.refresh()` so the server page re-renders from
 * the database. Regeneration can take up to ~30s, so the confirm button shows a
 * "Regenerating…" busy state and the modal stays open until it resolves.
 */

import ProjectStatusSelect from "@/components/projects/ProjectStatusSelect";
import type { ProjectStatus } from "@/lib/supabase/schema";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

export interface ProjectHeaderData {
  id: string;
  name: string;
  purpose: string | null;
  successful_outcome: string | null;
  status: ProjectStatus;
}

const GENERIC_ERROR = "Something went wrong. Please try again.";
const TIMEOUT_ERROR =
  "Regeneration took longer than 30 seconds and timed out. Please try again.";

export default function ProjectDetailClient({
  project,
}: {
  project: ProjectHeaderData;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [confirmingRegen, setConfirmingRegen] = useState(false);

  const [name, setName] = useState(project.name);
  const [purpose, setPurpose] = useState(project.purpose ?? "");
  const [outcome, setOutcome] = useState(project.successful_outcome ?? "");

  const dialogRef = useRef<HTMLDivElement>(null);
  const regenTriggerRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (confirmingRegen) dialogRef.current?.focus();
    else regenTriggerRef.current?.focus();
  }, [confirmingRegen]);

  async function handleStatusChange(status: ProjectStatus) {
    if (status === project.status || busy) return;
    setError("");
    setBusy(true);
    try {
      const res = await fetch(`/api/projects/${project.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) {
        const payload = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        setError(payload?.error || GENERIC_ERROR);
        setBusy(false);
        return;
      }
      setBusy(false);
      router.refresh();
    } catch {
      setError(GENERIC_ERROR);
      setBusy(false);
    }
  }

  async function handleSave() {
    if (busy) return;
    setError("");
    setBusy(true);
    try {
      const res = await fetch(`/api/projects/${project.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          purpose: purpose.trim() === "" ? null : purpose,
          successful_outcome: outcome.trim() === "" ? null : outcome,
        }),
      });
      if (!res.ok) {
        const payload = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        setError(payload?.error || GENERIC_ERROR);
        setBusy(false);
        return;
      }
      setBusy(false);
      setEditing(false);
      router.refresh();
    } catch {
      setError(GENERIC_ERROR);
      setBusy(false);
    }
  }

  function handleCancel() {
    setName(project.name);
    setPurpose(project.purpose ?? "");
    setOutcome(project.successful_outcome ?? "");
    setError("");
    setEditing(false);
  }

  async function handleRegenerate() {
    if (busy) return;
    setError("");
    setBusy(true);
    try {
      const res = await fetch(`/api/projects/${project.id}/regenerate`, {
        method: "POST",
      });
      if (!res.ok) {
        const payload = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        setError(
          payload?.error || (res.status === 504 ? TIMEOUT_ERROR : GENERIC_ERROR),
        );
        setBusy(false);
        return;
      }
      setConfirmingRegen(false);
      setBusy(false);
      router.refresh();
    } catch {
      setError(GENERIC_ERROR);
      setBusy(false);
    }
  }

  const fieldClass =
    "min-h-[44px] rounded-[var(--radius-sm)] border border-border-strong bg-surface-raised px-3 py-2 text-text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)]";
  const btnPrimary =
    "inline-flex min-h-[44px] items-center rounded-[var(--radius-sm)] bg-primary px-4 py-2 font-medium text-text-inverse transition-colors hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)] disabled:cursor-not-allowed disabled:opacity-60";
  const btnSecondary =
    "inline-flex min-h-[44px] items-center rounded-[var(--radius-sm)] border border-border-strong px-4 py-2 font-medium text-text-primary transition-colors hover:bg-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)] disabled:cursor-not-allowed disabled:opacity-60";

  return (
    <div className="flex flex-col gap-4">
      {editing ? (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <label htmlFor="project-name" className="font-medium text-text-primary">
              Project name
            </label>
            <input
              id="project-name"
              value={name}
              maxLength={200}
              onChange={(e) => setName(e.target.value)}
              className={fieldClass}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="project-purpose" className="font-medium text-text-primary">
              Purpose
            </label>
            <textarea
              id="project-purpose"
              value={purpose}
              rows={3}
              onChange={(e) => setPurpose(e.target.value)}
              className={fieldClass}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="project-outcome" className="font-medium text-text-primary">
              Successful outcome
            </label>
            <textarea
              id="project-outcome"
              value={outcome}
              rows={3}
              onChange={(e) => setOutcome(e.target.value)}
              className={fieldClass}
            />
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" className={btnPrimary} onClick={handleSave} disabled={busy}>
              {busy ? "Saving…" : "Save changes"}
            </button>
            <button type="button" className={btnSecondary} onClick={handleCancel} disabled={busy}>
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-[length:var(--font-size-small)] text-text-secondary">
            Status
            <ProjectStatusSelect
              value={project.status}
              onChange={handleStatusChange}
              disabled={busy}
            />
          </label>
          <button type="button" className={btnSecondary} onClick={() => setEditing(true)} disabled={busy}>
            Edit project
          </button>
          <button
            ref={regenTriggerRef}
            type="button"
            className={btnSecondary}
            onClick={() => setConfirmingRegen(true)}
            disabled={busy}
          >
            Regenerate project
          </button>
        </div>
      )}

      {error && (
        <div
          role="alert"
          aria-live="assertive"
          className="rounded-[var(--radius-sm)] bg-destructive-subtle px-3 py-2 text-[length:var(--font-size-small)] text-destructive"
        >
          {error}
        </div>
      )}

      {confirmingRegen && (
        <div
          ref={dialogRef}
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="regen-title"
          aria-describedby="regen-desc"
          tabIndex={-1}
          onKeyDown={(e) => {
            if (e.key === "Escape" && !busy) setConfirmingRegen(false);
          }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 focus:outline-none"
        >
          <div className="flex w-full max-w-md flex-col gap-4 rounded-[var(--radius-lg)] bg-surface-raised p-6 shadow-lg">
            <h2
              id="regen-title"
              className="text-[length:var(--font-size-subheading)] font-semibold text-text-primary"
            >
              Regenerate this project?
            </h2>
            <p id="regen-desc" className="text-text-secondary">
              This replaces this project&apos;s purpose, successful outcome, and
              action list with a fresh AI breakdown. Your other projects are not
              affected. This can take up to 30 seconds.
            </p>
            <div className="flex flex-wrap justify-end gap-3">
              <button
                type="button"
                className={btnSecondary}
                onClick={() => setConfirmingRegen(false)}
                disabled={busy}
              >
                Cancel
              </button>
              <button type="button" className={btnPrimary} onClick={handleRegenerate} disabled={busy}>
                {busy ? "Regenerating…" : "Regenerate"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
