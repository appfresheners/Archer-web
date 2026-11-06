/**
 * Pure phase-list helpers for the daily shutdown flow (Story 10.1).
 *
 * The shutdown is a four-step sequence:
 *   inbox_check → progress_review → intention → termination
 *
 * Navigation is forward/back only through this ordered list: `nextPhase` /
 * `prevPhase` return the neighbour or `null` at the ends.
 */

/** The four navigable steps, in order. */
export const SHUTDOWN_PHASES = [
  "inbox_check",
  "progress_review",
  "intention",
  "termination",
] as const;

/** A phase the shutdown flow can be on. */
export type ShutdownPhase = (typeof SHUTDOWN_PHASES)[number];

/** Human-facing label per step, shown in the stepper bar and announcements. */
export const PHASE_LABELS: Record<ShutdownPhase, string> = {
  inbox_check: "Inbox Check",
  progress_review: "Today's Progress",
  intention: "Tomorrow's Intention",
  termination: "Complete Shutdown",
};

/** Total number of steps (4). */
export const PHASE_COUNT = SHUTDOWN_PHASES.length;

/**
 * 0-based index of a phase in the ordered list, or `-1` if it is not one of the
 * four steps.
 */
export function phaseIndex(phase: string): number {
  return (SHUTDOWN_PHASES as readonly string[]).indexOf(phase);
}

/**
 * The next step after `phase`, or `null` if `phase` is the last step
 * (`termination`) or not a step at all.
 */
export function nextPhase(phase: ShutdownPhase): ShutdownPhase | null {
  const i = phaseIndex(phase);
  if (i < 0 || i >= SHUTDOWN_PHASES.length - 1) return null;
  return SHUTDOWN_PHASES[i + 1];
}

/**
 * The previous step before `phase`, or `null` if `phase` is the first step
 * (`inbox_check`) or not a step at all.
 */
export function prevPhase(phase: ShutdownPhase): ShutdownPhase | null {
  const i = phaseIndex(phase);
  if (i <= 0) return null;
  return SHUTDOWN_PHASES[i - 1];
}
