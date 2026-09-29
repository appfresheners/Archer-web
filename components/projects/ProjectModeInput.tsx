"use client";

/**
 * ProjectModeInput — the Project Mode entry surface (client component).
 *
 * A single text input (canonical placeholder, `maxLength={500}`), a
 * Minimal/Full-GTD `DepthControl` (Minimal preselected — the zero-friction
 * default), and a "Break it down" submit button. Owns local `input` + `depth`
 * state, inline validation, and a live character counter that appears only once
 * the input exceeds 400 characters (keeping the default flow visually quiet).
 *
 * Enter (in the text input) and clicking the button are equivalent submit
 * paths. Empty or whitespace-only input blocks submission with a `role="alert"`
 * inline error and no `onSubmit`. On a valid submit it calls
 * `onSubmit({ input: trimmedInput, depth })` where `depth` is the DB
 * `planning_depth` enum literal (`'minimal' | 'full_gtd'`), so Story 2.3 needs
 * no mapping layer at save time.
 *
 * Generation, saving, and navigation are out of scope here (Stories 2.3+):
 * `onSubmit` is a thin, replaceable seam supplied by the parent, and `disabled`
 * reflects an in-flight state the parent drives later.
 */

import type { PlanningDepth } from "@/lib/supabase/schema";
import { useId, useState } from "react";
import DepthControl from "./DepthControl";

const PLACEHOLDER = "e.g., Personal portfolio website deployed online";
const MAX_LENGTH = 500;
const COUNTER_THRESHOLD = 400;

interface ProjectModeInputProps {
  onSubmit: (args: { input: string; depth: PlanningDepth }) => void;
  disabled?: boolean;
  /**
   * True while a generation request is in flight. Shows a spinner +
   * "Generating…" on the submit button and disables the input + depth control.
   * Loading implies disabled; the input value is never cleared.
   */
  loading?: boolean;
  /**
   * Optional seed text for the input (Story 5.2 — the clarify flow's multistep
   * branch hands the inbox item's text here). Used only as the initial value;
   * the user can edit it freely.
   */
  initialInput?: string;
}

export default function ProjectModeInput({
  onSubmit,
  disabled = false,
  loading = false,
  initialInput = "",
}: ProjectModeInputProps) {
  const [input, setInput] = useState(initialInput);
  const [depth, setDepth] = useState<PlanningDepth>("minimal");
  const [validationError, setValidationError] = useState("");

  const inputId = useId();
  const errorId = useId();
  const counterId = useId();

  // Loading (a request in flight) implies the whole form is disabled.
  const isDisabled = disabled || loading;

  const trimmed = input.trim();
  const isEmpty = trimmed === "";
  const showCounter = input.length > COUNTER_THRESHOLD;
  const submitDisabled = isEmpty || isDisabled;

  const handleInputChange = (value: string) => {
    if (validationError) setValidationError("");
    setInput(value);
  };

  const handleAttemptSubmit = () => {
    if (isEmpty) {
      setValidationError("Enter a project first");
      return;
    }
    if (isDisabled) return;
    onSubmit({ input: trimmed, depth });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.nativeEvent.isComposing) {
      e.preventDefault();
      handleAttemptSubmit();
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div>
        <label htmlFor={inputId} className="sr-only">
          Describe your project
        </label>
        <input
          id={inputId}
          type="text"
          value={input}
          onChange={(e) => handleInputChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={PLACEHOLDER}
          maxLength={MAX_LENGTH}
          disabled={isDisabled}
          aria-describedby={
            [showCounter ? counterId : null, validationError ? errorId : null]
              .filter(Boolean)
              .join(" ") || undefined
          }
          className="min-h-[44px] w-full rounded-[var(--radius-sm)] border border-border bg-background px-4 py-3 text-text-primary placeholder:text-text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-[var(--color-focus-ring)] disabled:cursor-not-allowed disabled:opacity-60"
        />
        {showCounter && (
          <p
            id={counterId}
            aria-live="polite"
            className="mt-1 text-right text-[length:var(--font-size-small)] text-text-secondary"
          >
            {input.length} / {MAX_LENGTH}
          </p>
        )}
        {validationError && (
          <p
            id={errorId}
            role="alert"
            className="mt-1 text-[length:var(--font-size-small)] text-destructive"
          >
            {validationError}
          </p>
        )}
      </div>

      <DepthControl value={depth} onChange={setDepth} disabled={isDisabled} />

      <button
        type="button"
        onClick={handleAttemptSubmit}
        disabled={isDisabled}
        aria-disabled={submitDisabled ? "true" : undefined}
        aria-busy={loading ? "true" : undefined}
        className={`flex min-h-[44px] w-full items-center justify-center rounded-[var(--radius-sm)] px-6 py-3 font-bold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)] ${submitDisabled
          ? "cursor-not-allowed bg-primary/40 text-white/60"
          : "bg-primary text-white hover:bg-primary-hover motion-safe:transition-colors motion-safe:duration-150"
          }`}
      >
        {loading && (
          <span
            className="mr-2 inline-block h-4 w-4 motion-safe:animate-spin rounded-full border-2 border-white/40 border-t-white align-[-2px]"
            aria-hidden="true"
          />
        )}
        {loading ? "Generating…" : "Break it down"}
      </button>
    </div>
  );
}
