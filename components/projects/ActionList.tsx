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
import { useEffect, useRef, useState } from "react";

const GENERIC_ERROR = "Something went wrong. Please try again.";

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
  // After completing a committed action, prompt for the next committed action
  // (Story 4.5). Holds the still-available actions to choose from, or an empty
  // array to signal "no actions remain — offer to complete the project".
  const [nextPrompt, setNextPrompt] = useState<ActionItemData[] | null>(null);
  const promptRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (nextPrompt !== null) promptRef.current?.focus();
  }, [nextPrompt]);

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
    const wasCommitted = action.status === "committed";
    const ok = await call(`/api/actions/${action.id}`, "PATCH", {
      status: nextStatus,
    });
    if (!ok) return;

    // Completing the committed action → prompt for the next committed action
    // from the remaining still-available actions (Story 4.5).
    if (wasCommitted && nextStatus === "done") {
      const remaining = actions.filter(
        (a) => a.id !== action.id && a.status === "available",
      );
      setNextPrompt(remaining);
      // Do not refresh yet — the prompt is driven by current props; a refresh
      // happens after the user commits the next action or dismisses.
      return;
    }
    router.refresh();
  }

  /** Commit an available action (POST to the dedicated commit route). */
  async function handleCommit(action: ActionItemData) {
    await refreshOn(await call(`/api/actions/${action.id}/commit`, "POST"));
  }

  /** Choose the next committed action from the completion prompt. */
  async function handleCommitNext(action: ActionItemData) {
    const ok = await call(`/api/actions/${action.id}/commit`, "POST");
    if (ok) {
      setNextPrompt(null);
      router.refresh();
    }
  }

  /** From the prompt when no actions remain: mark the project complete. */
  async function handleCompleteProject() {
    const ok = await call(`/api/projects/${projectId}`, "PATCH", {
      status: "completed",
    });
    if (ok) {
      setNextPrompt(null);
      router.refresh();
    }
  }

  function dismissPrompt() {
    setNextPrompt(null);
    router.refresh();
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
    <section className="flex flex-col gap-3">
      <h2 className="text-[length:var(--font-size-subheading)] font-semibold text-text-primary">
        Next Actions
      </h2>

      {actions.length === 0 ? (
        <p className="text-text-secondary">No actions yet. Add one below.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {actions.map((action, i) => (
            <ActionItem
              key={`${action.id}-${action.time_available_minutes}`}
              action={action}
              disabled={busy}
              isFirst={i === 0}
              isLast={i === actions.length - 1}
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

      {nextPrompt !== null && (
        <div
          ref={promptRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="next-action-title"
          tabIndex={-1}
          onKeyDown={(e) => {
            if (e.key === "Escape" && !busy) dismissPrompt();
          }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 focus:outline-none"
        >
          <div className="flex w-full max-w-md flex-col gap-4 rounded-[var(--radius-lg)] bg-surface-raised p-6 shadow-lg">
            <h3
              id="next-action-title"
              className="text-[length:var(--font-size-subheading)] font-semibold text-text-primary"
            >
              What&apos;s next for this project?
            </h3>
            {nextPrompt.length > 0 ? (
              <>
                <p className="text-text-secondary">
                  Commit the next action to work on.
                </p>
                <ul className="flex flex-col gap-2">
                  {nextPrompt.map((a) => (
                    <li key={a.id}>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => handleCommitNext(a)}
                        className="w-full rounded-[var(--radius-sm)] border border-border-strong px-3 py-2 text-left text-text-primary hover:border-primary hover:bg-primary-subtle focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)] disabled:opacity-60"
                      >
                        {a.text}
                      </button>
                    </li>
                  ))}
                </ul>
                <div className="flex justify-end">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={dismissPrompt}
                    className="inline-flex min-h-[44px] items-center rounded-[var(--radius-sm)] border border-border-strong px-4 py-2 font-medium text-text-primary hover:bg-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)] disabled:opacity-60"
                  >
                    Not now
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className="text-text-secondary">
                  No actions remain. Mark this project complete?
                </p>
                <div className="flex flex-wrap justify-end gap-3">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={dismissPrompt}
                    className="inline-flex min-h-[44px] items-center rounded-[var(--radius-sm)] border border-border-strong px-4 py-2 font-medium text-text-primary hover:bg-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)] disabled:opacity-60"
                  >
                    Not now
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={handleCompleteProject}
                    className="inline-flex min-h-[44px] items-center rounded-[var(--radius-sm)] bg-primary px-4 py-2 font-medium text-text-inverse hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)] disabled:opacity-60"
                  >
                    Mark project complete
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
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
