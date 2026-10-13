"use client";

/**
 * ActionList — the interactive action manager for a project (Story 4.4).
 *
 * Renders an ordered list of `ActionItem`s plus an inline "add" field. All
 * mutations go through the authenticated action routes:
 *   - add:      POST   /api/projects/[id]/actions
 *   - reorder:  PATCH  /api/projects/[id]/actions   { orderedIds }
 *   - edit/tag: PATCH  /api/actions/[id]            { text? , context_tags? }
 *   - done:     PATCH  /api/actions/[id]            (available <-> done)
 *   - delete:   DELETE /api/actions/[id]
 *
 * After each successful mutation the component calls `router.refresh()` so the
 * server page re-renders from the database (the source of truth). Reorder is
 * optimistic locally, then persisted with the full ordered id list.
 *
 * Note: committing a single next action (status `committed`) is Story 4.5; this
 * component only toggles available<->done and styles the committed state.
 */

import ActionItem, { type ActionItemData } from "@/components/projects/ActionItem";
import { useRouter } from "next/navigation";
import { useState } from "react";

const GENERIC_ERROR = "Something went wrong. Please try again.";
type ActionStatusFilter = "all" | "active" | "done";

export default function ActionList({
  projectId,
  actions,
}: {
  projectId: string;
  actions: ActionItemData[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [newText, setNewText] = useState("");
  const [statusFilter, setStatusFilter] = useState<ActionStatusFilter>("all");
  const visibleActions = actions
    .map((action, index) => ({ action, index }))
    .filter(({ action }) =>
      statusFilter === "all"
        ? true
        : statusFilter === "active"
          ? action.status !== "done"
          : action.status === "done",
    );

  async function call(
    url: string,
    method: string,
    body?: unknown,
  ): Promise<boolean> {
    setError("");
    setBusy(true);
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

  async function refreshOn(ok: boolean) {
    if (ok) router.refresh();
  }

  async function handleAdd() {
    const text = newText.trim();
    if (text === "" || busy) return;
    const ok = await call(`/api/projects/${projectId}/actions`, "POST", { text });
    if (ok) {
      setNewText("");
      router.refresh();
    }
  }

  async function handleToggleDone(action: ActionItemData) {
    const nextStatus = action.status === "done" ? "available" : "done";
    const ok = await call(`/api/actions/${action.id}`, "PATCH", {
      status: nextStatus,
    });
    if (!ok) return;
    router.refresh();
  }

  /** Commit an available action (POST to the dedicated commit route). */
  async function handleCommit(action: ActionItemData) {
    await refreshOn(await call(`/api/actions/${action.id}/commit`, "POST"));
  }

  async function handleSaveText(action: ActionItemData, text: string) {
    await refreshOn(await call(`/api/actions/${action.id}`, "PATCH", { text }));
  }

  async function handleSaveTags(action: ActionItemData, tags: string[]) {
    await refreshOn(
      await call(`/api/actions/${action.id}`, "PATCH", { context_tags: tags }),
    );
  }

  async function handleSaveTimeAvailable(
    action: ActionItemData,
    minutes: number,
  ) {
    await refreshOn(
      await call(`/api/actions/${action.id}`, "PATCH", {
        time_available_minutes: minutes,
      }),
    );
  }

  async function handleDelete(action: ActionItemData) {
    await refreshOn(await call(`/api/actions/${action.id}`, "DELETE"));
  }

  async function handleMove(action: ActionItemData, direction: "up" | "down") {
    const index = actions.findIndex((a) => a.id === action.id);
    const swapWith = direction === "up" ? index - 1 : index + 1;
    if (index === -1 || swapWith < 0 || swapWith >= actions.length) return;
    const orderedIds = actions.map((a) => a.id);
    [orderedIds[index], orderedIds[swapWith]] = [
      orderedIds[swapWith],
      orderedIds[index],
    ];
    await refreshOn(
      await call(`/api/projects/${projectId}/actions`, "PATCH", { orderedIds }),
    );
  }

  return (
    <section id="actions" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-[length:var(--font-size-subheading)] font-semibold text-text-primary">
          Next Actions
        </h2>
        {actions.length > 0 && (
          <label className="flex items-center gap-2 text-[length:var(--font-size-small)] text-text-secondary">
            Action status
            <select
              aria-label="Filter actions by status"
              value={statusFilter}
              onChange={(event) =>
                setStatusFilter(event.target.value as ActionStatusFilter)
              }
              className="min-h-[44px] rounded-[var(--radius-sm)] border border-border-strong bg-surface-raised px-3 text-text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)]"
            >
              <option value="all">All actions</option>
              <option value="active">Active actions</option>
              <option value="done">Completed actions</option>
            </select>
          </label>
        )}
      </div>

      {actions.length === 0 ? (
        <p className="text-text-secondary">No actions yet. Add one below.</p>
      ) : visibleActions.length === 0 ? (
        <p className="text-text-secondary" role="status">
          No actions match this status.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {visibleActions.map(({ action, index }) => (
            <ActionItem
              key={`${action.id}-${action.time_available_minutes}`}
              action={action}
              disabled={busy}
              isFirst={index === 0}
              isLast={index === actions.length - 1}
              onToggleDone={handleToggleDone}
              onSaveText={handleSaveText}
              onSaveTags={handleSaveTags}
              onSaveTimeAvailable={handleSaveTimeAvailable}
              onDelete={handleDelete}
              onMove={handleMove}
              onCommit={handleCommit}
            />
          ))}
        </ul>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <label htmlFor="new-action" className="sr-only">
          New action
        </label>
        <input
          id="new-action"
          value={newText}
          maxLength={500}
          disabled={busy}
          placeholder="Add a next action"
          onChange={(e) => setNewText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void handleAdd();
            }
          }}
          className="min-h-[44px] flex-1 rounded-[var(--radius-sm)] border border-border-strong bg-surface-raised px-3 py-2 text-text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)] disabled:opacity-60"
        />
        <button
          type="button"
          onClick={handleAdd}
          disabled={busy || newText.trim() === ""}
          className="inline-flex min-h-[44px] items-center rounded-[var(--radius-sm)] bg-primary px-4 py-2 font-medium text-text-inverse transition-colors hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)] disabled:cursor-not-allowed disabled:opacity-60"
        >
          Add
        </button>
      </div>

      {error && (
        <div
          role="alert"
          aria-live="assertive"
          className="rounded-[var(--radius-sm)] bg-destructive-subtle px-3 py-2 text-[length:var(--font-size-small)] text-destructive"
        >
          {error}
        </div>
      )}
    </section>
  );
}
