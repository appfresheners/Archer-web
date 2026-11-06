/**
 * ActionMenu — dropdown menu for action row quick edits on Engage page.
 *
 * Provides quick access to common action editing operations:
 * - Edit context tags
 * - Set energy level
 * - Adjust time estimate
 * - Reschedule (set scheduled_for)
 * - View in project (if action has a project)
 * - Delete action
 *
 * Opens inline popovers for quick edits without leaving the Engage page.
 */

"use client";

import { useEffect, useRef, useState } from "react";

interface ActionMenuProps {
  actionText: string;
  projectId: string | null;
  projectName: string | null;
  onEditContext: () => void;
  onEditEnergy: () => void;
  onEditTime: () => void;
  onReschedule: () => void;
  disabled?: boolean;
}

export default function ActionMenu({
  actionText,
  projectId,
  projectName,
  onEditContext,
  onEditEnergy,
  onEditTime,
  onReschedule,
  disabled,
}: ActionMenuProps) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Close menu on outside click
  useEffect(() => {
    if (!open) return;

    function handleClickOutside(event: MouseEvent) {
      if (
        menuRef.current &&
        !menuRef.current.contains(event.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    }

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [open]);

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        type="button"
        disabled={disabled}
        aria-label={`Action menu for "${actionText}"`}
        aria-expanded={open}
        aria-haspopup="true"
        onClick={() => setOpen(!open)}
        className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radius-sm)] text-text-secondary transition-colors hover:bg-surface hover:text-text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {/* Three dots icon */}
        <svg
          width={20}
          height={20}
          viewBox="0 0 24 24"
          fill="currentColor"
          aria-hidden="true"
        >
          <circle cx={5} cy={12} r={2} />
          <circle cx={12} cy={12} r={2} />
          <circle cx={19} cy={12} r={2} />
        </svg>
      </button>

      {open && (
        <div
          ref={menuRef}
          role="menu"
          className="absolute right-0 top-full z-10 mt-1 w-56 rounded-[var(--radius-md)] border border-border bg-surface shadow-lg"
        >
          <ul className="py-1">
            <li>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setOpen(false);
                  onEditContext();
                }}
                className="flex w-full items-center gap-3 px-4 py-2 text-left text-[length:var(--font-size-small)] text-text-primary hover:bg-surface-raised focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--color-focus-ring)]"
              >
                <svg
                  width={16}
                  height={16}
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M20 7h-9M14 17H5" />
                  <circle cx={17} cy={17} r={3} />
                  <circle cx={7} cy={7} r={3} />
                </svg>
                Edit context
              </button>
            </li>
            <li>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setOpen(false);
                  onEditEnergy();
                }}
                className="flex w-full items-center gap-3 px-4 py-2 text-left text-[length:var(--font-size-small)] text-text-primary hover:bg-surface-raised focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--color-focus-ring)]"
              >
                <svg
                  width={16}
                  height={16}
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z" />
                </svg>
                Set energy level
              </button>
            </li>
            <li>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setOpen(false);
                  onEditTime();
                }}
                className="flex w-full items-center gap-3 px-4 py-2 text-left text-[length:var(--font-size-small)] text-text-primary hover:bg-surface-raised focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--color-focus-ring)]"
              >
                <svg
                  width={16}
                  height={16}
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <circle cx={12} cy={12} r={10} />
                  <path d="M12 6v6l4 2" />
                </svg>
                Adjust time estimate
              </button>
            </li>
            <li>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setOpen(false);
                  onReschedule();
                }}
                className="flex w-full items-center gap-3 px-4 py-2 text-left text-[length:var(--font-size-small)] text-text-primary hover:bg-surface-raised focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--color-focus-ring)]"
              >
                <svg
                  width={16}
                  height={16}
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <rect x={3} y={4} width={18} height={18} rx={2} />
                  <path d="M16 2v4M8 2v4M3 10h18" />
                </svg>
                Reschedule
              </button>
            </li>
            {projectId && (
              <>
                <li className="my-1 border-t border-border" />
                <li>
                  <a
                    href={`/app/projects/${projectId}?from=${encodeURIComponent("/app/engage")}#actions`}
                    role="menuitem"
                    className="flex w-full items-center gap-3 px-4 py-2 text-left text-[length:var(--font-size-small)] text-text-primary hover:bg-surface-raised focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--color-focus-ring)]"
                  >
                    <svg
                      width={16}
                      height={16}
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={2}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                      <path d="M15 3h6v6M10 14 21 3" />
                    </svg>
                    View in {projectName || "project"}
                  </a>
                </li>
              </>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
