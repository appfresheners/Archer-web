"use client";

/**
 * EngageBoard — the interactive Engage surface (Story 5.3).
 *
 * Renders the committed next actions grouped by goal (collapsible), a per-goal
 * amber stuck band at the bottom of each group, a final "Anytime / No project"
 * group for standalone committed actions, composable context/energy/time filters,
 * and the honest empty state. It owns the Done → "What's next for [project]?"
 * flow, adapted from `components/projects/ActionList.tsx`:
 *
 *   - Done on a PROJECT row: PATCH status=done, then open a prompt listing that
 *     project's remaining `available` actions (carried in the model). Committing
 *     one POSTs `/api/actions/[id]/commit`; if none remain, offer
 *     "mark project complete?" (PATCH `/api/projects/[id]` status=completed).
 *   - Done on a STANDALONE row (no project): PATCH status=done, then refresh.
 *     No prompt — there is no project to prompt for.
 *
 * All reads are done server-side; every mutation calls `router.refresh()` so the
 * board re-renders from the database. Errors render inline as `role="alert"`.
 *
 * Filters are client-side over the already-loaded rows and can be combined.
 */

import EngageActionRow from "@/components/engage/EngageActionRow";
import StuckIndicator from "@/components/projects/StuckIndicator";
import type {
  EngageAvailableAction,
  EngageModel,
  EngageRow,
} from "@/lib/engage/model";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

const GENERIC_ERROR = "Something went wrong. Please try again.";
const TIME_FILTERS = [5, 10, 15, 25, 30, 45, 60, 90, 120];

/** State for the open "What's next for [project]?" prompt. */
interface NextPromptState {
  projectId: string;
  projectName: string;
  available: EngageAvailableAction[];
}

export default function EngageBoard({ model }: { model: EngageModel }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [activeContext, setActiveContext] = useState("");
  const [activeEnergy, setActiveEnergy] = useState("");
  const [maxAvailableMinutes, setMaxAvailableMinutes] = useState("");
  const [nextPrompt, setNextPrompt] = useState<NextPromptState | null>(null);
  const promptRef = useRef<HTMLDivElement>(null);

  // Focus the prompt when it opens (mirrors ActionList). Effect only calls
  // .focus() — no state writes — so it satisfies react-hooks/set-state-in-effect.
  useEffect(() => {
    if (nextPrompt !== null) promptRef.current?.focus();
  }, [nextPrompt]);

  const committedRows = useMemo(() => [
    ...model.goalGroups.flatMap((group) => group.committed),
    ...model.projectGroups.flatMap((group) => group.committed),
    ...model.anytime,
  ], [model]);

  const allContexts = useMemo(() => {
    const contexts = new Set<string>();
    for (const row of committedRows) {
      for (const tag of row.context_tags) contexts.add(tag);
    }
    return [...contexts].sort();
  }, [committedRows]);

  const allEnergies = useMemo(() => {
    const energies = new Set<string>();
    for (const row of committedRows) {
      if (row.energy) energies.add(row.energy);
    }
    return [...energies].sort();
  }, [committedRows]);

  if (activeContext !== "" && !allContexts.includes(activeContext)) {
    setActiveContext("");
  }
  if (activeEnergy !== "" && !allEnergies.includes(activeEnergy)) {
    setActiveEnergy("");
  }

  function rowMatchesFilter(row: EngageRow): boolean {
    if (activeContext !== "" && !row.context_tags.includes(activeContext)) {
      return false;
    }
    if (activeEnergy !== "" && row.energy !== activeEnergy) return false;
    if (
      maxAvailableMinutes !== "" &&
      row.time_available_minutes > Number(maxAvailableMinutes)
    ) {
      return false;
    }
    return true;
  }

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

  /** Mark a committed row done, then branch on project vs standalone. */
  async function handleDone(row: EngageRow) {
    if (busy) return;
    const ok = await call(`/api/actions/${row.id}`, "PATCH", {
      status: "done",
    });
    if (!ok) return;

    // Standalone (no project) → nothing to prompt; just refresh.
    if (row.projectId === null) {
      router.refresh();
      return;
    }

    // Project row → open the "What's next for [project]?" prompt with that
    // project's remaining available actions from the model.
    const group = model.goalGroups.find((g) =>
      g.committed.some((r) => r.id === row.id),
    );
    const projectGroup = model.projectGroups.find((g) =>
      g.committed.some((r) => r.id === row.id),
    );
    const available = row.projectId
      ? group?.availableByProject[row.projectId] ?? projectGroup?.available ?? []
      : [];
    setNextPrompt({
      projectId: row.projectId,
      projectName: row.projectName ?? "this project",
      available,
    });
    // Do not refresh yet — the prompt is driven by the current model; refresh
    // happens after the user commits, completes, or dismisses.
  }

  /** Commit the chosen next action from the prompt. */
  async function handleCommitNext(action: EngageAvailableAction) {
    if (busy) return;
    const ok = await call(`/api/actions/${action.id}/commit`, "POST");
    if (ok) {
      setNextPrompt(null);
      router.refresh();
    }
  }

  /** No actions remain → mark the project complete. */
  async function handleCompleteProject() {
    if (busy || !nextPrompt) return;
    const ok = await call(`/api/projects/${nextPrompt.projectId}`, "PATCH", {
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

  if (model.isEmpty) {
    return (
      <div className="flex flex-col gap-[var(--spacing-section-y)]">
        <Header />
        <p className="rounded-[var(--radius-md)] border border-border bg-surface p-[var(--spacing-card-p)] text-text-secondary">
          No committed actions. Open a project and commit one.
        </p>
      </div>
    );
  }

  // Filtered projections of the model rows (client-side, over loaded data).
  const groupsForRender = model.goalGroups.map((group) => ({
    ...group,
    visible: group.committed.filter(rowMatchesFilter),
  }));
  const anytimeVisible = model.anytime.filter(rowMatchesFilter);
  const visibleCount =
    groupsForRender.reduce((total, group) => total + group.visible.length, 0) +
    model.projectGroups.reduce(
      (total, group) => total + group.committed.filter(rowMatchesFilter).length,
      0,
    ) +
    anytimeVisible.length;

  return (
    <div className="flex flex-col gap-[var(--spacing-section-y)]">
      <Header />

      <section aria-label="Action filters" className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <label className="flex flex-col gap-1 text-[length:var(--font-size-small)] font-medium text-text-secondary">
          Context
          <select
            aria-label="Filter by context"
            value={activeContext}
            onChange={(event) => setActiveContext(event.target.value)}
            className="min-h-[44px] rounded-[var(--radius-sm)] border border-border-strong bg-surface-raised px-3 text-text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)]"
          >
            <option value="">Any context</option>
            {allContexts.map((context) => (
              <option key={context} value={context}>{context}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-[length:var(--font-size-small)] font-medium text-text-secondary">
          Energy
          <select
            aria-label="Filter by energy"
            value={activeEnergy}
            onChange={(event) => setActiveEnergy(event.target.value)}
            className="min-h-[44px] rounded-[var(--radius-sm)] border border-border-strong bg-surface-raised px-3 text-text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)]"
          >
            <option value="">Any energy</option>
            {allEnergies.map((energy) => (
              <option key={energy} value={energy}>{energy}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-[length:var(--font-size-small)] font-medium text-text-secondary">
          Time available
          <select
            aria-label="Filter by time available"
            value={maxAvailableMinutes}
            onChange={(event) => setMaxAvailableMinutes(event.target.value)}
            className="min-h-[44px] rounded-[var(--radius-sm)] border border-border-strong bg-surface-raised px-3 text-text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)]"
          >
            <option value="">Any amount</option>
            {TIME_FILTERS.map((minutes) => (
              <option key={minutes} value={minutes}>{minutes} min or less</option>
            ))}
          </select>
        </label>
        {(activeContext !== "" || activeEnergy !== "" || maxAvailableMinutes !== "") && (
          <button
            type="button"
            onClick={() => {
              setActiveContext("");
              setActiveEnergy("");
              setMaxAvailableMinutes("");
            }}
            className="min-h-[44px] w-fit self-end rounded-[var(--radius-sm)] border border-border-strong px-4 py-2 font-medium text-text-primary hover:bg-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)]"
          >
            Clear filters
          </button>
        )}
      </section>

      <div className="flex flex-col gap-4">
        {visibleCount === 0 && (
          <p className="text-text-secondary">No committed actions match these filters.</p>
        )}
        {groupsForRender.map((group) => {
          // A goal group renders when it has any visible row OR a stuck
          // project to surface (stuck bands are not tag-filtered).
          const showGroup =
            group.visible.length > 0 || group.stuckProjects.length > 0;
          if (!showGroup) return null;
          return (
            <details
              key={group.goalId}
              open
              className="rounded-[var(--radius-md)] border border-border bg-surface"
            >
              <summary className="cursor-pointer rounded-[var(--radius-md)] px-[var(--spacing-card-p)] py-3 text-[length:var(--font-size-subheading)] font-semibold text-text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)]">
                {group.goalText}
              </summary>
              <div className="flex flex-col gap-3 px-[var(--spacing-card-p)] pb-[var(--spacing-card-p)] pt-1">
                {group.visible.length > 0 && (
                  <ul className="flex flex-col gap-2">
                    {group.visible.map((row) => (
                      <EngageActionRow
                        key={row.id}
                        row={row}
                        disabled={busy}
                        onDone={handleDone}
                      />
                    ))}
                  </ul>
                )}
                {group.stuckProjects.map((sp) => (
                  <StuckProjectBand key={sp.id} id={sp.id} name={sp.name} />
                ))}
              </div>
            </details>
          );
        })}

        {model.projectGroups.map((group) => {
          const visible = group.committed.filter(rowMatchesFilter);
          if (visible.length === 0) return null;
          return (
            <details
              key={group.projectId}
              open
              className="rounded-[var(--radius-md)] border border-border bg-surface"
            >
              <summary className="cursor-pointer rounded-[var(--radius-md)] px-[var(--spacing-card-p)] py-3 text-[length:var(--font-size-subheading)] font-semibold text-text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)]">
                {group.projectName}
              </summary>
              <div className="px-[var(--spacing-card-p)] pb-[var(--spacing-card-p)] pt-1">
                <ul className="flex flex-col gap-2">
                  {visible.map((row) => (
                    <EngageActionRow
                      key={row.id}
                      row={row}
                      disabled={busy}
                      onDone={handleDone}
                    />
                  ))}
                </ul>
              </div>
            </details>
          );
        })}

        {anytimeVisible.length > 0 && (
          <details
            open
            className="rounded-[var(--radius-md)] border border-border bg-surface"
          >
            <summary className="cursor-pointer rounded-[var(--radius-md)] px-[var(--spacing-card-p)] py-3 text-[length:var(--font-size-subheading)] font-semibold text-text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)]">
              Anytime / No project
            </summary>
            <div className="px-[var(--spacing-card-p)] pb-[var(--spacing-card-p)] pt-1">
              <ul className="flex flex-col gap-2">
                {anytimeVisible.map((row) => (
                  <EngageActionRow
                    key={row.id}
                    row={row}
                    disabled={busy}
                    onDone={handleDone}
                  />
                ))}
              </ul>
            </div>
          </details>
        )}
      </div>

      {nextPrompt !== null && (
        <div
          ref={promptRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="engage-next-title"
          tabIndex={-1}
          onKeyDown={(e) => {
            if (e.key === "Escape" && !busy) dismissPrompt();
          }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 focus:outline-none"
        >
          <div className="flex w-full max-w-md flex-col gap-4 rounded-[var(--radius-lg)] bg-surface-raised p-6 shadow-lg">
            <h3
              id="engage-next-title"
              className="text-[length:var(--font-size-subheading)] font-semibold text-text-primary"
            >
              What&apos;s next for {nextPrompt.projectName}?
            </h3>
            {nextPrompt.available.length > 0 ? (
              <>
                <p className="text-text-secondary">
                  Commit the next action to work on.
                </p>
                <ul className="flex flex-col gap-2">
                  {nextPrompt.available.map((a) => (
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

      {error && (
        <div
          role="alert"
          aria-live="assertive"
          className="rounded-[var(--radius-sm)] bg-destructive-subtle px-3 py-2 text-[length:var(--font-size-small)] text-destructive"
        >
          {error}
        </div>
      )}
    </div>
  );
}

function Header() {
  return (
    <h1 className="text-[length:var(--font-size-section)] font-bold text-text-primary">
      Engage
    </h1>
  );
}

/**
 * A stuck project's amber band + a "Commit one →" CTA that routes to the
 * project detail's action list. Uses StuckIndicator's anchor fallback via a
 * link wrapper so no behavior changes for existing callers.
 */
function StuckProjectBand({ id, name }: { id: string; name: string }) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-[length:var(--font-size-small)] font-medium text-text-secondary">
        {name}
      </p>
      <StuckIndicatorLink id={id} />
    </div>
  );
}

/**
 * StuckIndicator wired to route to the project detail's #actions anchor. We
 * pass an `onCommitNow` that navigates, keeping StuckIndicator itself untouched.
 */
function StuckIndicatorLink({ id }: { id: string }) {
  const router = useRouter();
  return (
    <StuckIndicator
      onCommitNow={() => router.push(`/app/projects/${id}?from=${encodeURIComponent("/app/engage")}#actions`)}
    />
  );
}
