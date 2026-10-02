"use client";

/**
 * InboxCaptureForm — the auto-focused capture input on the Inbox page (Story 5.1).
 *
 * Captures raw text only (no classification). Enter OR the "Capture" button
 * saves via `POST /api/inbox`, then `router.refresh()` re-renders the server
 * page from the database. The input clears and keeps focus so the user can
 * capture several thoughts in a row. Disabled while busy or empty; failures
 * surface as an inline `role="alert"` error (no toast system exists).
 *
 * The Enter handler ignores IME composition (`isComposing` / keyCode 229) so a
 * composing Enter (e.g. committing a CJK candidate) never submits.
 */

import { MAX_INBOX_TEXT } from "@/lib/inbox/validate";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

const GENERIC_ERROR = "Something went wrong. Please try again.";

export default function InboxCaptureForm() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function handleCapture() {
    const raw = text.trim();
    if (raw === "" || busy) return;
    setError("");
    setBusy(true);
    try {
      const res = await fetch("/api/inbox", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ raw_text: raw }),
      });
      if (!res.ok) {
        const payload = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        setError(payload?.error || GENERIC_ERROR);
        setBusy(false);
        return;
      }
      setText("");
      setBusy(false);
      inputRef.current?.focus();
      router.refresh();
    } catch {
      setError(GENERIC_ERROR);
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <label htmlFor="inbox-capture" className="sr-only">
          Capture to inbox
        </label>
        <input
          id="inbox-capture"
          ref={inputRef}
          value={text}
          autoFocus
          maxLength={MAX_INBOX_TEXT}
          disabled={busy}
          placeholder="Capture a thought"
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            // Ignore an Enter that commits an IME composition.
            if (e.nativeEvent.isComposing || e.keyCode === 229) return;
            if (e.key === "Enter") {
              e.preventDefault();
              void handleCapture();
            }
          }}
          className="min-h-[44px] flex-1 rounded-[var(--radius-sm)] border border-border-strong bg-surface-raised px-3 py-2 text-text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)] disabled:opacity-60"
        />
        <button
          type="button"
          onClick={handleCapture}
          disabled={busy || text.trim() === ""}
          className="inline-flex min-h-[44px] items-center rounded-[var(--radius-sm)] bg-primary px-4 py-2 font-medium text-text-inverse transition-colors hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)] disabled:cursor-not-allowed disabled:opacity-60"
        >
          Capture
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
    </div>
  );
}
