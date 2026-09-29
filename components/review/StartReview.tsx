"use client";

/**
 * StartReview — the explicit "Start weekly review" control on the review
 * landing (Story 5.4). Per the design note we prefer an explicit start over
 * lazily creating a session on page load, so glancing at the page never writes
 * an empty session.
 *
 * Clicking POSTs `/api/review` (idempotent for the current week) and, on
 * success, calls `router.refresh()` so the server page re-resolves and renders
 * the `ReviewShell` for the now-existing session. Failures surface inline as a
 * `role="alert"` error and leave the landing in place.
 */

import { useRouter } from "next/navigation";
import { useState } from "react";

const GENERIC_ERROR = "Couldn't start the review. Please try again.";

export default function StartReview() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function start() {
    if (busy) return;
    setError("");
    setBusy(true);
    try {
      const res = await fetch("/api/review", { method: "POST" });
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

  return (
    <div className="flex flex-col items-start gap-4">
      {error && (
        <div
          role="alert"
          aria-live="assertive"
          className="rounded-[var(--radius-sm)] bg-destructive-subtle px-3 py-2 text-[length:var(--font-size-small)] text-destructive"
        >
          {error}
        </div>
      )}
      <button
        type="button"
        onClick={start}
        disabled={busy}
        className="inline-flex min-h-[44px] items-center rounded-[var(--radius-sm)] bg-primary px-4 py-2 font-medium text-text-inverse transition-colors hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {busy ? "Starting…" : "Start weekly review"}
      </button>
    </div>
  );
}
