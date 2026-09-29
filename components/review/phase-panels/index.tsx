/**
 * Middle phase placeholders for the weekly review shell (Story 5.4, refactored
 * in 5.5).
 *
 * 5.4 kept a static `PHASE_PANELS` element map for all five beats. 5.5 fills the
 * two SNAPSHOT bookends with props-driven panels (`SnapshotOpenPanel` /
 * `SnapshotClosePanel`) that receive the session's field values + handlers from
 * `ReviewShell`, so those two are rendered by the shell directly — not from a
 * static map. The three MIDDLE beats (Get Clear / Current / Creative) keep their
 * 5.4 placeholders here until Story 5.6 fills them, so the shell can still look
 * up `MIDDLE_PHASE_PANELS[phase]` for a middle beat.
 */

import { PHASE_LABELS } from "@/lib/review/phases";
import type { ReactNode } from "react";

/** The three middle beats that remain placeholders until Story 5.6. */
type MiddlePhase = "get_clear" | "get_current" | "get_creative";

/** Which later story fills each middle phase's real content. */
const PHASE_NOTE: Record<MiddlePhase, string> = {
  get_clear: "The Get Clear checklist arrives in Story 5.6.",
  get_current: "The Get Current review arrives in Story 5.6.",
  get_creative: "The Get Creative prompts arrives in Story 5.6.",
};

/**
 * Shared placeholder body for the middle beats. A single component keeps the
 * structure uniform; 5.6 can split it into per-phase files.
 */
function PlaceholderPanel({ phase }: { phase: MiddlePhase }): ReactNode {
  return (
    <div className="flex flex-col gap-2 rounded-[var(--radius-md)] border border-border bg-surface p-[var(--spacing-card-p)]">
      <h2 className="text-[length:var(--font-size-card)] font-semibold text-text-primary">
        {PHASE_LABELS[phase]}
      </h2>
      <p className="text-text-secondary">{PHASE_NOTE[phase]}</p>
    </div>
  );
}

/**
 * Map from a MIDDLE phase to its placeholder element. `ReviewShell` renders
 * `MIDDLE_PHASE_PANELS[phase]` for the three non-bookend beats; the two
 * snapshot bookends are rendered by the shell with props instead.
 */
export const MIDDLE_PHASE_PANELS: Record<MiddlePhase, ReactNode> = {
  get_clear: <PlaceholderPanel phase="get_clear" />,
  get_current: <PlaceholderPanel phase="get_current" />,
  get_creative: <PlaceholderPanel phase="get_creative" />,
};
