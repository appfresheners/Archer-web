"use client";

/**
 * GoalWizard — the client orchestrator for the four-step goal-creation wizard
 * (Story 3.1). This is the shell that Stories 3.3–3.6 plug step content into;
 * it owns navigation, gating, and transient state, but no step-content logic.
 *
 * What it owns:
 *   - `WizardState`: all step data as optional fields (goalText, why, framework,
 *     drivers, barriers, ifThens). Self-assessment ratings live inline on each
 *     framework item as `user_rating` (Step 2), so there is no separate ratings
 *     map. Later stories populate their slices.
 *   - A `steps` config: each step declares an id, a label, an `isComplete`
 *     gate predicate (the rule to advance FROM that step), and a `render`
 *     function (placeholder panels this story).
 *   - Navigation: `advance()` moves forward only when the current step's gate
 *     passes; `back()` moves backward. Skip-ahead is impossible because the
 *     only forward path is the gated `advance()` and stepper nodes are not
 *     interactive.
 *   - Framework invalidation: changing Step 1's goal text clears the framework
 *     and resets any completion that depended on it (the wizard collapses back
 *     to Step 1's own gate).
 *   - Focus management: after `advance()`/`back()`, focus moves to the new
 *     panel's first focusable element, else its heading (`tabIndex={-1}`).
 *
 * State is transient React state only — no localStorage, no Supabase, no
 * auto-save, no recovery. Abandoning the wizard discards everything.
 */

import WizardStep1 from "@/components/goals/WizardStep1";
import WizardStep2 from "@/components/goals/WizardStep2";
import WizardStep3 from "@/components/goals/WizardStep3";
import WizardStep4 from "@/components/goals/WizardStep4";
import WizardStepper from "@/components/goals/WizardStepper";
import type { ReactNode } from "react";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

/**
 * Skill-framework item shape, aligned to the persisted canonical schema
 * (`SkillFrameworkItem` in lib/supabase/schema.ts) so no rename is needed
 * downstream (Story 3.4 / Pattern C). The AI (Pattern B, Story 3.2) supplies
 * only the Target Profile — `name`, `required_level`, `description`. The user's
 * self-assessment `user_rating` is collected in Step 2 (Story 3.4), so it is
 * optional here and Step 1 never sets it.
 */
export interface SkillFrameworkItem {
  name: string;
  required_level: number;
  description: string;
  user_rating?: number;
}

/**
 * All wizard step data. Fields are optional; later stories populate their
 * slices. Only `goalText` + `framework` are wired this story.
 */
export interface WizardState {
  goalText: string;
  why: string;
  framework: SkillFrameworkItem[] | null;
  drivers: string[];
  barriers: string[];
  ifThens: string[];
}

/** Context handed to each step's `render` so it can read/update wizard state. */
export interface StepContext {
  state: WizardState;
  /** Update Step 1 goal text; clears the framework when the text changes. */
  setGoalText: (text: string) => void;
  /** Update the user's reason for pursuing the goal; invalidates its framework. */
  setGoalWhy: (why: string) => void;
  /**
   * Generic state patcher for a step to write its own slice (e.g. Step 1 sets
   * `framework` after a successful Pattern B fetch). Goal text must still go
   * through `setGoalText` so the framework-invalidation contract stays
   * authoritative — do not route `goalText` through `patchState`.
   */
  patchState: (partial: Partial<WizardState>) => void;
  /**
   * Jump directly to another step by index. Gated: back-navigation is always
   * allowed, but a forward jump is only permitted when every step BEFORE the
   * target has its gate satisfied (so an Edit link can't skip past an unmet
   * gate). A blocked forward jump is a no-op. Used by Step 4's "Edit" links.
   */
  goToStep: (index: number) => void;
  /** First-interactive ref target for focus-on-advance. */
  headingRef: React.RefObject<HTMLHeadingElement | null>;
}

export interface WizardStep {
  id: "goal" | "gap" | "drivers" | "review";
  label: string;
  /** Gate to advance FROM this step. */
  isComplete: (s: WizardState) => boolean;
  /**
   * Label for the shell's advance button while on this step (e.g. Step 1's
   * "Next: Rate yourself →" per the epics AC). Falls back to "Next". Kept in
   * the shell so steps declare their own copy without forking navigation.
   */
  nextLabel?: string;
  render: (ctx: StepContext) => ReactNode;
}

const INITIAL_STATE: WizardState = {
  goalText: "",
  why: "",
  framework: null,
  drivers: [],
  barriers: [],
  ifThens: [],
};

/**
 * Pure state transition for a Step 1 goal-text change. Exported so the
 * framework-invalidation contract can be unit-tested directly — the shell has
 * no UI to set a non-null framework yet (that arrives with Stories 3.2/3.3),
 * so the invalidation branch would otherwise be untestable through the DOM.
 *
 * Rules:
 *   - No change → same reference (lets React bail out of a re-render).
 *   - No framework yet → just update the text.
 *   - Framework present → invalidate it, since a framework built for the old
 *     goal must not survive a goal edit. Ratings now live inline on each
 *     framework item (`user_rating`), so clearing the framework clears them
 *     too — there is no separate ratings map to reset. Drivers, barriers, and
 *     the if–then plan are the user's own words (Step 3) and are NOT derived
 *     from the framework, so they are intentionally preserved.
 */
export function applyGoalText(prev: WizardState, text: string): WizardState {
  if (prev.goalText === text) return prev;
  if (prev.framework === null) {
    return { ...prev, goalText: text };
  }
  return { ...prev, goalText: text, framework: null };
}

export function applyGoalWhy(prev: WizardState, why: string): WizardState {
  if (prev.why === why) return prev;
  if (prev.framework === null) return { ...prev, why };
  return { ...prev, why, framework: null };
}

/**
 * Step configuration. Step 1's gate is the one stable rule from epics.md:
 * non-empty trimmed goal text. Steps 2–4 use a neutral placeholder gate
 * (always-true) until their stories tighten them — this story provides the
 * gating mechanism, not the real rules.
 */
const STEPS: WizardStep[] = [
  {
    id: "goal",
    label: "Goal & Skill Framework",
    // Advance from Step 1 requires non-empty goal text AND a framework that has
    // returned with at least 3 items remaining (per epics.md / EXPERIENCE.md).
    // The framework must be fetched (Pattern B) before Step 2 is reachable.
    isComplete: (s) =>
      s.goalText.trim().length > 0 &&
      s.why.trim().length > 0 &&
      (s.framework?.length ?? 0) >= 3,
    nextLabel: "Next: Rate yourself →",
    render: (ctx) => <WizardStep1 ctx={ctx} />,
  },
  {
    id: "gap",
    label: "Gap Rating",
    // Advance from Step 2 requires a framework whose every item carries a
    // numeric `user_rating`. Step 2 seeds each item to the neutral midpoint 5
    // on entry, so this gate is satisfiable by confirmation-at-default while
    // still reflecting real, user-owned values.
    isComplete: (s) =>
      (s.framework?.length ?? 0) > 0 &&
      (s.framework?.every((item) => typeof item.user_rating === "number") ??
        false),
    nextLabel: "Next: Drivers & Barriers →",
    render: (ctx) => <WizardStep2 ctx={ctx} />,
  },
  {
    id: "drivers",
    label: "Drivers & Barriers",
    // Advance from Step 3 requires the user's own inputs: at least one driver,
    // at least one barrier, and at least one complete if–then plan. Each plan
    // is a composed string added only when BOTH halves are filled (see
    // `composeIfThen` in WizardStep3), so a non-empty `ifThens` array is
    // exactly "at least one complete plan" — the gate stays a simple length
    // check.
    isComplete: (s) =>
      s.drivers.length >= 1 &&
      s.barriers.length >= 1 &&
      s.ifThens.length >= 1,
    nextLabel: "Next: Review →",
    render: (ctx) => <WizardStep3 ctx={ctx} />,
  },
  {
    id: "review",
    label: "Review & Generate",
    // Step 4 is the last step: it generates rather than advancing, so there is
    // no forward gate to satisfy. The shell disables its advance button on the
    // last step (`isLastStep`).
    isComplete: () => true,
    render: (ctx) => <WizardStep4 ctx={ctx} />,
  },
];

export default function GoalWizard() {
  const [state, setState] = useState<WizardState>(INITIAL_STATE);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [completed, setCompleted] = useState<number[]>([]);

  // The active step's heading — the focus fallback when the panel has no
  // first-focusable interactive element.
  const headingRef = useRef<HTMLHeadingElement | null>(null);
  // The panel wrapper — searched for a first-focusable element on advance/back.
  const panelRef = useRef<HTMLDivElement | null>(null);
  // Move focus only in response to a navigation action, never on initial mount
  // or on unrelated re-renders (e.g. typing in the goal input).
  const shouldFocusRef = useRef(false);

  const currentStep = STEPS[currentIndex];
  const canAdvance = currentStep.isComplete(state);
  const isLastStep = currentIndex === STEPS.length - 1;

  /**
   * Update Step 1 goal text. When the text actually changes, the skill
   * framework is invalidated (cleared) and any completion that depended on it
   * is reset — the wizard collapses back to Step 1's own gate so later steps
   * cannot claim completion off a stale framework.
   */
  const setGoalText = useCallback((text: string) => {
    setState((prev) => applyGoalText(prev, text));
    // Any prior completion is reset when the goal changes: the wizard collapses
    // back to Step 1's own gate. Cheap no-op when nothing was completed.
    setCompleted((prev) => (prev.length === 0 ? prev : []));
  }, []);

  const setGoalWhy = useCallback((why: string) => {
    setState((prev) => applyGoalWhy(prev, why));
    setCompleted((prev) => (prev.length === 0 ? prev : []));
  }, []);

  /**
   * Generic state patcher a step uses to write its own slice (Step 1 sets
   * `framework` here after a successful Pattern B fetch). Goal text is NOT
   * routed through this — it must go through `setGoalText` so the
   * framework-invalidation contract stays authoritative.
   */
  const patchState = useCallback((partial: Partial<WizardState>) => {
    setState((prev) => ({ ...prev, ...partial }));
  }, []);

  const advance = useCallback(() => {
    // Keep the state updaters pure (no side effects inside them) so React
    // StrictMode's double-invoke can't desync completion/focus. Decide the
    // transition from current values, then apply all state changes.
    if (currentIndex >= STEPS.length - 1) return;
    if (!STEPS[currentIndex].isComplete(state)) return;
    setCompleted((prev) =>
      prev.includes(currentIndex) ? prev : [...prev, currentIndex],
    );
    shouldFocusRef.current = true;
    setCurrentIndex(currentIndex + 1);
  }, [currentIndex, state]);

  const back = useCallback(() => {
    if (currentIndex <= 0) return;
    shouldFocusRef.current = true;
    setCurrentIndex(currentIndex - 1);
  }, [currentIndex]);

  /**
   * Jump directly to `index` (used by Step 4's per-section "Edit" links).
   * Back-navigation (index < current) is always allowed. A forward jump is only
   * permitted when every step BEFORE the target satisfies its gate, so a jump
   * can never land past an unmet gate. Out-of-range or blocked jumps are no-ops.
   */
  const goToStep = useCallback(
    (index: number) => {
      if (index < 0 || index >= STEPS.length) return;
      if (index === currentIndex) return;
      if (index > currentIndex) {
        for (let i = 0; i < index; i++) {
          if (!STEPS[i].isComplete(state)) return;
        }
      }
      shouldFocusRef.current = true;
      setCurrentIndex(index);
    },
    [currentIndex, state],
  );

  // Focus management: after a navigation, move focus to the new panel's first
  // focusable element, else its heading. `useLayoutEffect` so focus lands
  // before paint; guarded by `shouldFocusRef` so typing never steals focus.
  useLayoutEffect(() => {
    if (!shouldFocusRef.current) return;
    shouldFocusRef.current = false;

    const panel = panelRef.current;
    const focusable = panel?.querySelector<HTMLElement>(
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    );
    if (focusable) {
      focusable.focus();
    } else {
      headingRef.current?.focus();
    }
  }, [currentIndex]);

  // Reset the one-shot focus flag if the component unmounts mid-navigation.
  useEffect(() => {
    return () => {
      shouldFocusRef.current = false;
    };
  }, []);

  return (
    <div className="flex flex-col gap-[var(--spacing-section-y)]">
      <WizardStepper
        steps={STEPS.map((s) => ({ id: s.id, label: s.label }))}
        currentIndex={currentIndex}
        completedIndices={completed}
      />

      <div
        ref={panelRef}
        className="rounded-[var(--radius-xl)] border border-border bg-surface p-[var(--spacing-card-p)]"
      >
        {currentStep.render({
          state,
          setGoalText,
          setGoalWhy,
          patchState,
          goToStep,
          headingRef,
        })}
      </div>

      <div className="flex items-center justify-between gap-4">
        <button
          type="button"
          onClick={back}
          disabled={currentIndex === 0}
          className="min-h-[44px] rounded-[var(--radius-sm)] border border-border px-6 py-2 font-medium text-text-primary hover:bg-primary-subtle focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)] disabled:cursor-not-allowed disabled:opacity-40 motion-safe:transition-colors"
        >
          Back
        </button>

        <button
          type="button"
          onClick={advance}
          disabled={!canAdvance || isLastStep}
          aria-disabled={!canAdvance || isLastStep ? "true" : undefined}
          className={`min-h-[44px] rounded-[var(--radius-sm)] px-6 py-2 font-bold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)] ${!canAdvance || isLastStep
            ? "cursor-not-allowed bg-primary/40 text-white/60"
            : "bg-primary text-white hover:bg-primary-hover motion-safe:transition-colors motion-safe:duration-150"
            }`}
        >
          {currentStep.nextLabel ?? "Next"}
        </button>
      </div>
    </div>
  );
}
