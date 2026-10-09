"use client";

/**
 * ProjectModeInput — the Project Mode entry surface (client component).
 *
 * Offers an explicit "Generate with AI" / "Create manually" choice, with AI
 * selected by default so the existing generation flow behaves as before.
 *
 * AI mode is the single text input (canonical placeholder, `maxLength={500}`),
 * a Minimal/Full-GTD `DepthControl` (Minimal preselected), and a "Break it
 * down" submit button — unchanged. Enter and clicking the button are
 * equivalent submit paths; empty/whitespace input blocks submission with an
 * inline error and no `onSubmit`.
 *
 * Manual mode collects a required project name plus optional purpose,
 * successful outcome, and either a parent goal or direct Area, then calls
 * `onManualSubmit` on "Create project". No AI request is made in manual mode.
 *
 * Generation/saving/navigation are out of scope here: `onSubmit` and
 * `onManualSubmit` are thin, replaceable seams supplied by the parent, and
 * `disabled`/`loading`/`manualSaving` reflect in-flight states the parent
 * drives.
 */

import { MAX_PROJECT_TEXT } from "@/lib/projects/validate";
import type { PlanningDepth } from "@/lib/supabase/schema";
import AreaSelect, { type AreaOption } from "@/components/focus/AreaSelect";
import { useId, useState } from "react";
import DepthControl from "./DepthControl";

const PLACEHOLDER = "e.g., Personal portfolio website deployed online";
const MAX_LENGTH = 500;
const COUNTER_THRESHOLD = 400;

export type CreationMode = "ai" | "manual";

/** A goal option shown in the manual parent-goal picker. */
export interface GoalOption {
  id: string;
  goal_text: string;
}

/** The typed manual-create payload emitted by this component. */
export interface ManualProjectArgs {
  name: string;
  purpose: string;
  successfulOutcome: string;
  goalId: string | null;
  areaId: string | null;
}

interface ProjectModeInputProps {
  onSubmit: (args: { input: string; depth: PlanningDepth; areaId: string | null }) => void;
  /**
   * Manual create submit (Story 2.7). Optional so AI-only consumers keep
   * working; defaults to a no-op.
   */
  onManualSubmit?: (args: ManualProjectArgs) => void;
  disabled?: boolean;
  /**
   * True while an AI generation request is in flight. Shows a spinner +
   * "Generating…" on the AI submit button and disables the whole form.
   * Loading implies disabled; the input value is never cleared.
   */
  loading?: boolean;
  /** True while a manual create request is in flight (shows "Saving…"). */
  manualSaving?: boolean;
  /**
   * Optional seed text for the AI input and the manual name (Story 5.2 — the
   * clarify flow's multistep branch hands the inbox item's text here). Used
   * only as the initial value; the user can edit it freely.
   */
  initialInput?: string;
  /** The signed-in user's goals, shown as options in the manual parent picker. */
  goals?: GoalOption[];
  areas?: AreaOption[];
}

const MODE_OPTIONS: { value: CreationMode; label: string }[] = [
  { value: "ai", label: "Generate with AI" },
  { value: "manual", label: "Create manually" },
];

export default function ProjectModeInput({
  onSubmit,
  onManualSubmit = () => {},
  disabled = false,
  loading = false,
  manualSaving = false,
  initialInput = "",
  goals = [],
  areas = [],
}: ProjectModeInputProps) {
  const [mode, setMode] = useState<CreationMode>("ai");

  // AI state.
  const [input, setInput] = useState(initialInput);
  const [depth, setDepth] = useState<PlanningDepth>("minimal");
  const [validationError, setValidationError] = useState("");

  // Manual state. `name` is seeded with `initialInput` so the clarify hand-off
  // preserves the inbox item's text even when the user chooses manual mode.
  const [name, setName] = useState(initialInput);
  const [nameError, setNameError] = useState("");
  const [purpose, setPurpose] = useState("");
  const [successfulOutcome, setSuccessfulOutcome] = useState("");
  const [goalId, setGoalId] = useState("");
  const [areaId, setAreaId] = useState("");

  const inputId = useId();
  const errorId = useId();
  const counterId = useId();
  const nameId = useId();
  const nameErrorId = useId();
  const purposeId = useId();
  const outcomeId = useId();
  const goalFieldId = useId();

  // Loading (either kind of request in flight) implies the whole form is
  // disabled.
  const isDisabled = disabled || loading || manualSaving;

  // AI validation state.
  const trimmed = input.trim();
  const isEmpty = trimmed === "";
  const showCounter = input.length > COUNTER_THRESHOLD;
  const aiSubmitDisabled = isEmpty || isDisabled;

  // Manual validation state.
  const trimmedName = name.trim();
  const nameMissing = trimmedName === "";
  const manualSubmitDisabled = nameMissing || isDisabled;

  const handleModeChange = (next: CreationMode) => {
    if (isDisabled) return;
    setMode(next);
  };

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
    onSubmit({ input: trimmed, depth, areaId: areaId || null });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.nativeEvent.isComposing) {
      e.preventDefault();
      handleAttemptSubmit();
    }
  };

  const handleManualSubmit = () => {
    if (nameMissing) {
      setNameError("Enter a project name");
      return;
    }
    if (isDisabled) return;
    onManualSubmit({
      name: trimmedName,
      purpose: purpose.trim(),
      successfulOutcome: successfulOutcome.trim(),
      goalId: goalId === "" ? null : goalId,
      areaId: goalId === "" ? areaId || null : null,
    });
  };

  const textFieldClass =
    "min-h-[44px] w-full rounded-[var(--radius-sm)] border border-border bg-background px-4 py-3 text-text-primary placeholder:text-text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-[var(--color-focus-ring)] disabled:cursor-not-allowed disabled:opacity-60";
  const fieldLabelClass =
    "mb-1 block text-[length:var(--font-size-small)] font-medium text-text-secondary";

  return (
    <div className="flex flex-col gap-4">
      {/* AI / manual mode selector (Story 2.7). AI is the default. */}
      <fieldset className="inline-flex self-start rounded-[var(--radius-full)] border border-border bg-surface p-1">
        <legend className="sr-only">How to create this project</legend>
        {MODE_OPTIONS.map((option) => {
          const isSelected = mode === option.value;
          return (
            <label
              key={option.value}
              className={`flex min-h-[44px] cursor-pointer select-none items-center justify-center rounded-[var(--radius-full)] px-6 py-3 focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-[var(--color-focus-ring)] motion-safe:transition-colors motion-safe:duration-150 ${
                isSelected
                  ? "bg-primary font-bold text-white"
                  : "bg-transparent font-normal text-text-secondary"
              } ${isDisabled ? "cursor-not-allowed opacity-60" : ""}`}
            >
              <input
                type="radio"
                name="creation-mode"
                value={option.value}
                checked={isSelected}
                disabled={isDisabled}
                onChange={() => handleModeChange(option.value)}
                className="sr-only"
              />
              {option.label}
            </label>
          );
        })}
      </fieldset>

      {mode === "manual" ? (
        <div className="flex flex-col gap-4">
          <div>
            <label htmlFor={nameId} className={fieldLabelClass}>
              Project name <span aria-hidden="true">*</span>
            </label>
            <input
              id={nameId}
              type="text"
              value={name}
              onChange={(e) => {
                if (nameError) setNameError("");
                setName(e.target.value);
              }}
              placeholder="e.g., Launch a newsletter"
              maxLength={200}
              disabled={isDisabled}
              aria-required="true"
              aria-describedby={nameError ? nameErrorId : undefined}
              className={textFieldClass}
            />
            {nameError && (
              <p
                id={nameErrorId}
                role="alert"
                className="mt-1 text-[length:var(--font-size-small)] text-destructive"
              >
                {nameError}
              </p>
            )}
          </div>

          {!goalId && (
            <AreaSelect
              id="manual-project-area"
              value={areaId}
              areas={areas}
              disabled={isDisabled}
              onChange={setAreaId}
            />
          )}

          <div>
            <label htmlFor={purposeId} className={fieldLabelClass}>
              Purpose (optional)
            </label>
            <input
              id={purposeId}
              type="text"
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              placeholder="Why this project matters"
              maxLength={MAX_PROJECT_TEXT}
              disabled={isDisabled}
              className={textFieldClass}
            />
          </div>

          <div>
            <label htmlFor={outcomeId} className={fieldLabelClass}>
              Successful outcome (optional)
            </label>
            <input
              id={outcomeId}
              type="text"
              value={successfulOutcome}
              onChange={(e) => setSuccessfulOutcome(e.target.value)}
              placeholder="What done looks like"
              maxLength={MAX_PROJECT_TEXT}
              disabled={isDisabled}
              className={textFieldClass}
            />
          </div>

          <div>
            <label htmlFor={goalFieldId} className={fieldLabelClass}>
              Parent goal (optional)
            </label>
            <select
              id={goalFieldId}
              value={goalId}
              onChange={(e) => {
                setGoalId(e.target.value);
                if (e.target.value !== "") setAreaId("");
              }}
              disabled={isDisabled}
              className={textFieldClass}
            >
              <option value="">No parent goal</option>
              {goals.map((goal) => (
                <option key={goal.id} value={goal.id}>
                  {goal.goal_text}
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            onClick={handleManualSubmit}
            disabled={isDisabled}
            aria-busy={manualSaving ? "true" : undefined}
            className={`flex min-h-[44px] w-full items-center justify-center rounded-[var(--radius-sm)] px-6 py-3 font-bold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)] ${
              manualSubmitDisabled
                ? "cursor-not-allowed bg-primary/40 text-white/60"
                : "bg-primary text-white hover:bg-primary-hover motion-safe:transition-colors motion-safe:duration-150"
            }`}
          >
            {manualSaving && (
              <span
                className="mr-2 inline-block h-4 w-4 motion-safe:animate-spin rounded-full border-2 border-white/40 border-t-white align-[-2px]"
                aria-hidden="true"
              />
            )}
            {manualSaving ? "Saving…" : "Create project"}
          </button>
        </div>
      ) : (
        <>
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
                [
                  showCounter ? counterId : null,
                  validationError ? errorId : null,
                ]
                  .filter(Boolean)
                  .join(" ") || undefined
              }
              className={textFieldClass}
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

          <AreaSelect
            id="ai-project-area"
            value={areaId}
            areas={areas}
            disabled={isDisabled}
            onChange={setAreaId}
          />

          <button
            type="button"
            onClick={handleAttemptSubmit}
            disabled={isDisabled}
            aria-busy={loading ? "true" : undefined}
            className={`flex min-h-[44px] w-full items-center justify-center rounded-[var(--radius-sm)] px-6 py-3 font-bold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)] ${
              aiSubmitDisabled
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
        </>
      )}
    </div>
  );
}
