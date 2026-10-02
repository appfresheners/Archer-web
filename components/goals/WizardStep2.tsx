"use client";

/**
 * WizardStep2 — the real Step 2 of the goal-creation wizard (Story 3.4),
 * mounted through the shell's step contract (see `GoalWizard.tsx`). It owns ONLY
 * Step 2 content; navigation and the advance gate stay with the shell.
 *
 * The self-assessment invariant:
 *   The AI never supplies or infers the user's current rating. Every slider
 *   starts at the neutral midpoint 5. On entering the step, any framework item
 *   still lacking a `user_rating` is seeded to 5 via a single `patchState` —
 *   this is a real, user-owned value the user can change (confirmation at the
 *   default), never an AI-derived one. Ratings are stored inline as
 *   `user_rating` on each framework item, matching the persisted schema
 *   (`SkillFrameworkItem.user_rating`).
 *
 * What it owns:
 *   - The heading (via `headingRef`, the shell's focus-on-advance target).
 *   - One gap-rating row per framework item: skill name, a required-level chip
 *     ("Required: N"), a 1–10 `<input type="range">` starting at 5 with a live
 *     current-value readout, and a live gap readout (Gap = Required − Current,
 *     floored at 0) shown amber when ≥ 4 and neutral otherwise. Each slider has
 *     full ARIA range semantics (`aria-label`, `aria-valuenow/min/max`, and an
 *     `aria-valuetext` like "Current: 6, Gap: 2") and is arrow-key adjustable.
 *   - An inline "Add item" field (mirrors Step 1) so the user can add their own
 *     skill/attribute; an added item starts at rating 5 with a user-owned
 *     required level.
 *
 * The advance control ("Next") lives in the shell and is gated on every item
 * having a numeric `user_rating`, so this component never needs its own advance
 * button.
 */

import type { SkillFrameworkItem, StepContext } from "@/app/app/goals/new/GoalWizard";
import { useEffect, useId, useState } from "react";

/** Neutral midpoint every slider starts at. No AI value, no pre-fill. */
const DEFAULT_RATING = 5;

/**
 * Neutral default required level for a user-added item (mirrors Step 1). The
 * AI proposes levels only for its own items; a user-authored skill's required
 * level is the user's own.
 */
const DEFAULT_REQUIRED_LEVEL = 5;

const MAX_LENGTH = 500;

/** Gap threshold at or above which the gap readout turns amber. */
const AMBER_THRESHOLD = 4;

interface WizardStep2Props {
  ctx: StepContext;
}

export default function WizardStep2({ ctx }: WizardStep2Props) {
  const { state, patchState, headingRef } = ctx;
  const { framework } = state;

  const [newItemName, setNewItemName] = useState("");
  const addItemInputId = useId();

  // Seed any item lacking a rating to the neutral midpoint 5 on entry, so
  // "every item has a user_rating" (the shell gate) is satisfiable by
  // confirmation-at-default. This is a user-owned value, never AI-derived.
  useEffect(() => {
    if (!framework) return;
    const needsSeed = framework.some(
      (item) => typeof item.user_rating !== "number",
    );
    if (!needsSeed) return;
    patchState({
      framework: framework.map((item) =>
        typeof item.user_rating === "number"
          ? item
          : { ...item, user_rating: DEFAULT_RATING },
      ),
    });
  }, [framework, patchState]);

  const setRating = (index: number, value: number) => {
    if (!framework) return;
    // A native range input always yields a valid integer, but guard anyway so
    // a NaN can never be written into `user_rating` (which would silently
    // satisfy the `typeof === "number"` advance gate and persist downstream).
    if (!Number.isFinite(value)) return;
    const clamped = Math.min(10, Math.max(1, Math.round(value)));
    const next = framework.map((item, i) =>
      i === index ? { ...item, user_rating: clamped } : item,
    );
    patchState({ framework: next });
  };

  const handleAddItem = () => {
    const name = newItemName.trim();
    if (name === "" || !framework) return;
    const item: SkillFrameworkItem = {
      name,
      required_level: DEFAULT_REQUIRED_LEVEL,
      description: "Added by you.",
      user_rating: DEFAULT_RATING,
    };
    patchState({ framework: [...framework, item] });
    setNewItemName("");
  };

  const handleAddItemKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.nativeEvent.isComposing) {
      e.preventDefault();
      handleAddItem();
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <h2
        ref={headingRef}
        tabIndex={-1}
        className="text-[length:var(--font-size-subheading)] font-bold text-text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)]"
      >
        Gap Rating
      </h2>

      <p className="text-[length:var(--font-size-small)] text-text-secondary">
        Rate your current level for each skill from 1 to 10. Every slider starts
        at 5 — move each one to reflect where you honestly stand today. The gap
        is the distance to the required level.
      </p>

      {framework && framework.length > 0 && (
        <ul className="flex flex-col gap-4">
          {framework.map((item, index) => {
            const rating = item.user_rating ?? DEFAULT_RATING;
            // Guard a non-numeric required_level (the endpoint validates this,
            // but never render "Gap: NaN" to the user if the shape drifts).
            const required = Number.isFinite(item.required_level)
              ? item.required_level
              : DEFAULT_REQUIRED_LEVEL;
            const gap = Math.max(0, required - rating);
            const isAmber = gap >= AMBER_THRESHOLD;
            return (
              <li
                key={`${item.name}-${index}`}
                className="flex flex-col gap-3 rounded-[var(--radius-md)] border border-border bg-background p-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-text-primary">
                      {item.name}
                    </span>
                    <span className="rounded-[var(--radius-xs)] bg-primary-subtle px-2 py-0.5 text-[length:var(--font-size-caption)] font-semibold text-primary">
                      Required: {item.required_level}
                    </span>
                  </div>
                  {/* Not a live region: the slider's `aria-valuetext` is the
                      canonical announcement, so a polite region here would
                      double-announce on every tick. */}
                  <span
                    className={`rounded-[var(--radius-xs)] px-2 py-0.5 text-[length:var(--font-size-caption)] font-semibold ${isAmber
                      ? "bg-warning-subtle text-warning"
                      : "text-text-secondary"
                      }`}
                  >
                    Gap: {gap}
                    {isAmber && <span className="sr-only"> (large gap)</span>}
                  </span>
                </div>

                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min={1}
                    max={10}
                    step={1}
                    value={rating}
                    aria-label={`Your current level for ${item.name}`}
                    aria-valuenow={rating}
                    aria-valuemin={1}
                    aria-valuemax={10}
                    aria-valuetext={`Current: ${rating}, Gap: ${gap}${isAmber ? " (large gap)" : ""}`}
                    onChange={(e) => setRating(index, Number(e.target.value))}
                    className="h-11 flex-1 cursor-pointer accent-[var(--color-primary)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)]"
                  />
                  <span
                    aria-hidden="true"
                    className="w-16 shrink-0 text-right text-[length:var(--font-size-small)] font-medium text-text-primary"
                  >
                    Current: {rating}
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <div className="flex items-end gap-2">
        <div className="flex-1">
          <label
            htmlFor={addItemInputId}
            className="mb-1 block text-[length:var(--font-size-small)] font-medium text-text-primary"
          >
            Add a skill
          </label>
          <input
            id={addItemInputId}
            type="text"
            value={newItemName}
            onChange={(e) => setNewItemName(e.target.value)}
            onKeyDown={handleAddItemKeyDown}
            placeholder="e.g., Vocal projection"
            maxLength={MAX_LENGTH}
            className="min-h-[44px] w-full rounded-[var(--radius-sm)] border border-border bg-background px-4 py-3 text-text-primary placeholder:text-text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-[var(--color-focus-ring)]"
          />
        </div>
        <button
          type="button"
          onClick={handleAddItem}
          disabled={newItemName.trim() === ""}
          aria-disabled={newItemName.trim() === "" ? "true" : undefined}
          className={`min-h-[44px] shrink-0 rounded-[var(--radius-sm)] border border-border px-6 py-2 font-medium text-text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)] ${newItemName.trim() === ""
            ? "cursor-not-allowed opacity-40"
            : "hover:bg-primary-subtle motion-safe:transition-colors"
            }`}
        >
          Add item
        </button>
      </div>
    </div>
  );
}
