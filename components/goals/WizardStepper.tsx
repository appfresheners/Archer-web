/**
 * WizardStepper — presentational progress indicator for the goal-creation
 * wizard (Story 3.1). State-free: it renders whatever the orchestrator
 * (`GoalWizard`) hands it and holds no wizard state of its own, so every step
 * story (3.3–3.6) shares the exact same indicator.
 *
 * Layout (per DESIGN.md "Wizard Stepper"):
 *   - Horizontal on desktop, vertical below 640px (`sm` breakpoint).
 *   - Four 32px circles connected by a line; the connector fills emerald as
 *     steps complete.
 *   - Complete = emerald fill + white checkmark; active = primary fill + white
 *     number; upcoming = gray fill + muted number.
 *   - Labels sit beneath each circle on desktop; hidden (number/checkmark only)
 *     on mobile.
 *
 * Accessibility:
 *   - Wrapped in `<nav aria-label="Goal creation progress">`.
 *   - The active node carries `aria-current="step"`.
 *   - Every node exposes an accessible label like "Step 2 of 4: Gap Rating"
 *     with a completion suffix so a screen reader conveys status without
 *     relying on colour.
 */

import type { ReactNode } from "react";

export interface WizardStepperItem {
  /** Stable step id (matches the wizard's `WizardStep.id`). */
  id: string;
  /** Human label, e.g. "Gap Rating". */
  label: string;
}

interface WizardStepperProps {
  steps: WizardStepperItem[];
  /** Index of the active step (0-based). */
  currentIndex: number;
  /** Indices of steps that are complete. */
  completedIndices: number[];
}

/** White checkmark glyph for a completed step (inline SVG, no icon library). */
function CheckIcon(): ReactNode {
  return (
    <svg
      width={16}
      height={16}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={3}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="m5 13 4 4L19 7" />
    </svg>
  );
}

export default function WizardStepper({
  steps,
  currentIndex,
  completedIndices,
}: WizardStepperProps) {
  const completed = new Set(completedIndices);
  const total = steps.length;

  return (
    <nav aria-label="Goal creation progress">
      <ol className="flex flex-col gap-0 sm:flex-row sm:items-start">
        {steps.map((step, index) => {
          const isComplete = completed.has(index);
          const isActive = index === currentIndex;
          const isLast = index === total - 1;

          // Status word for the accessible label so status is conveyed
          // without colour. Active takes precedence over complete for the
          // announcement of the current step.
          const status = isActive
            ? "current step"
            : isComplete
              ? "completed"
              : "upcoming";
          const nodeLabel = `Step ${index + 1} of ${total}: ${step.label}, ${status}`;

          // The connector after this node fills emerald once this step is
          // complete (progress has moved past it).
          const connectorComplete = isComplete;

          const circleClasses = isComplete
            ? "bg-[var(--color-step-complete)] text-[var(--color-text-inverse)]"
            : isActive
              ? "bg-[var(--color-step-active)] text-[var(--color-text-inverse)]"
              : "bg-[var(--color-step-upcoming)] text-text-muted";

          return (
            <li
              key={step.id}
              aria-current={isActive ? "step" : undefined}
              aria-label={nodeLabel}
              className="flex flex-1 flex-row items-start gap-3 sm:flex-col sm:items-center sm:gap-2 sm:text-center"
            >
              {/* Circle + connector row. On mobile the connector runs
                  vertically to the left of the label; on desktop it runs
                  horizontally between circles. */}
              <div className="flex flex-col items-center sm:w-full sm:flex-row">
                <span
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--radius-full)] text-[length:var(--font-size-small)] font-bold ${circleClasses}`}
                >
                  {isComplete ? (
                    <CheckIcon />
                  ) : (
                    <span aria-hidden="true">{index + 1}</span>
                  )}
                </span>

                {!isLast && (
                  <span
                    aria-hidden="true"
                    className={`${
                      connectorComplete
                        ? "bg-[var(--color-step-complete)]"
                        : "bg-border"
                    } my-1 h-6 w-0.5 sm:my-0 sm:ml-2 sm:h-0.5 sm:w-full`}
                  />
                )}
              </div>

              {/* Label: beneath the circle on desktop, hidden on mobile. */}
              <span
                className={`hidden text-[length:var(--font-size-small)] sm:block ${
                  isActive
                    ? "font-semibold text-text-primary"
                    : "text-text-secondary"
                }`}
              >
                {step.label}
              </span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
