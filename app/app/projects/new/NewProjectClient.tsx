"use client";

/**
 * NewProjectClient — the thin client seam between the server page and the
 * `ProjectModeInput` form.
 *
 * A server component cannot hand a function prop to a client component, so this
 * wrapper owns the submit handler. On a valid submit it POSTs
 * `{ mode: 'project', input, depth }` to `/api/generate`; the route generates
 * AND saves the project (save-before-return) and resolves to `{ id }`. Only
 * then do we navigate to `/app/projects/{id}` — the flow never leaves the user
 * on a transient, unsaved result.
 *
 * While a request is in flight the form is disabled and the submit button
 * shows a spinner + "Generating…" (via `loading`). On failure it maps the
 * route's status to actionable copy — 504 → timeout guidance, 500 → the
 * server's actionable message (which carries API-key-misconfiguration
 * guidance), a fetch throw → a connection message — and surfaces it in an
 * assertive alert region with a "Try again" button that re-runs the last
 * submission with the preserved input + depth (no re-typing). A successful
 * navigation leaves the form disabled through the transition.
 */

import ProjectModeInput from "@/components/projects/ProjectModeInput";
import type { PlanningDepth } from "@/lib/supabase/schema";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

type SubmitArgs = { input: string; depth: PlanningDepth };

const TIMEOUT_MESSAGE =
  "Generation took longer than 30 seconds and timed out. Please try again.";
const NETWORK_MESSAGE =
  "Could not reach the server. Check your connection and try again.";
const GENERIC_MESSAGE =
  "Something went wrong generating your project. Please try again.";

export default function NewProjectClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  // Clarify multistep hand-off (Story 5.2): when arriving from the inbox, seed
  // the input with the item text and remember which item to link on create.
  const fromInbox = searchParams.get("from_inbox");
  const seed = searchParams.get("seed") ?? "";

  const [inFlight, setInFlight] = useState(false);
  const [error, setError] = useState("");
  // Remember the last submission so "Try again" can re-run it with the exact
  // same input + depth — the user never has to re-type after a failure.
  const [lastSubmit, setLastSubmit] = useState<SubmitArgs | null>(null);

  const run = async (args: SubmitArgs) => {
    if (inFlight) return;
    setError("");
    setLastSubmit(args);
    setInFlight(true);

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "project",
          input: args.input,
          depth: args.depth,
        }),
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
        if (fromInbox) {
          await fetch(`/api/inbox/${fromInbox}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              status: "processed",
              resolved_project_id: payload.id,
            }),
          }).catch(() => null);
        }

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
      setError(NETWORK_MESSAGE);
      setInFlight(false);
    }
  };

  const handleRetry = () => {
    if (lastSubmit) {
      void run(lastSubmit);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <ProjectModeInput
        onSubmit={run}
        disabled={inFlight}
        loading={inFlight}
        initialInput={seed}
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
            disabled={inFlight || !lastSubmit}
            className="min-h-[44px] shrink-0 rounded-[var(--radius-sm)] border border-destructive px-4 py-2 font-medium text-destructive hover:bg-destructive/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            Try again
          </button>
        </div>
      )}
    </div>
  );
}
