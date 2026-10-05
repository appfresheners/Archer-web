"use client";

/**
 * NewProjectClient — the thin client seam between the server page and the
 * `ProjectModeInput` form.
 *
 * A server component cannot hand a function prop to a client component, so this
 * wrapper owns the submit handlers. In AI mode (the default, unchanged) it
 * POSTs `{ mode: 'project', input, depth, areaId }` to `/api/generate`; the route
 * generates AND saves the project (save-before-return) and resolves to
 * `{ id }`. In manual mode (Story 2.7) it POSTs the manual fields to the
 * authenticated `/api/projects` route, which inserts the row without any AI
 * call. Both paths navigate to `/app/projects/{id}` only after they hold the
 * saved id — the flow never leaves the user on a transient, unsaved result.
 *
 * While a request is in flight the form is disabled and the submit button
 * shows a spinner ("Generating…" / "Saving…"). On failure it maps the route's
 * status to actionable copy and surfaces it in an assertive alert region with
 * a "Try again" button that re-runs the last submission (no re-typing). A
 * successful navigation leaves the form disabled through the transition.
 */

import ProjectModeInput, {
  type GoalOption,
  type ManualProjectArgs,
} from "@/components/projects/ProjectModeInput";
import type { AreaOption } from "@/components/focus/AreaSelect";
import type { PlanningDepth } from "@/lib/supabase/schema";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

type SubmitArgs = { input: string; depth: PlanningDepth; areaId: string | null };

const TIMEOUT_MESSAGE =
  "Generation took longer than 30 seconds and timed out. Please try again.";
const NETWORK_MESSAGE =
  "Could not reach the server. Check your connection and try again.";
const GENERIC_MESSAGE =
  "Something went wrong generating your project. Please try again.";
const MANUAL_GENERIC_MESSAGE =
  "Something went wrong creating your project. Please try again.";

export default function NewProjectClient({
  goals = [],
  areas = [],
}: {
  goals?: GoalOption[];
  areas?: AreaOption[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  // Clarify multistep hand-off (Story 5.2): when arriving from the inbox, seed
  // the input with the item text and remember which item to link on create.
  const fromInbox = searchParams.get("from_inbox");
  const seed = searchParams.get("seed") ?? "";

  const [inFlight, setInFlight] = useState(false);
  const [manualSaving, setManualSaving] = useState(false);
  const [error, setError] = useState("");
  // Remember the last submission so "Try again" can re-run it with the exact
  // same args — the user never has to re-type after a failure. Only one of
  // these is set at a time; each submit clears the other.
  const [lastSubmit, setLastSubmit] = useState<SubmitArgs | null>(null);
  const [lastManualSubmit, setLastManualSubmit] =
    useState<ManualProjectArgs | null>(null);

  // Abort the in-flight fetch on unmount so a late response never triggers a
  // state update after the component is gone.
  const abortRef = useRef<AbortController | null>(null);
  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  // Link the originating inbox item to the created project and mark it
  // processed (clarify hand-off, shared by both AI and manual paths).
  // Best-effort — a link failure must not strand the user on the created
  // project, so we still navigate. The item stays unprocessed and can be
  // re-clarified.
  const linkInboxItem = async (projectId: string) => {
    if (!fromInbox) return;
    await fetch(`/api/inbox/${fromInbox}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status: "processed",
        resolved_project_id: projectId,
      }),
    }).catch(() => null);
  };

  const run = async (args: SubmitArgs) => {
    if (inFlight) return;
    setError("");
    setLastSubmit(args);
    setLastManualSubmit(null);
    setInFlight(true);

    const controller = new AbortController();
    abortRef.current?.abort();
    abortRef.current = controller;

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "project",
          input: args.input,
          depth: args.depth,
                  areaId: args.areaId,
        }),
        signal: controller.signal,
      });

      const payload = (await res.json().catch(() => null)) as {
        id?: string;
        error?: string;
      } | null;

      if (res.ok && payload?.id) {
        // Clarify hand-off: link the originating inbox item to this project and
        // mark it processed. Best-effort — a link failure must not strand the
        // user on the created project, so we still navigate. The item simply
        // stays unprocessed and can be re-clarified.
        await linkInboxItem(payload.id);

        // Navigate only after the row is saved and we hold its id. Keep the
        // form disabled through navigation so a double-submit can't fire.
        router.push(`/app/projects/${payload.id}`);
        router.refresh();
        return;
      }

      // Map the route's status to actionable copy. 504 = the 30s timeout;
      // 500 carries the server's actionable message (incl. API-key guidance
      // from lib/ai); anything else falls back to a generic message.
      if (res.status === 504) {
        setError(payload?.error || TIMEOUT_MESSAGE);
      } else {
        setError(payload?.error || GENERIC_MESSAGE);
      }
      setInFlight(false);
    } catch {
      if (controller.signal.aborted) return;
      setError(NETWORK_MESSAGE);
      setInFlight(false);
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
    }
  };

  const saveManual = async (args: ManualProjectArgs) => {
    if (manualSaving) return;
    setError("");
    setLastManualSubmit(args);
    setLastSubmit(null);
    setManualSaving(true);

    const controller = new AbortController();
    abortRef.current?.abort();
    abortRef.current = controller;

    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: args.name,
          purpose: args.purpose || null,
          successful_outcome: args.successfulOutcome || null,
          goal_id: args.goalId,
                  area_id: args.areaId,
        }),
        signal: controller.signal,
      });

      const payload = (await res.json().catch(() => null)) as {
        id?: string;
        error?: string;
      } | null;

      if (res.ok && payload?.id) {
        await linkInboxItem(payload.id);
        router.push(`/app/projects/${payload.id}`);
        router.refresh();
        return;
      }

      setError(payload?.error || MANUAL_GENERIC_MESSAGE);
      setManualSaving(false);
    } catch {
      if (controller.signal.aborted) return;
      setError(NETWORK_MESSAGE);
      setManualSaving(false);
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
    }
  };

  const handleRetry = () => {
    if (lastSubmit) {
      void run(lastSubmit);
      return;
    }
    if (lastManualSubmit) {
      void saveManual(lastManualSubmit);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <ProjectModeInput
        onSubmit={run}
        onManualSubmit={saveManual}
        disabled={inFlight || manualSaving}
        loading={inFlight}
        manualSaving={manualSaving}
        initialInput={seed}
        goals={goals}
        areas={areas}
      />
      {error && (
        <div
          role="alert"
          aria-live="assertive"
          className="flex flex-col gap-2 rounded-[var(--radius-sm)] bg-destructive-subtle px-3 py-2 text-[length:var(--font-size-small)] text-destructive sm:flex-row sm:items-center sm:justify-between"
        >
          <span className="flex items-start gap-2">
            <span aria-hidden="true">⚠</span>
            <span>{error}</span>
          </span>
          <button
            type="button"
            onClick={handleRetry}
            disabled={
              inFlight || manualSaving || (!lastSubmit && !lastManualSubmit)
            }
            className="min-h-[44px] shrink-0 rounded-[var(--radius-sm)] border border-destructive px-4 py-2 font-medium text-destructive hover:bg-destructive/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            Try again
          </button>
        </div>
      )}
    </div>
  );
}
