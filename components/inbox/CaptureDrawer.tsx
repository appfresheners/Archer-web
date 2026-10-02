"use client";

/**
 * CaptureDrawer — the global capture surface reachable from any authenticated
 * view (Story 5.1). Adapts the ActionList modal idiom into a slide-in drawer.
 *
 * Behavior:
 *   - Renders only when `open`. On open, the text field is auto-focused.
 *   - Enter or the "Capture" button saves via `POST /api/inbox`; on success the
 *     input clears and the drawer closes. Failures keep the drawer open and
 *     show an inline `role="alert"` error.
 *   - Escape, a backdrop click, or the close button all close the drawer. It
 *     never navigates.
 *   - Focus restore: on mount it captures `document.activeElement` (the
 *     triggering FAB) and refocuses it on unmount, so keyboard focus returns to
 *     the opener. A full Tab-cycling focus trap is intentionally OUT of scope
 *     (deferred to the epic-H shared modal primitive, H-2).
 *   - The Enter handler ignores IME composition (`isComposing` / keyCode 229).
 */

import { MAX_INBOX_TEXT } from "@/lib/inbox/validate";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

const GENERIC_ERROR = "Something went wrong. Please try again.";

export interface CaptureDrawerProps {
  open: boolean;
  onClose: () => void;
}

export default function CaptureDrawer({ open, onClose }: CaptureDrawerProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // The drawer is always mounted and only toggles `open`, so reset its
  // transient state on every close→(re)open transition — otherwise stale draft
  // text or a stale error banner would reappear the next time it opens. This is
  // the React "adjust state while rendering on a prop change" pattern (reset
  // during render, not in an effect), keyed off the previous `open` value.
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (!open) {
      setText("");
      setError("");
      setBusy(false);
    }
  }

  // On open, focus the input and remember the opener (the element focused
  // before the drawer opened) so focus can be restored to it on close.
  useEffect(() => {
    if (!open) return;
    const opener = document.activeElement as HTMLElement | null;
    inputRef.current?.focus();
    return () => {
      opener?.focus?.();
    };
  }, [open]);

  if (!open) return null;

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
      // Close first so focus-restore targets the still-live opener before the
      // refresh re-renders the tree, then refresh the server list.
      onClose();
      router.refresh();
    } catch {
      setError(GENERIC_ERROR);
      setBusy(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="capture-drawer-title"
      tabIndex={-1}
      onKeyDown={(e) => {
        if (e.key === "Escape" && !busy) onClose();
      }}
      onMouseDown={(e) => {
        // Backdrop click closes; clicks inside the panel do not bubble here.
        if (e.target === e.currentTarget && !busy) onClose();
      }}
      className="fixed inset-0 z-50 flex justify-end bg-black/40 focus:outline-none"
    >
      <div className="flex h-full w-full max-w-md flex-col gap-4 bg-surface-raised p-6 shadow-lg">
        <div className="flex items-center justify-between gap-4">
          <h2
            id="capture-drawer-title"
            className="text-[length:var(--font-size-subheading)] font-semibold text-text-primary"
          >
            Capture to inbox
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            aria-label="Close capture drawer"
            className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-[var(--radius-sm)] text-text-secondary transition-colors hover:bg-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)] disabled:opacity-60"
          >
            <svg
              width={20}
              height={20}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
              focusable="false"
            >
              <path d="M18 6 6 18" />
              <path d="m6 6 12 12" />
            </svg>
          </button>
        </div>

        <label htmlFor="capture-drawer-input" className="sr-only">
          Capture a thought
        </label>
        <input
          id="capture-drawer-input"
          ref={inputRef}
          value={text}
          maxLength={MAX_INBOX_TEXT}
          disabled={busy}
          placeholder="Capture a thought"
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.nativeEvent.isComposing || e.keyCode === 229) return;
            if (e.key === "Enter") {
              e.preventDefault();
              void handleCapture();
            }
          }}
          className="min-h-[44px] w-full rounded-[var(--radius-sm)] border border-border-strong bg-surface px-3 py-2 text-text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)] disabled:opacity-60"
        />

        <div className="flex justify-end">
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
    </div>
  );
}
