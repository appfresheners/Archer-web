"use client";

/**
 * WizardStep3 — the real Step 3 of the goal-creation wizard (Story 3.5),
 * mounted through the shell's step contract (see `GoalWizard.tsx`). It owns ONLY
 * Step 3 content; navigation and the advance gate stay with the shell.
 *
 * The self-assessment invariant (applied to Step 3):
 *   The AI never supplies or infers the user's drivers, barriers, or if–then
 *   plans. Every field starts blank — nothing is pre-filled or suggested. These
 *   are the user's own words, captured verbatim.
 *
 * What it owns:
 *   - The heading (via `headingRef`, the shell's focus-on-advance target).
 *   - Two multi-value groups (Drivers, Barriers), each rendered by the internal
 *     `MultiValueGroup`: a labelled add field (Add button + Enter-to-add) that
 *     appends a trimmed, non-empty value, and a removable list of entries.
 *     These write to `state.drivers` / `state.barriers` (string arrays) via
 *     `ctx.patchState`.
 *   - A multi-entry If–then group: each entry is an editable "If …" / "then I
 *     will …" pair composed into the canonical `If X, then I will Y` string via
 *     `composeIfThen` (an entry only persists while BOTH halves are filled), with
 *     an Add button to append a new pair and a Remove button per completed pair.
 *     The completed strings live in `state.ifThens` (a string array).
 *
 * The advance control ("Next: Review →") lives in the shell and is gated on
 * `drivers.length >= 1 && barriers.length >= 1 && ifThens.length >= 1`, so this
 * component never needs its own advance button.
 */

import type { StepContext } from "@/app/app/goals/new/GoalWizard";
import { useId, useRef, useState } from "react";

const MAX_LENGTH = 500;

/**
 * Compose the two if–then halves into the single canonical `ifThen` string.
 * Both parts must be non-empty (after trimming) or the result is `""` — this
 * keeps the shell gate a plain non-empty check and guarantees a partial plan is
 * treated as incomplete. Exported so the compose format is pinned by a unit
 * test and Step 4 / Pattern C can reproduce it verbatim.
 */
export function composeIfThen(ifPart: string, thenPart: string): string {
  const trimmedIf = ifPart.trim();
  const trimmedThen = thenPart.trim();
  if (trimmedIf === "" || trimmedThen === "") return "";
  return `If ${trimmedIf}, then I will ${trimmedThen}`;
}

const IF_PREFIX = "If ";
const THEN_SEP = ", then I will ";

/**
 * Best-effort inverse of `composeIfThen`, used to re-hydrate the two input
 * fields when Step 3 remounts (e.g. after Back-then-forward) so the user's
 * entered plan is visible again instead of two blank boxes — and so editing one
 * half doesn't recompose from an empty other half and silently wipe the plan.
 *
 * The composed string is always our own output, so splitting on the FIRST
 * `", then I will "` after the leading `"If "` round-trips it faithfully. If
 * the string doesn't match the format (empty, or hand-edited), both halves come
 * back empty — safe: the composed `ifThen` in shell state remains the source of
 * truth for Pattern C regardless.
 */
export function parseIfThen(composed: string): { ifPart: string; thenPart: string } {
  const empty = { ifPart: "", thenPart: "" };
  if (!composed.startsWith(IF_PREFIX)) return empty;
  const sepIndex = composed.indexOf(THEN_SEP, IF_PREFIX.length);
  if (sepIndex === -1) return empty;
  const ifPart = composed.slice(IF_PREFIX.length, sepIndex);
  const thenPart = composed.slice(sepIndex + THEN_SEP.length);
  if (ifPart === "" || thenPart === "") return empty;
  return { ifPart, thenPart };
}

interface WizardStep3Props {
  ctx: StepContext;
}

/**
 * A reusable blank multi-value list: a labelled add field with an Add button
 * (Enter also adds) that appends a trimmed non-empty value, plus a removable
 * row per existing value. Kept DRY across Drivers and Barriers.
 */
function MultiValueGroup({
  label,
  guidance,
  addLabel,
  placeholder,
  itemNoun,
  values,
  onChange,
}: {
  label: string;
  guidance: string;
  addLabel: string;
  placeholder: string;
  /** Singular noun used in remove labels, e.g. "driver" → "Remove driver: X". */
  itemNoun: string;
  values: string[];
  onChange: (next: string[]) => void;
}) {
  const [draft, setDraft] = useState("");
  const addInputId = useId();
  const guidanceId = useId();

  const trimmed = draft.trim();
  const addDisabled = trimmed === "";

  const handleAdd = () => {
    if (trimmed === "") return;
    onChange([...values, trimmed]);
    setDraft("");
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.nativeEvent.isComposing) {
      e.preventDefault();
      handleAdd();
    }
  };

  const handleRemove = (index: number) => {
    onChange(values.filter((_, i) => i !== index));
  };

  return (
    <section className="flex flex-col gap-3">
      <div>
        <label
          htmlFor={addInputId}
          className="block font-medium text-text-primary"
        >
          {label}
        </label>
        <p
          id={guidanceId}
          className="text-[length:var(--font-size-small)] text-text-secondary"
        >
          {guidance}
        </p>
      </div>

      {values.length > 0 && (
        <ul className="flex flex-col gap-2">
          {values.map((value, index) => (
            <li
              key={`${value}-${index}`}
              className="flex items-start justify-between gap-3 rounded-[var(--radius-md)] border border-border bg-background p-3"
            >
              <span className="text-text-primary">{value}</span>
              <button
                type="button"
                onClick={() => handleRemove(index)}
                aria-label={`Remove ${itemNoun}: ${value}`}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[var(--radius-sm)] border border-border text-text-secondary hover:bg-destructive-subtle hover:text-destructive focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)]"
              >
                <span aria-hidden="true" className="text-lg leading-none">
                  ×
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex items-end gap-2">
        <div className="flex-1">
          <input
            id={addInputId}
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            maxLength={MAX_LENGTH}
            aria-describedby={guidanceId}
            className="min-h-[44px] w-full rounded-[var(--radius-sm)] border border-border bg-background px-4 py-3 text-text-primary placeholder:text-text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-[var(--color-focus-ring)]"
          />
        </div>
        <button
          type="button"
          onClick={handleAdd}
          disabled={addDisabled}
          aria-disabled={addDisabled ? "true" : undefined}
          className={`min-h-[44px] shrink-0 rounded-[var(--radius-sm)] border border-border px-6 py-2 font-medium text-text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)] ${addDisabled
            ? "cursor-not-allowed opacity-40"
            : "hover:bg-primary-subtle motion-safe:transition-colors"
            }`}
        >
          {addLabel}
        </button>
      </div>
    </section>
  );
}

/** One editable if–then pair (an "If …" input + a "then I will …" input). */
interface IfThenPair {
  id: number;
  ifPart: string;
  thenPart: string;
}

function IfThenEntry({
  index,
  pair,
  guidanceId,
  onChange,
  onRemove,
}: {
  index: number;
  pair: IfThenPair;
  guidanceId: string;
  onChange: (id: number, field: "ifPart" | "thenPart", value: string) => void;
  onRemove: (id: number) => void;
}) {
  const ifInputId = useId();
  const thenInputId = useId();
  const composed = composeIfThen(pair.ifPart, pair.thenPart);
  const isComplete = composed !== "";

  return (
    <li className="flex flex-col gap-3 rounded-[var(--radius-md)] border border-border bg-background p-3">
      <div className="flex items-center justify-between gap-3">
        <span className="text-[length:var(--font-size-small)] font-medium text-text-secondary">
          Plan {index + 1}
        </span>
        {isComplete && (
          <button
            type="button"
            onClick={() => onRemove(pair.id)}
            aria-label={`Remove if–then: ${composed}`}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[var(--radius-sm)] border border-border text-text-secondary hover:bg-destructive-subtle hover:text-destructive focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)]"
          >
            <span aria-hidden="true" className="text-lg leading-none">
              ×
            </span>
          </button>
        )}
      </div>

      <div className="flex flex-col gap-4 sm:flex-row">
        <div className="flex flex-1 flex-col gap-1">
          <label
            htmlFor={ifInputId}
            className="mb-1 block text-[length:var(--font-size-small)] font-medium text-text-primary"
          >
            If … <span className="sr-only">(plan {index + 1})</span>
          </label>
          <input
            id={ifInputId}
            type="text"
            value={pair.ifPart}
            onChange={(e) => onChange(pair.id, "ifPart", e.target.value)}
            placeholder="e.g., it is 7am on a weekday"
            maxLength={MAX_LENGTH}
            aria-describedby={guidanceId}
            className="min-h-[44px] w-full rounded-[var(--radius-sm)] border border-border bg-background px-4 py-3 text-text-primary placeholder:text-text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-[var(--color-focus-ring)]"
          />
        </div>
        <div className="flex flex-1 flex-col gap-1">
          <label
            htmlFor={thenInputId}
            className="mb-1 block text-[length:var(--font-size-small)] font-medium text-text-primary"
          >
            then I will … <span className="sr-only">(plan {index + 1})</span>
          </label>
          <input
            id={thenInputId}
            type="text"
            value={pair.thenPart}
            onChange={(e) => onChange(pair.id, "thenPart", e.target.value)}
            placeholder="e.g., practise for 10 minutes before checking my phone"
            maxLength={MAX_LENGTH}
            className="min-h-[44px] w-full rounded-[var(--radius-sm)] border border-border bg-background px-4 py-3 text-text-primary placeholder:text-text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-[var(--color-focus-ring)]"
          />
        </div>
      </div>
    </li>
  );
}

export default function WizardStep3({ ctx }: WizardStep3Props) {
  const { state, patchState, headingRef } = ctx;
  const { drivers, barriers, ifThens } = state;

  // The if–then pairs live locally; the composed strings are the source of
  // truth in `state.ifThens`. Lazily hydrate the pairs FROM those composed
  // values on mount so a Back-then-forward return shows the entered plans (not
  // blank boxes). On a first visit `state.ifThens` is [] → no pairs (no
  // pre-fill, invariant intact).
  const [pairs, setPairs] = useState<IfThenPair[]>(() =>
    ifThens.map((composed, index) => ({
      id: index,
      ifPart: parseIfThen(composed).ifPart,
      thenPart: parseIfThen(composed).thenPart,
    })),
  );
  // Monotonically-increasing id for newly added pairs (initial ids are the
  // array indices, which are unique; the counter continues past them).
  const nextIdRef = useRef(ifThens.length);

  const ifThenGuidanceId = useId();

  /**
   * Write the next pair list to local state AND recompose it into
   * `state.ifThens` — only pairs with both halves filled survive (partial
   * pairs compose to `""` and are filtered out), so the shell gate
   * (`ifThens.length >= 1`) is exactly "at least one complete plan".
   */
  const sync = (next: IfThenPair[]) => {
    setPairs(next);
    patchState({
      ifThens: next
        .map((p) => composeIfThen(p.ifPart, p.thenPart))
        .filter((c) => c !== ""),
    });
  };

  const updatePair = (
    id: number,
    field: "ifPart" | "thenPart",
    value: string,
  ) => {
    sync(pairs.map((p) => (p.id === id ? { ...p, [field]: value } : p)));
  };

  const removePair = (id: number) => {
    sync(pairs.filter((p) => p.id !== id));
  };

  const addPair = () => {
    sync([...pairs, { id: nextIdRef.current++, ifPart: "", thenPart: "" }]);
  };

  return (
    <div className="flex flex-col gap-6">
      <h2
        ref={headingRef}
        tabIndex={-1}
        className="text-[length:var(--font-size-subheading)] font-bold text-text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)]"
      >
        Drivers &amp; Barriers
      </h2>

      <p className="text-[length:var(--font-size-small)] text-text-secondary">
        These are your own words — nothing here is suggested or filled in for
        you. Add the strengths already working for you, the obstacles that get
        in your way, and one or more if–then plans to help you follow through.
      </p>

      <MultiValueGroup
        label="Drivers"
        guidance="An internal strength already working for you"
        addLabel="Add driver"
        placeholder="e.g., I stay disciplined once I start a routine"
        itemNoun="driver"
        values={drivers}
        onChange={(next) => patchState({ drivers: next })}
      />

      <MultiValueGroup
        label="Barriers"
        guidance="What actually gets in the way"
        addLabel="Add barrier"
        placeholder="e.g., I lose momentum when my evenings get busy"
        itemNoun="barrier"
        values={barriers}
        onChange={(next) => patchState({ barriers: next })}
      />

      <section className="flex flex-col gap-3">
        <div>
          <h3 className="font-medium text-text-primary">If–then plans</h3>
          <p
            id={ifThenGuidanceId}
            className="text-[length:var(--font-size-small)] text-text-secondary"
          >
            Implementation intentions: for each one, name the situation and the
            single action you&apos;ll take when it happens.
          </p>
        </div>

        {pairs.length > 0 && (
          <ul className="flex flex-col gap-3">
            {pairs.map((pair, index) => (
              <IfThenEntry
                key={pair.id}
                index={index}
                pair={pair}
                guidanceId={ifThenGuidanceId}
                onChange={updatePair}
                onRemove={removePair}
              />
            ))}
          </ul>
        )}

        <div>
          <button
            type="button"
            onClick={addPair}
            className="inline-flex min-h-[44px] items-center rounded-[var(--radius-sm)] border border-border px-6 py-2 font-medium text-text-primary hover:bg-primary-subtle focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)] motion-safe:transition-colors"
          >
            Add if–then plan
          </button>
        </div>
      </section>
    </div>
  );
}
