"use client";

/**
 * WizardStep1 — the real Step 1 of the goal-creation wizard (Story 3.3),
 * mounted through the shell's step contract (see `GoalWizard.tsx`). It owns ONLY
 * Step 1 content; navigation and the advance gate stay with the shell.
 *
 * What it owns:
 *   - The goal input: an associated label, a live character counter that
 *     appears once the text passes a threshold (mirrors `ProjectModeInput`),
 *     `maxLength={500}`, and inline validation that blocks an empty/whitespace
 *     goal from fetching a framework. Goal text is written through
 *     `ctx.setGoalText` so the shell's framework-invalidation stays
 *     authoritative — editing the goal after a framework exists clears it and
 *     the user must re-Continue.
 *   - "Continue": a Pattern B fetch to `POST /api/generate`
 *     `{ mode:'goal', step:'framework', goal }`. While in flight the button
 *     shows "Building your framework…". On 200 the returned Target Profile is
 *     written via `ctx.patchState({ framework })`. Errors surface inline with a
 *     "Try again" that re-runs the fetch with the same goal (mirrors
 *     `NewProjectClient`); no framework is set on error.
 *   - The framework list: each item shows the skill name, a required-level
 *     chip, and a goal-specific description, with a remove (×) control and an
 *     inline "Add item" field. A user-added item gets a neutral default
 *     `required_level` (its level is user-owned; the AI is never asked to rate
 *     a user-authored item). The client NEVER sets `user_rating` — that is
 *     collected in Step 2 (Story 3.4).
 *
 * The advance control ("Next") lives in the shell and is gated on
 * `goalText non-empty && framework?.length >= 3`, so this component never needs
 * its own advance button.
 */

import type { SkillFrameworkItem, StepContext } from "@/app/app/goals/new/GoalWizard";
import type { FrameworkItem } from "@/lib/goals/generate-framework";
import { useId, useState } from "react";

const PLACEHOLDER = "e.g., Become a confident public speaker";
const MAX_LENGTH = 500;
const COUNTER_THRESHOLD = 400;

/**
 * Neutral default required level for a user-added item. The AI proposes levels
 * only for its own items; a user-authored skill's required level is the user's
 * own, set here (mid-scale) and adjustable later.
 */
const DEFAULT_REQUIRED_LEVEL = 5;

const TIMEOUT_MESSAGE =
  "Building your framework took longer than 30 seconds and timed out. Please try again.";
const NETWORK_MESSAGE =
  "Could not reach the server. Check your connection and try again.";
const GENERIC_MESSAGE =
  "Something went wrong building your framework. Please try again.";

interface WizardStep1Props {
  ctx: StepContext;
}

export default function WizardStep1({ ctx }: WizardStep1Props) {
  const { state, setGoalText, patchState, headingRef } = ctx;
  const { goalText, framework } = state;

  const [validationError, setValidationError] = useState("");
  const [inFlight, setInFlight] = useState(false);
  const [fetchError, setFetchError] = useState("");
  const [newItemName, setNewItemName] = useState("");

  const goalInputId = useId();
  const goalCounterId = useId();
  const goalErrorId = useId();
  const addItemInputId = useId();

  const trimmedGoal = goalText.trim();
  const isEmptyGoal = trimmedGoal === "";
  const showCounter = goalText.length > COUNTER_THRESHOLD;
  const continueDisabled = isEmptyGoal || inFlight;

  const handleGoalChange = (value: string) => {
    if (validationError) setValidationError("");
    // Route through the shell so a goal edit invalidates any existing
    // framework (the shell owns that contract).
    setGoalText(value);
  };

  const runFetch = async (goal: string) => {
    setFetchError("");
    setInFlight(true);
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "goal", step: "framework", goal }),
      });

      const payload = (await res.json().catch(() => null)) as {
        framework?: FrameworkItem[];
        error?: string;
      } | null;

      if (res.ok && Array.isArray(payload?.framework) && payload.framework.length >= 3) {
        // The AI supplies only the Target Profile — spread the items into the
        // canonical shape WITHOUT a `user_rating` (collected in Step 2).
        const items: SkillFrameworkItem[] = payload.framework.map((item) => ({
          name: item.name,
          required_level: item.required_level,
          description: item.description,
        }));
        patchState({ framework: items });
        setInFlight(false);
        return;
      }

      // A 200 that somehow carries fewer than 3 items (the endpoint already
      // enforces this floor, so this is defensive) is treated as an error
      // rather than setting an empty/too-short framework that would silently
      // leave the advance gate unmet with no explanation.
      if (res.ok) {
        setFetchError(GENERIC_MESSAGE);
        setInFlight(false);
        return;
      }

      // Map the route's status to actionable copy — mirrors NewProjectClient.
      if (res.status === 504) {
        setFetchError(payload?.error || TIMEOUT_MESSAGE);
      } else {
        setFetchError(payload?.error || GENERIC_MESSAGE);
      }
      setInFlight(false);
    } catch {
      setFetchError(NETWORK_MESSAGE);
      setInFlight(false);
    }
  };

  const handleContinue = () => {
    if (isEmptyGoal) {
      setValidationError("Enter a goal first");
      return;
    }
    if (inFlight) return;
    void runFetch(trimmedGoal);
  };

  const handleGoalKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.nativeEvent.isComposing) {
      e.preventDefault();
      handleContinue();
    }
  };

  const handleRetry = () => {
    if (isEmptyGoal || inFlight) return;
    void runFetch(trimmedGoal);
  };

  const handleRemoveItem = (index: number) => {
    if (!framework) return;
    const next = framework.filter((_, i) => i !== index);
    patchState({ framework: next });
  };

  const handleAddItem = () => {
    const name = newItemName.trim();
    if (name === "" || !framework) return;
    const item: SkillFrameworkItem = {
      name,
      required_level: DEFAULT_REQUIRED_LEVEL,
      description: "Added by you.",
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
        Goal &amp; Skill Framework
      </h2>

      <div className="flex flex-col gap-4">
        <div>
          <label
            htmlFor={goalInputId}
            className="mb-1 block font-medium text-text-primary"
          >
            Describe your goal
          </label>
          <input
            id={goalInputId}
            type="text"
            value={goalText}
            onChange={(e) => handleGoalChange(e.target.value)}
            onKeyDown={handleGoalKeyDown}
            placeholder={PLACEHOLDER}
            maxLength={MAX_LENGTH}
            disabled={inFlight}
            aria-describedby={
              [
                showCounter ? goalCounterId : null,
                validationError ? goalErrorId : null,
              ]
                .filter(Boolean)
                .join(" ") || undefined
            }
            className="min-h-[44px] w-full rounded-[var(--radius-sm)] border border-border bg-background px-4 py-3 text-text-primary placeholder:text-text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-[var(--color-focus-ring)] disabled:cursor-not-allowed disabled:opacity-60"
          />
          {showCounter && (
            <p
              id={goalCounterId}
              aria-live="polite"
              className="mt-1 text-right text-[length:var(--font-size-small)] text-text-secondary"
            >
              {goalText.length} / {MAX_LENGTH}
            </p>
          )}
          {validationError && (
            <p
              id={goalErrorId}
              role="alert"
              className="mt-1 text-[length:var(--font-size-small)] text-destructive"
            >
              {validationError}
            </p>
          )}
        </div>

        <button
          type="button"
          onClick={handleContinue}
          disabled={continueDisabled}
          aria-disabled={continueDisabled ? "true" : undefined}
          aria-busy={inFlight ? "true" : undefined}
          className={`flex min-h-[44px] items-center justify-center rounded-[var(--radius-sm)] px-6 py-3 font-bold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)] ${continueDisabled
              ? "cursor-not-allowed bg-primary/40 text-white/60"
              : "bg-primary text-white hover:bg-primary-hover motion-safe:transition-colors motion-safe:duration-150"
            }`}
        >
          {inFlight && (
            <span
              className="mr-2 inline-block h-4 w-4 motion-safe:animate-spin rounded-full border-2 border-white/40 border-t-white align-[-2px]"
              aria-hidden="true"
            />
          )}
          {inFlight ? "Building your framework…" : "Continue"}
        </button>

        {fetchError && (
          <div
            role="alert"
            aria-live="assertive"
            className="flex flex-col gap-2 rounded-[var(--radius-sm)] bg-destructive-subtle px-3 py-2 text-[length:var(--font-size-small)] text-destructive sm:flex-row sm:items-center sm:justify-between"
          >
            <span className="flex items-start gap-2">
              <span aria-hidden="true">⚠</span>
              <span>{fetchError}</span>
            </span>
            <button
              type="button"
              onClick={handleRetry}
              disabled={inFlight || isEmptyGoal}
              className="min-h-[44px] shrink-0 rounded-[var(--radius-sm)] border border-destructive px-4 py-2 font-medium text-destructive hover:bg-destructive/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              Try again
            </button>
          </div>
        )}
      </div>

      {/* Framework list — only after a successful fetch. */}
      {framework && (
        <div className="flex flex-col gap-4">
          <div>
            <h3 className="font-bold text-text-primary">Your skill framework</h3>
            <p className="text-[length:var(--font-size-small)] text-text-secondary">
              Review the skills below. Remove any that don&apos;t fit and add
              your own. You&apos;ll rate yourself in the next step.
            </p>
          </div>

          <ul className="flex flex-col gap-3">
            {framework.map((item, index) => (
              <li
                key={`${item.name}-${index}`}
                className="flex items-start justify-between gap-3 rounded-[var(--radius-md)] border border-border bg-background p-4"
              >
                <div className="flex flex-col gap-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-text-primary">
                      {item.name}
                    </span>
                    <span className="rounded-[var(--radius-xs)] bg-primary-subtle px-2 py-0.5 text-[length:var(--font-size-caption)] font-semibold text-primary">
                      Required level {item.required_level}
                    </span>
                  </div>
                  <p className="text-[length:var(--font-size-small)] text-text-secondary">
                    {item.description}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleRemoveItem(index)}
                  aria-label={`Remove ${item.name}`}
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[var(--radius-sm)] border border-border text-text-secondary hover:bg-destructive-subtle hover:text-destructive focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)]"
                >
                  <span aria-hidden="true" className="text-lg leading-none">
                    ×
                  </span>
                </button>
              </li>
            ))}
          </ul>

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
      )}
    </div>
  );
}
