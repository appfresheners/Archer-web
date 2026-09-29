/**
 * Placeholder phase panels for the weekly review shell (Story 5.4).
 *
 * Each of the five beats renders a titled placeholder with a short note about
 * what fills it next (5.5 = snapshot fields, 5.6 = Get Clear/Current/Creative
 * content). The panels are intentionally thin and self-contained so 5.5/5.6 can
 * replace an individual panel body without touching `ReviewShell` — the shell
 * only looks up `PHASE_PANELS[phase]` and renders it.
 */

import { PHASE_LABELS, type ReviewShellPhase } from "@/lib/review/phases";
import type { ReactNode } from "react";

/** Which later story fills each phase's real content. */
const PHASE_NOTE: Record<ReviewShellPhase, string> = {
  snapshot_open: "The opening snapshot fields arrive in Story 5.5.",
  get_clear: "The Get Clear checklist arrives in Story 5.6.",
  get_current: "The Get Current review arrives in Story 5.6.",
  get_creative: "The Get Creative prompts arrive in Story 5.6.",
  snapshot_close: "The closing snapshot fields arrive in Story 5.5.",
};

/**
 * Shared placeholder body. A single component drives all five panels so the
 * structure is uniform; 5.5/5.6 can split this into per-phase files if a phase
 * needs bespoke content.
 */
function PlaceholderPanel({ phase }: { phase: ReviewShellPhase }): ReactNode {
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
 * Map from phase to its panel element. `ReviewShell` renders
 * `PHASE_PANELS[current]`.
 */
export const PHASE_PANELS: Record<ReviewShellPhase, ReactNode> = {
  snapshot_open: <PlaceholderPanel phase="snapshot_open" />,
  get_clear: <PlaceholderPanel phase="get_clear" />,
  get_current: <PlaceholderPanel phase="get_current" />,
  get_creative: <PlaceholderPanel phase="get_creative" />,
  snapshot_close: <PlaceholderPanel phase="snapshot_close" />,
};
