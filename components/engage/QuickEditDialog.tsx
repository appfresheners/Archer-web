/**
 * QuickEditDialog — modal for quick action edits from Engage page.
 *
 * Provides focused editing for:
 * - Context tags (multi-select chips)
 * - Energy level (dropdown)
 * - Time available (number input)
 * - Scheduled for (date input)
 *
 * Saves changes via PATCH to /api/actions/[id] and refreshes the page.
 */

"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

type EditMode = "context" | "energy" | "time" | "schedule" | null;

interface QuickEditDialogProps {
  actionId: string;
  actionText: string;
  mode: EditMode;
  initialContextTags: string[];
  initialEnergy: string | null;
  initialTimeMinutes: number;
  initialScheduledFor: string | null;
  availableContexts: string[]; // All existing contexts from database
  onClose: () => void;
}

const ENERGY_OPTIONS = ["low", "medium", "high"];
// Removed COMMON_CONTEXTS - using actual contexts from database instead

const GENERIC_ERROR = "Something went wrong. Please try again.";

export default function QuickEditDialog({
  actionId,
  actionText,
  mode,
  initialContextTags,
  initialEnergy,
  initialTimeMinutes,
  initialScheduledFor,
  availableContexts,
  onClose,
}: QuickEditDialogProps) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDivElement>(null);

  const [contextTags, setContextTags] = useState<string[]>(
    initialContextTags.filter((tag) => !tag.startsWith("@energy:"))
  );
  const [newContextInput, setNewContextInput] = useState("");
  const [energy, setEnergy] = useState<string>(initialEnergy || "");
  const [timeMinutes, setTimeMinutes] = useState<number>(initialTimeMinutes);
  const [scheduledFor, setScheduledFor] = useState<string>(
    initialScheduledFor || ""
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // Focus trap on mount
  useEffect(() => {
    dialogRef.current?.focus();
  }, []);

  // Close on Escape
  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape" && !busy) {
        onClose();
      }
    }
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [busy, onClose]);

  async function handleSave() {
    if (busy) return;

    setBusy(true);
    setError("");

    try {
      // Build the update payload based on mode
      const payload: Record<string, unknown> = {};

      if (mode === "context") {
        // Merge context tags with energy tag if energy is set
        const allTags = [...contextTags];
        if (energy) {
          allTags.push(`@energy:${energy}`);
        }
        payload.context_tags = allTags;
      } else if (mode === "energy") {
        // Update energy tag in context_tags
        const nonEnergyTags = initialContextTags.filter(
          (tag) => !tag.startsWith("@energy:")
        );
        const allTags = [...nonEnergyTags];
        if (energy) {
          allTags.push(`@energy:${energy}`);
        }
        payload.context_tags = allTags;
      } else if (mode === "time") {
        payload.time_available_minutes = timeMinutes;
      } else if (mode === "schedule") {
        payload.scheduled_for = scheduledFor || null;
      }

      const res = await fetch(`/api/actions/${actionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        setError(data?.error || GENERIC_ERROR);
        setBusy(false);
        return;
      }

      // Success — refresh and close
      router.refresh();
      onClose();
    } catch {
      setError(GENERIC_ERROR);
      setBusy(false);
    }
  }

  function addContextTag(tag: string) {
    const trimmed = tag.trim();
    if (trimmed && !contextTags.includes(trimmed)) {
      setContextTags([...contextTags, trimmed]);
      setNewContextInput("");
    }
  }

  function removeContextTag(tag: string) {
    setContextTags(contextTags.filter((t) => t !== tag));
  }

  if (!mode) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="quick-edit-title"
        tabIndex={-1}
        className="flex w-full max-w-md flex-col gap-4 rounded-[var(--radius-lg)] bg-surface-raised p-6 shadow-lg focus:outline-none"
      >
        <h2
          id="quick-edit-title"
          className="text-[length:var(--font-size-subheading)] font-semibold text-text-primary"
        >
          {mode === "context" && "Edit Context"}
          {mode === "energy" && "Set Energy Level"}
          {mode === "time" && "Adjust Time Estimate"}
          {mode === "schedule" && "Reschedule Action"}
        </h2>

        <p className="text-[length:var(--font-size-small)] text-text-secondary">
          {actionText}
        </p>

        {/* Context editing */}
        {mode === "context" && (
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap gap-2">
              {contextTags.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => removeContextTag(tag)}
                  disabled={busy}
                  className="flex items-center gap-1 rounded-[var(--radius-xs)] bg-surface px-2 py-1 text-[length:var(--font-size-caption)] text-text-primary hover:bg-destructive-subtle hover:text-destructive disabled:opacity-60"
                >
                  {tag}
                  <span aria-label="Remove">×</span>
                </button>
              ))}
            </div>

            <div className="flex gap-2">
              <input
                type="text"
                value={newContextInput}
                onChange={(e) => setNewContextInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addContextTag(newContextInput);
                  }
                }}
                placeholder="Type new context (e.g., @location:home)"
                disabled={busy}
                className="flex-1 rounded-[var(--radius-sm)] border border-border bg-background px-3 py-2 text-[length:var(--font-size-small)] text-text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)] disabled:opacity-60"
              />
              <button
                type="button"
                onClick={() => addContextTag(newContextInput)}
                disabled={busy || !newContextInput.trim()}
                className="rounded-[var(--radius-sm)] border border-border-strong px-3 py-2 text-[length:var(--font-size-small)] font-medium text-text-primary hover:bg-surface disabled:opacity-60"
              >
                Add
              </button>
            </div>

            {/* Existing contexts selector */}
            {availableContexts.length > 0 && (
              <div className="flex flex-col gap-2">
                <label htmlFor="existing-contexts" className="text-[length:var(--font-size-small)] font-medium text-text-secondary">
                  Or select from existing:
                </label>
                <select
                  id="existing-contexts"
                  onChange={(e) => {
                    if (e.target.value) {
                      addContextTag(e.target.value);
                      e.target.value = ""; // Reset after selection
                    }
                  }}
                  disabled={busy}
                  className="min-h-[44px] rounded-[var(--radius-sm)] border border-border bg-background px-3 text-text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)] disabled:opacity-60"
                >
                  <option value="">Choose a context...</option>
                  {availableContexts
                    .filter((ctx) => !contextTags.includes(ctx))
                    .map((ctx) => (
                      <option key={ctx} value={ctx}>
                        {ctx}
                      </option>
                    ))}
                </select>
              </div>
            )}
          </div>
        )}

        {/* Energy editing */}
        {mode === "energy" && (
          <label className="flex flex-col gap-2">
            <span className="text-[length:var(--font-size-small)] font-medium text-text-secondary">
              Energy level
            </span>
            <select
              value={energy}
              onChange={(e) => setEnergy(e.target.value)}
              disabled={busy}
              className="min-h-[44px] rounded-[var(--radius-sm)] border border-border bg-background px-3 text-text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)] disabled:opacity-60"
            >
              <option value="">Not set</option>
              {ENERGY_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>
                  {opt.charAt(0).toUpperCase() + opt.slice(1)}
                </option>
              ))}
            </select>
          </label>
        )}

        {/* Time editing */}
        {mode === "time" && (
          <label className="flex flex-col gap-2">
            <span className="text-[length:var(--font-size-small)] font-medium text-text-secondary">
              Time available (minutes)
            </span>
            <input
              type="number"
              value={timeMinutes}
              onChange={(e) => setTimeMinutes(Number(e.target.value))}
              min={1}
              disabled={busy}
              className="min-h-[44px] rounded-[var(--radius-sm)] border border-border bg-background px-3 text-text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)] disabled:opacity-60"
            />
          </label>
        )}

        {/* Schedule editing */}
        {mode === "schedule" && (
          <label className="flex flex-col gap-2">
            <span className="text-[length:var(--font-size-small)] font-medium text-text-secondary">
              Scheduled for (date)
            </span>
            <input
              type="date"
              value={scheduledFor}
              onChange={(e) => setScheduledFor(e.target.value)}
              disabled={busy}
              className="min-h-[44px] rounded-[var(--radius-sm)] border border-border bg-background px-3 text-text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)] disabled:opacity-60"
            />
          </label>
        )}

        {error && (
          <div
            role="alert"
            className="rounded-[var(--radius-sm)] bg-destructive-subtle px-3 py-2 text-[length:var(--font-size-small)] text-destructive"
          >
            {error}
          </div>
        )}

        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="inline-flex min-h-[44px] items-center rounded-[var(--radius-sm)] border border-border-strong px-4 py-2 font-medium text-text-primary hover:bg-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)] disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={busy}
            className="inline-flex min-h-[44px] items-center rounded-[var(--radius-sm)] bg-primary px-4 py-2 font-medium text-text-inverse hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)] disabled:opacity-60"
          >
            {busy ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
