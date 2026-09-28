---
title: "Wizard Shell & Stepper Navigation"
type: "feature"
created: "2026-09-28"
status: "done"
review_loop_iteration: 0
baseline_commit: "d8b358a5b0838b7e261517a64a833df41b2cc795"
context:
  - "{project-root}/_bmad-output/implementation-artifacts/epic-3-context.md"
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Epic 3 needs a four-step goal-creation wizard at `/app/goals/new`, but there is no shell, no stepper, and no navigation/state orchestration for the four steps to plug into. The step contents (Goal & Skill Framework, Gap Rating, Drivers & Barriers, Review & Generate) arrive in Stories 3.3–3.6.

**Approach:** Build the wizard shell as a client component that owns transient wizard state, renders a reusable `WizardStepper` (horizontal desktop / vertical mobile), and orchestrates advance/back navigation with per-step gating and state preservation. Steps 1–4 render as clearly-labelled placeholder panels this story, exposing a stable seam (a `steps` config + a shared step-render contract) that Stories 3.3–3.6 fill in without reworking the shell.

## Boundaries & Constraints

**Always:**

- The wizard lives at `/app/goals/new` inside the existing authenticated `/app` shell (auth already enforced by the layout — no auth check in the page).
- Wizard state is transient React state only. No `localStorage`, no Supabase writes, no auto-save, no recovery/nudge on abandonment.
- Back navigation preserves all later-step inputs already entered.
- Changing the Step 1 goal text invalidates the skill framework (framework state is cleared and must be re-fetched). This story wires the invalidation signal; the actual fetch is Story 3.3.
- Advancement is gated per step by that step's own completion rule; the user cannot skip ahead to an ungated step. This story provides the gating mechanism and neutral default rules; real rules land with each step's story.
- Follow existing conventions: server `page.tsx` delegates to a `"use client"` orchestrator (mirrors `app/app/projects/new`), design tokens from `globals.css`, 44×44px min touch targets, focus-visible rings.
- Accessibility: the stepper is a labelled navigation region; the active step exposes `aria-current="step"` and an accessible label like "Step 2 of 4: Gap Rating"; on advancing to a step, focus moves to that step's first interactive element (or the step heading if none).
- Stepper visuals per DESIGN.md: 32px circles, complete = emerald fill + checkmark, active = primary fill + white number, upcoming = gray fill + muted number; connector line fills emerald as steps complete; labels under circles on desktop, icon/number-only on mobile.

**Ask First:**

- Introducing any external state, form, or wizard library (none exists today — AD-3 says state lives in `useState`).
- Persisting any wizard state anywhere (violates the transient-state invariant).

**Never:**

- Do not implement step-content logic (framework fetch, sliders, drivers/barriers, generate/save) — those are Stories 3.2–3.6. Placeholders only.
- Do not add a Goals-list "New goal" entry point rewrite beyond what is needed to reach `/app/goals/new` (the Goals page is a later-epic placeholder).
- No network requests from this story.

## I/O & Edge-Case Matrix

| Scenario                             | Input / State                                                  | Expected Output / Behavior                                                                             | Error Handling |
| ------------------------------------ | -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | -------------- |
| Initial load                         | Navigate to `/app/goals/new`                                   | Wizard renders on Step 1; stepper shows step 1 active, 2–4 upcoming; Step 1 is the only reachable step | N/A            |
| Advance when gate passes             | On step N, N's completion rule satisfied, click Next           | Advance to N+1; step N marked complete; focus moves to N+1's first interactive element                 | N/A            |
| Advance when gate fails              | On step N, rule not satisfied, click Next                      | Stay on N; Next is disabled/blocked; no step marked complete                                           | N/A            |
| Back navigation                      | On step N (>1), click Back                                     | Return to N−1 with all entered inputs for every step preserved                                         | N/A            |
| Skip-ahead attempt                   | On step 1, attempt to jump to step 3 (e.g. click stepper node) | Blocked — cannot reach a step whose predecessors' gates are unmet                                      | N/A            |
| Edit Step 1 goal after framework set | Framework present in state, goal text changed on Step 1        | Framework state cleared (invalidated); dependent later-step completion reset                           | N/A            |
| Screen reader on stepper             | AT reads the stepper                                           | Active step announces `aria-current="step"` + "Step N of 4: {label}"; each node labelled               | N/A            |

</frozen-after-approval>

## Code Map

- `app/app/goals/new/page.tsx` -- NEW. Server component; sets metadata `title: "New goal — Archer"`, renders page heading + `<GoalWizard />`. Mirror `app/app/projects/new/page.tsx` structure exactly.
- `app/app/goals/new/GoalWizard.tsx` -- NEW `"use client"` orchestrator. Owns `WizardState` (current step index, per-step data, completed set), advance/back handlers, gating, framework-invalidation-on-goal-change, focus management. Renders `WizardStepper` + the active step panel + Back/Next controls.
- `components/goals/WizardStepper.tsx` -- NEW. Presentational stepper. Props: `steps: {id, label}[]`, `currentIndex`, `completedIndices`. Renders `<nav aria-label="Goal creation progress">`, 4 nodes, connector fills, responsive horizontal/vertical, `aria-current="step"` + per-node accessible labels. No state.
- `app/app/projects/new/page.tsx` + `NewProjectClient.tsx` -- REFERENCE ONLY. Canonical server-page → client-orchestrator seam, token usage, button/disabled/focus styling to mirror.
- `components/projects/ProjectModeInput.tsx` -- REFERENCE ONLY. Canonical input/label/counter/`useId`/aria-describedby + button styling patterns to match.
- `app/globals.css` -- REFERENCE. Tokens: `--color-step-complete/-active/-upcoming`, `--radius-full`, `--radius-xl` (wizard container), `--color-focus-ring`, spacing/type tokens. No edits expected.
- `app/app/layout.tsx` -- REFERENCE. Shell already enforces auth + caps content at 720px; do not re-check auth.
- `components/authenticated/nav-items.ts` -- REFERENCE. Inline-SVG icon convention (no icon library) if the stepper needs a checkmark glyph.

## Tasks & Acceptance

**Execution:**

- [x] `components/goals/WizardStepper.tsx` -- Build the presentational stepper (responsive, tokenised, accessible: `aria-current`, per-node labels, checkmark on complete) -- reusable, state-free progress indicator all step stories share.
- [x] `app/app/goals/new/GoalWizard.tsx` -- Build the client orchestrator: transient `WizardState`, a `steps` config (id, label, gate predicate, placeholder panel), advance/back with gating + skip-ahead prevention, back preserves later inputs, goal-change clears framework, focus-moves-to-first-interactive-on-advance, Back/Next controls -- the shell Stories 3.3–3.6 plug step content into.
- [x] `app/app/goals/new/page.tsx` -- Server page: metadata + heading + render `<GoalWizard />` -- route entry mirroring the projects/new pattern.
- [x] `components/goals/WizardStepper.test.tsx` -- Unit-test the I/O matrix rows that apply to the stepper (active/complete/upcoming rendering, `aria-current`, accessible labels).
- [x] `app/app/goals/new/GoalWizard.test.tsx` -- Unit-test navigation/gating: advance passes/blocks on gate, back preserves inputs, skip-ahead blocked, goal-change invalidates framework, focus moves on advance.

**Acceptance Criteria:**

- Given `/app/goals/new`, when it loads, then a stepper shows four labelled steps with the current/completed/upcoming states visually distinct, horizontal on desktop and vertical below 640px.
- Given a later step, when the user navigates back, then earlier and later inputs are preserved; and when the Step 1 goal text changes, the skill framework is invalidated.
- Given any step, when the user tries to skip ahead, then advancement is gated on each step's own completion rule and skipping is prevented.
- Given a screen reader, when it reads the stepper, then the active step exposes `aria-current="step"` and each step is labelled "Step N of 4: {label}"; and focus moves to the first interactive element of a step on advance.

## Design Notes

Keep the step contract minimal so Stories 3.3–3.6 don't rework the shell:

```ts
type WizardStep = {
  id: "goal" | "gap" | "drivers" | "review";
  label: string; // "Goal & Skill Framework" ...
  isComplete: (s: WizardState) => boolean; // gate to advance FROM this step
  render: (ctx: StepContext) => ReactNode; // placeholder now; filled per story
};
```

`WizardState` holds all step data (goalText, framework, ratings, drivers, barriers, ifThen) as optional fields; later stories populate their slices. This story wires only Step 1's `goalText` + framework-invalidation so the seam is proven end-to-end. Step 1's gate = non-empty trimmed goal text (the one stable rule per epics.md); steps 2–4 use a neutral placeholder gate until their stories tighten them. Focus after `advance()`/`back()`: focus the new panel's first focusable element, else its heading (`tabIndex={-1}`). Respect `prefers-reduced-motion`.

## Verification

**Commands:**

- `npx tsc --noEmit` -- expected: no type errors.
- `npx next lint` -- expected: no new lint errors in added files.
- `npx vitest run components/goals app/app/goals/new` -- expected: new tests pass.

**Manual checks:**

- Load `/app/goals/new`: stepper renders, Step 1 active; resize below 640px → stepper goes vertical.
- Enter goal text → Next enabled → advance to Step 2 placeholder; Back returns with text intact; change goal text on Step 1 → framework-invalidation reflected (dependent completion reset).

## Suggested Review Order

**Navigation & gating (the design core)**

- Entry point: the orchestrator that owns state, gating, and the step contract Stories 3.3–3.6 plug into.
  [`GoalWizard.tsx:207`](../../app/app/goals/new/GoalWizard.tsx#L207)

- Step config — Step 1's real gate (non-empty goal) vs. placeholder gates for steps 2–4.
  [`GoalWizard.tsx:112`](../../app/app/goals/new/GoalWizard.tsx#L112)

- Advance/back kept pure (side effects out of the state updater) so StrictMode double-invoke can't desync.
  [`GoalWizard.tsx:238`](../../app/app/goals/new/GoalWizard.tsx#L238)

**Framework-invalidation seam**

- Pure transition: a goal edit clears the framework + ratings but preserves user-owned drivers/barriers/if–then.
  [`GoalWizard.tsx:98`](../../app/app/goals/new/GoalWizard.tsx#L98)

**Focus management**

- After navigation, focus moves to the new panel's first focusable element, else its heading.
  [`GoalWizard.tsx:260`](../../app/app/goals/new/GoalWizard.tsx#L260)

**Accessible stepper**

- State-free presentational stepper: `aria-current`, "Step N of 4" labels, checkmark/number, responsive.
  [`WizardStepper.tsx:61`](../../components/goals/WizardStepper.tsx#L61)

**Route entry (peripheral)**

- Server page mirrors projects/new; auth handled by the /app layout.
  [`page.tsx:15`](../../app/app/goals/new/page.tsx#L15)

**Tests (peripheral)**

- Navigation/gating/focus + the framework-invalidation contract (via `applyGoalText`).
  [`GoalWizard.test.tsx:1`](../../app/app/goals/new/GoalWizard.test.tsx#L1)

- Stepper rendering, `aria-current`, and accessible labels.
  [`WizardStepper.test.tsx:1`](../../components/goals/WizardStepper.test.tsx#L1)
