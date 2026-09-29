"use client";

/**
 * Persistent floating capture button (client component).
 *
 * A fixed bottom-right affordance present in every `/app/*` view. It can be
 * triggered by click or the global `C` keyboard shortcut.
 *
 * It owns the global `CaptureDrawer` open-state (Story 5.1): because it already
 * holds the trigger (button + `C` shortcut) and lives in the app shell, keeping
 * the drawer state here makes capture reachable from any view without a global
 * provider. When the drawer is already open, the trigger is a no-op so `C`/click
 * cannot re-open it on top of itself.
 *
 * Accessibility:
 *   - `aria-label` gives it an accessible name (icon-only button).
 *   - 44×44px minimum touch target.
 *   - The `C` shortcut listens on `document` keydown but early-returns when
 *     focus is in an input, textarea, select, or contenteditable element, so
 *     it never hijacks typing. Modifier-key combos (Ctrl/Meta/Alt) are ignored
 *     so browser/OS shortcuts still work.
 */

import CaptureDrawer from "@/components/inbox/CaptureDrawer";
import { useCallback, useEffect, useState } from "react";

/** True when the event target is a field where a bare `C` should type, not fire the shortcut. */
function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  // `isContentEditable` is the source of truth in real browsers, but also
  // check the attribute directly so the guard holds in environments that
  // don't compute the property (e.g. jsdom without layout).
  if (target.isContentEditable) return true;
  const editableAttr = target.getAttribute("contenteditable");
  if (editableAttr !== null && editableAttr !== "false") return true;
  return false;
}

export default function FloatingCapture() {
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Open via a functional update so the trigger is idempotent while open —
  // `C`/click cannot re-open the drawer on top of itself, and the handler
  // stays stable (no dependency on the current open-state).
  const handleCapture = useCallback(() => {
    setDrawerOpen((open) => (open ? open : true));
  }, []);

  const handleClose = useCallback(() => setDrawerOpen(false), []);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      // Ignore keystrokes that are part of an IME composition (e.g. CJK input),
      // so a composing "c" never fires the shortcut mid-word.
      if (event.isComposing || event.keyCode === 229) return;
      // Ignore modifier combos so we don't clash with browser/OS shortcuts.
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      // Only the bare "c"/"C" key.
      if (event.key !== "c" && event.key !== "C") return;
      // Never hijack typing in a text field.
      if (isEditableTarget(event.target)) return;

      event.preventDefault();
      handleCapture();
    }

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [handleCapture]);

  return (
    <>
      <button
        type="button"
        onClick={handleCapture}
        aria-label="Capture to inbox (shortcut: C)"
        data-testid="floating-capture"
        className="fixed bottom-20 right-4 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-text-inverse shadow-[0_4px_6px_-1px_rgba(0,0,0,0.1)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)] motion-safe:transition-colors motion-safe:duration-150 hover:bg-primary-hover md:bottom-6"
      >
        <svg
          width={24}
          height={24}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          focusable="false"
        >
          <path d="M12 5v14" />
          <path d="M5 12h14" />
        </svg>
      </button>

      <CaptureDrawer open={drawerOpen} onClose={handleClose} />
    </>
  );
}
