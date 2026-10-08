"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

const GENERIC_ERROR = "Something went wrong. Please try again.";

export default function SomedayActions({
  id,
  label,
  type,
}: {
  id: string;
  label: string;
  type: "item" | "project";
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function transition() {
    if (pending) return;
    setError("");
    setPending(true);

    try {
      const response = await fetch(
        type === "item" ? `/api/inbox/${id}` : `/api/projects/${id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            status: type === "item" ? "unprocessed" : "paused",
          }),
        },
      );

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        setError(payload?.error || GENERIC_ERROR);
        return;
      }

      router.refresh();
    } catch {
      setError(GENERIC_ERROR);
    } finally {
      setPending(false);
    }
  }

  const action = type === "item" ? "Reactivate" : "Activate";
  const pendingLabel = type === "item" ? "Reactivating…" : "Activating…";

  return (
    <div className="flex flex-col items-start gap-2">
      <button
        type="button"
        onClick={transition}
        disabled={pending}
        aria-busy={pending}
        aria-label={`${action} ${label}`}
        className="inline-flex min-h-[44px] items-center rounded-[var(--radius-sm)] border border-border-strong px-3 py-2 text-[length:var(--font-size-small)] font-medium text-text-primary transition-colors hover:bg-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)] disabled:cursor-wait disabled:opacity-60"
      >
        {pending ? pendingLabel : action}
      </button>
      {error && (
        <p role="alert" aria-live="assertive" className="text-[length:var(--font-size-small)] text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}