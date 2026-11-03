"use client";

/**
 * GlobalShortcuts (client component) — Story 10.1.
 *
 * Registers global keyboard shortcuts for authenticated routes. Currently
 * handles Cmd/Ctrl+Shift+D for daily shutdown navigation.
 *
 * Pattern follows FloatingCapture's keyboard listener: document-level keydown
 * with editable-target guard (don't hijack typing), IME-aware (don't fire mid-
 * composition), and modifier-aware (check required modifiers, ignore others).
 *
 * Mounted once in the authenticated app layout (`app/app/layout.tsx`).
 */

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** True when the event target is a field where typing should not trigger shortcuts. */
function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  if (target.isContentEditable) return true;
  const editableAttr = target.getAttribute("contenteditable");
  if (editableAttr !== null && editableAttr !== "false") return true;
  return false;
}

export default function GlobalShortcuts() {
  const router = useRouter();

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      // Guard: IME composition
      if (event.isComposing || event.keyCode === 229) return;

      // Guard: Don't hijack typing in text fields
      if (isEditableTarget(event.target)) return;

      // Cmd/Ctrl + Shift + D → Daily Shutdown
      if (
        (event.metaKey || event.ctrlKey) &&
        event.shiftKey &&
        !event.altKey &&
        (event.key === "d" || event.key === "D")
      ) {
        event.preventDefault();
        router.push("/app/shutdown");
        return;
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [router]);

  return null; // No UI — just a keyboard listener
}
