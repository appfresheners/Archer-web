/**
 * PhaseBar — presentational five-beat progress indicator for the weekly review
 * (Story 5.4). State-free: it renders whatever `current` phase the shell hands
 * it and holds no state of its own.
 *
 * This is deliberately NOT `WizardStepper` (which renders equal circles). The
 * phase bar uses five segments where the two snapshot beats are visually
 * narrower — they read as bookends around the three main beats:
 *   [Snapshot open]  Get Clear  Get Current  Get Creative  [Snapshot close]
 *
 * Fills by status (per the design tokens): active = `--color-step-active`
 * (primary), completed = `--color-step-complete` (emerald), upcoming =
 * `--color-step-upcoming` (gray).
 *
 * Accessibility (mirrors WizardStepper's contract so status is conveyed without
 * relying on colour):
 *   - `<nav aria-label="Weekly review progress">` wrapping an ordered list.
 *   - Each beat exposes `aria-label` like "Phase 2 of 5: Get Clear, current".
 *   - The active beat carries `aria-current="step"`.
 */

import {
  isBookend,
  PHASE_COUNT,
  PHASE_LABELS,
  phaseIndex,
  REVIEW_PHASES,
  type ReviewShellPhase,
} from "@/lib/review/phases";

interface PhaseBarProps {
  /** The beat the review is currently on. */
  current: ReviewShellPhase;
}

export default function PhaseBar({ current }: PhaseBarProps) {
  const currentIndex = phaseIndex(current);

  return (
    <nav aria-label="Weekly review progress">
      <ol className="flex items-stretch gap-2">
        {REVIEW_PHASES.map((phase, index) => {
          const isActive = index === currentIndex;
          const isComplete = index < currentIndex;
          const bookend = isBookend(phase);

          // Active takes precedence over complete for the announced status.
          const status = isActive
            ? "current"
            : isComplete
              ? "completed"
              : "upcoming";
          const label = `Phase ${index + 1} of ${PHASE_COUNT}: ${PHASE_LABELS[phase]}, ${status}`;

          const fillClass = isActive
            ? "bg-[var(--color-step-active)]"
            : isComplete
              ? "bg-[var(--color-step-complete)]"
              : "bg-[var(--color-step-upcoming)]";

          // Bookends are narrower (fixed basis); the three main beats grow to
          // fill the remaining width.
          const widthClass = bookend ? "flex-none basis-12" : "flex-1";

          const textClass =
            isActive || isComplete
              ? "text-[var(--color-text-inverse)]"
              : "text-text-muted";

          return (
            <li
              key={phase}
              aria-current={isActive ? "step" : undefined}
              aria-label={label}
              className={`flex min-h-8 items-center justify-center rounded-[var(--radius-sm)] px-2 py-1 ${widthClass} ${fillClass}`}
            >
              <span
                aria-hidden="true"
                className={`truncate text-[length:var(--font-size-small)] font-medium ${textClass}`}
              >
                {/* Bookends show the number only (narrow); main beats show the
                    label. Screen readers get the full label via aria-label. */}
                {bookend ? index + 1 : PHASE_LABELS[phase]}
              </span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
