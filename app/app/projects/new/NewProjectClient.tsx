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
 * Scope note: this story keeps a minimal in-flight guard (disables the form
 * while a request is running) and a basic inline error surface. The richer
 * loading/timeout/error UX (spinner, retry toast, key-misconfig guidance) is
 * Story 2.4.
 */

import ProjectModeInput from "@/components/projects/ProjectModeInput";
import type { PlanningDepth } from "@/lib/supabase/schema";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function NewProjectClient() {
  const router = useRouter();
  const [inFlight, setInFlight] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (args: { input: string; depth: PlanningDepth }) => {
    if (inFlight) return;
    setError("");
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

      if (!res.ok || !payload?.id) {
        setError(
          payload?.error ??
          "Something went wrong generating your project. Please try again."
        );
        setInFlight(false);
        return;
      }

      // Navigate only after the row is saved and we hold its id. Keep the form
      // disabled through navigation so a double-submit can't fire.
      router.push(`/app/projects/${payload.id}`);
      router.refresh();
    } catch {
      setError(
        "Could not reach the server. Check your connection and try again."
      );
      setInFlight(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <ProjectModeInput onSubmit={handleSubmit} disabled={inFlight} />
      {error && (
        <p
          role="alert"
          className="text-[length:var(--font-size-small)] text-destructive"
        >
          {error}
        </p>
      )}
    </div>
  );
}
