/**
 * ShutdownBar — presentational four-step progress indicator for the daily
 * shutdown flow (Story 10.1). State-free: it renders whatever `current` phase
 * the flow hands it and holds no state of its own.
 *
 * Layout: Horizontal bar with four equal-width segments. Fills by status:
 *   - active = `--color-step-active` (primary)
 *   - completed = `--color-step-complete` (emerald)
 *   - upcoming = `--color-step-upcoming` (gray)
 *
 * Accessibility (mirrors PhaseBar's contract so status is conveyed without
 * relying on colour):
 *   - `<nav aria-label="Daily shutdown progress">` wrapping an ordered list.
 *   - Each step exposes `aria-label` like "Step 2 of 4: Today's Progress, current".
 *   - The active step carries `aria-current="step"`.
 */

import {
  PHASE_COUNT,
  PHASE_LABELS,
  phaseIndex,
  SHUTDOWN_PHASES,
  type ShutdownPhase,
} from "@/lib/shutdown/phases";

interface ShutdownBarProps {
  /** The step the shutdown is currently on. */
  current: ShutdownPhase;
}

export default function ShutdownBar({ current }: ShutdownBarProps) {
  const currentIndex = phaseIndex(current);

  return (
    <nav aria-label="Daily shutdown progress">
      <ol className="flex items-stretch gap-2">
        {SHUTDOWN_PHASES.map((phase, index) => {
          const isActive = index === currentIndex;
          const isComplete = index < currentIndex;

          // Active takes precedence over complete for the announced status.
          const status = isActive
            ? "current"
            : isComplete
              ? "completed"
              : "upcoming";
          const label = `Step ${index + 1} of ${PHASE_COUNT}: ${PHASE_LABELS[phase]}, ${status}`;

          const fillClass = isActive
            ? "bg-[var(--color-step-active)]"
            : isComplete
              ? "bg-[var(--color-step-complete)]"
              : "bg-[var(--color-step-upcoming)]";

          const textClass =
            isActive || isComplete
              ? "text-[var(--color-text-inverse)]"
              : "text-text-muted";

          return (
            <li
              key={phase}
              aria-current={isActive ? "step" : undefined}
              aria-label={label}
              className={`flex flex-1 min-h-8 items-center justify-center rounded-[var(--radius-sm)] px-2 py-1 ${fillClass}`}
            >
              <span
                aria-hidden="true"
                className={`truncate text-[length:var(--font-size-small)] font-medium ${textClass}`}
              >
                {PHASE_LABELS[phase]}
              </span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
