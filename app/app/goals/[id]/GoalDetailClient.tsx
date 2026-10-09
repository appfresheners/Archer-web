"use client";

/**
 * GoalDetailClient — the interactive header for the goal detail view.
 *
 * Owns three interactions, all backed by `PATCH`/`DELETE /api/goals/[id]`:
 *   1. Status change — a `<select>` that PATCHes `{ status }` immediately.
 *   2. Edit — a view/edit toggle over goal_text, why, target_date, drivers,
 *      barriers, and if_then_plans (one per line); Save PATCHes the changed
 *      fields. Editing never regenerates projects (a separate explicit action,
 *      Story 4.3).
 *   3. Delete — a confirmation dialog; on confirm, DELETE soft-archives the
 *      goal + its projects, then navigates back to the goals list.
 *
 * After any successful mutation the component calls `router.refresh()` so the
 * server page re-renders from the database (the single source of truth) rather
 * than trusting optimistic local state.
 */

import GoalStatusSelect from "@/components/goals/GoalStatusSelect";
import StatusBadge from "@/components/goals/StatusBadge";
import AreaSelect, { type AreaOption } from "@/components/focus/AreaSelect";
import type { GoalStatus, SkillFrameworkItem } from "@/lib/supabase/schema";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { LoadedGoal } from "./page";

const GENERIC_ERROR = "Something went wrong. Please try again.";

function toListText(items: string[] | null): string {
  return (items ?? []).join("\n");
}

function fromListText(text: string): string[] {
  return text
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l !== "");
}

export default function GoalDetailClient({
  goal,
  areas = [],
  assignedArea = null,
}: {
  goal: LoadedGoal;
  areas?: AreaOption[];
  assignedArea?: (AreaOption & { archived: boolean }) | null;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  // Edit form state (seeded from the server-provided goal).
  const [goalText, setGoalText] = useState(goal.goal_text);
  const [areaId, setAreaId] = useState(goal.area_id ?? "");
  const [why, setWhy] = useState(goal.why ?? "");
  const [targetDate, setTargetDate] = useState(goal.target_date);
  const [drivers, setDrivers] = useState(toListText(goal.drivers));
  const [barriers, setBarriers] = useState(toListText(goal.barriers));
  const [ifThens, setIfThens] = useState(toListText(goal.if_then_plans));
  const [framework, setFramework] = useState<SkillFrameworkItem[]>(
    goal.skill_framework ?? [],
  );

  // Delete-dialog focus management: focus the dialog on open and restore focus
  // to the triggering control on close.
  const dialogRef = useRef<HTMLDivElement>(null);
  const deleteTriggerRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (confirmingDelete) {
      dialogRef.current?.focus();
    } else {
      deleteTriggerRef.current?.focus();
    }
  }, [confirmingDelete]);

  function setRating(index: number, rating: number) {
    setFramework((prev) =>
      prev.map((item, i) =>
        i === index ? { ...item, user_rating: rating } : item,
      ),
    );
  }

  async function patch(body: Record<string, unknown>): Promise<boolean> {
    setError("");
    setBusy(true);
    try {
      const res = await fetch(`/api/goals/${goal.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = (await res.json().catch(() => null)) as {
        error?: string;
      } | null;
      if (!res.ok) {
        setError(payload?.error || GENERIC_ERROR);
        setBusy(false);
        return false;
      }
      setBusy(false);
      return true;
    } catch {
      setError(GENERIC_ERROR);
      setBusy(false);
      return false;
    }
  }

  async function handleStatusChange(status: GoalStatus) {
    if (status === goal.status || busy) return;
    const ok = await patch({ status });
    if (ok) router.refresh();
  }

  async function handleSave() {
    if (busy) return;
    if (why.trim() === "") {
      setError("Why is required for every goal.");
      return;
    }
    // A required date: don't send an empty value (it would be rejected). Fall
    // back to the current target date so a cleared field is a no-op, not a 400.
    const body: Record<string, unknown> = {
      area_id: areaId || null,
      goal_text: goalText,
      why,
      target_date: targetDate.trim() === "" ? goal.target_date : targetDate,
      drivers: fromListText(drivers),
      barriers: fromListText(barriers),
      if_then_plans: ifThens.trim() === "" ? null : fromListText(ifThens),
    };
    if (framework.length > 0) {
      body.skill_framework = framework;
    }
    const ok = await patch(body);
    if (ok) {
      setEditing(false);
      router.refresh();
    }
  }

  function handleCancel() {
    setGoalText(goal.goal_text);
    setAreaId(goal.area_id ?? "");
    setWhy(goal.why ?? "");
    setTargetDate(goal.target_date);
    setDrivers(toListText(goal.drivers));
    setBarriers(toListText(goal.barriers));
    setIfThens(toListText(goal.if_then_plans));
    setFramework(goal.skill_framework ?? []);
    setError("");
    setEditing(false);
  }

  async function handleDelete() {
    if (busy) return;
    setError("");
    setBusy(true);
    try {
      const res = await fetch(`/api/goals/${goal.id}`, { method: "DELETE" });
      if (!res.ok) {
        const payload = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        setError(payload?.error || GENERIC_ERROR);
        setBusy(false);
        return;
      }
      router.push("/app/goals");
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
    <header className="flex flex-col gap-4">
      {!editing ? (
        <>
          <div className="flex items-start justify-between gap-4">
            <h1 className="text-[length:var(--font-size-section)] font-bold text-text-primary">
              {goal.goal_text}
            </h1>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-[length:var(--font-size-small)] text-text-secondary">
            <StatusBadge status={goal.status} />
            <span>Target {goal.target_date}</span>
            <span>
              Life Area: {assignedArea ? `${assignedArea.name}${assignedArea.archived ? " (archived)" : ""}` : "None"}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-[length:var(--font-size-small)] text-text-secondary">
              Status
              <GoalStatusSelect
                value={goal.status}
                onChange={handleStatusChange}
                disabled={busy}
              />
            </label>
            <button
              type="button"
              className={btnSecondary}
              onClick={() => setEditing(true)}
              disabled={busy}
            >
              Edit goal
            </button>
            <button
              ref={deleteTriggerRef}
              type="button"
              className="inline-flex min-h-[44px] items-center rounded-[var(--radius-sm)] border border-destructive px-4 py-2 font-medium text-destructive transition-colors hover:bg-destructive/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)] disabled:cursor-not-allowed disabled:opacity-60"
              onClick={() => setConfirmingDelete(true)}
              disabled={busy}
            >
              Delete
            </button>
          </div>
        </>
      ) : (
        <div className="flex flex-col gap-4">
          <AreaSelect
            id="goal-area"
            value={areaId}
            areas={areas}
            currentArchivedArea={assignedArea?.archived ? assignedArea : null}
            disabled={busy}
            onChange={setAreaId}
          />
          <div className="flex flex-col gap-1">
            <label htmlFor="goal-text" className="font-medium text-text-primary">
              Goal statement
            </label>
            <textarea
              id="goal-text"
              value={goalText}
              maxLength={500}
              rows={3}
              onChange={(e) => setGoalText(e.target.value)}
              className={fieldClass}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="goal-why" className="font-medium text-text-primary">
              Why does this goal matter to you?
            </label>
            <textarea
              id="goal-why"
              value={why}
              maxLength={2000}
              rows={4}
              required
              onChange={(e) => setWhy(e.target.value)}
              className={fieldClass}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="goal-target" className="font-medium text-text-primary">
              Target date
            </label>
            <input
              id="goal-target"
              type="date"
              value={targetDate}
              onChange={(e) => setTargetDate(e.target.value)}
              className={`${fieldClass} w-fit`}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="goal-drivers" className="font-medium text-text-primary">
              Drivers <span className="text-text-secondary">(one per line)</span>
            </label>
            <textarea
              id="goal-drivers"
              value={drivers}
              rows={3}
              onChange={(e) => setDrivers(e.target.value)}
              className={fieldClass}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="goal-barriers" className="font-medium text-text-primary">
              Barriers <span className="text-text-secondary">(one per line)</span>
            </label>
            <textarea
              id="goal-barriers"
              value={barriers}
              rows={3}
              onChange={(e) => setBarriers(e.target.value)}
              className={fieldClass}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="goal-ifthen-plans" className="font-medium text-text-primary">
              If–then plans <span className="text-text-secondary">(one per line)</span>
            </label>
            <textarea
              id="goal-ifthen-plans"
              value={ifThens}
              rows={3}
              onChange={(e) => setIfThens(e.target.value)}
              className={fieldClass}
            />
          </div>
          {framework.length > 0 && (
            <fieldset className="flex flex-col gap-3">
              <legend className="font-medium text-text-primary">
                Framework ratings
              </legend>
              {framework.map((item, i) => {
                const ratingId = `rating-${i}`;
                return (
                  <div key={i} className="flex flex-col gap-1">
                    <label
                      htmlFor={ratingId}
                      className="text-[length:var(--font-size-small)] text-text-secondary"
                    >
                      {item.name}{" "}
                      <span>(required {item.required_level})</span>
                    </label>
                    <input
                      id={ratingId}
                      type="number"
                      min={1}
                      max={10}
                      step={1}
                      value={item.user_rating}
                      onChange={(e) =>
                        setRating(i, Number(e.target.value))
                      }
                      className={`${fieldClass} w-24`}
                    />
                  </div>
                );
              })}
            </fieldset>
          )}
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              className={btnPrimary}
              onClick={handleSave}
              disabled={busy}
            >
              {busy ? "Saving…" : "Save changes"}
            </button>
            <button
              type="button"
              className={btnSecondary}
              onClick={handleCancel}
              disabled={busy}
            >
              Cancel
            </button>
          </div>
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

      {confirmingDelete && (
        <div
          ref={dialogRef}
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="delete-title"
          aria-describedby="delete-desc"
          tabIndex={-1}
          onKeyDown={(e) => {
            if (e.key === "Escape" && !busy) setConfirmingDelete(false);
          }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 focus:outline-none"
        >
          <div className="flex w-full max-w-md flex-col gap-4 rounded-[var(--radius-lg)] bg-surface-raised p-6 shadow-lg">
            <h2
              id="delete-title"
              className="text-[length:var(--font-size-subheading)] font-semibold text-text-primary"
            >
              Delete this goal?
            </h2>
            <p id="delete-desc" className="text-text-secondary">
              This archives the goal and its projects. They are kept in your
              store and stay available in exports, but leave your active views.
            </p>
            <div className="flex flex-wrap justify-end gap-3">
              <button
                type="button"
                className={btnSecondary}
                onClick={() => setConfirmingDelete(false)}
                disabled={busy}
              >
                Cancel
              </button>
              <button
                type="button"
                className="inline-flex min-h-[44px] items-center rounded-[var(--radius-sm)] bg-destructive px-4 py-2 font-medium text-text-inverse transition-colors hover:bg-destructive-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)] disabled:cursor-not-allowed disabled:opacity-60"
                onClick={handleDelete}
                disabled={busy}
              >
                {busy ? "Deleting…" : "Delete goal"}
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
