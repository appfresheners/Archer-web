"use client";

/**
 * DepthControl — accessible single-select control for planning depth.
 *
 * Two options only: Minimal (the zero-friction default) and Full GTD. This is a
 * single-select from a fixed set, so it uses radiogroup semantics
 * (`role="radiogroup"` + `role="radio"` options with `aria-checked`) rather than
 * a tablist. It is a controlled, presentational component: it owns no depth
 * state itself, taking `value` and firing `onChange`, so a parent (Story 2.3)
 * can lift depth into the generation call without refactoring.
 *
 * Keyboard model (roving focus): the selected option is the only tab stop
 * (`tabIndex={0}`); ArrowLeft/ArrowRight (and Up/Down) move selection to the
 * other option, fire `onChange`, and move focus to follow selection.
 * Enter/Space (re)select the focused option. Each option is a ≥44×44px target
 * and uses design tokens so text/controls meet ≥4.5:1 contrast.
 */

import type { PlanningDepth } from "@/lib/supabase/schema";
import { useId, useRef } from "react";

interface DepthControlProps {
  value: PlanningDepth;
  onChange: (depth: PlanningDepth) => void;
  disabled?: boolean;
}

const OPTIONS: { value: PlanningDepth; label: string }[] = [
  { value: "minimal", label: "Minimal" },
  { value: "full_gtd", label: "Full GTD" },
];

export default function DepthControl({
  value,
  onChange,
  disabled = false,
}: DepthControlProps) {
  const labelId = useId();
  const minimalRef = useRef<HTMLButtonElement>(null);
  const fullRef = useRef<HTMLButtonElement>(null);

  const refFor = (depth: PlanningDepth) =>
    depth === "minimal" ? minimalRef : fullRef;

  const select = (depth: PlanningDepth) => {
    if (disabled) return;
    onChange(depth);
    refFor(depth).current?.focus();
  };

  const handleKeyDown = (
    e: React.KeyboardEvent<HTMLButtonElement>,
    optionValue: PlanningDepth,
  ) => {
    switch (e.key) {
      // Directional per the WAI-ARIA radiogroup pattern: previous / next.
      // (With two options these wrap, so on either end an arrow always lands
      // on the other option — but the direction is honored, not a blind toggle.)
      case "ArrowLeft":
      case "ArrowUp":
        e.preventDefault();
        select("minimal");
        break;
      case "ArrowRight":
      case "ArrowDown":
        e.preventDefault();
        select("full_gtd");
        break;
      case "Enter":
      case " ":
        e.preventDefault();
        select(optionValue);
        break;
    }
  };

  return (
    <div
      role="radiogroup"
      aria-labelledby={labelId}
      className="inline-flex rounded-[var(--radius-full)] border border-border bg-surface p-1"
    >
      <span id={labelId} className="sr-only">
        Planning depth
      </span>
      {OPTIONS.map((option) => {
        const isSelected = value === option.value;
        return (
          <button
            key={option.value}
            ref={refFor(option.value)}
            type="button"
            role="radio"
            aria-checked={isSelected}
            tabIndex={isSelected ? 0 : -1}
            disabled={disabled}
            onClick={() => select(option.value)}
            onKeyDown={(e) => handleKeyDown(e, option.value)}
            className={`flex min-h-[44px] min-w-[44px] cursor-pointer select-none items-center justify-center rounded-[var(--radius-full)] px-6 py-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)] disabled:cursor-not-allowed motion-safe:transition-colors motion-safe:duration-150 ${isSelected
                ? "bg-primary font-bold text-white"
                : "bg-transparent font-normal text-text-secondary"
              }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
