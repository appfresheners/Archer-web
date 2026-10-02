---
title: "Wizard Step 1 — Goal & Skill Framework"
type: "feature"
created: "2026-09-28"
status: "done"
review_loop_iteration: 0
baseline_commit: "e609e0e049a751e6088d53078a544168c796f8d6"
context:
  - "{project-root}/_bmad-output/implementation-artifacts/epic-3-context.md"
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The wizard shell (3.1) renders a placeholder Step 1, and the framework endpoint (3.2) exists, but nothing connects them: no real goal input with counter/validation, no "Continue" fetch of the framework, no reviewable/editable framework list, and no ≥3-items advance gate.

**Approach:** Replace the placeholder Step 1 with a real `WizardStep1` component mounted through the shell's step contract. It owns the goal input (500-char live counter, empty-goal validation), a "Continue" action that POSTs Pattern B (`{ mode:'goal', step:'framework', goal }`) with a "Building your framework…" loading state, and a framework list where each item shows name + required-level chip + goal-specific description with remove (×) and an inline "Add item" field. Advancement to Step 2 is gated on the framework having returned and ≥3 items remaining. Evolve the shell's `StepContext`/state minimally to support this (a generic state patcher + framework-count gate) and align the framework item type to the canonical snake_case schema shape.

## Boundaries & Constraints

**Always:**

- Mount Step 1 through the existing shell step contract in `app/app/goals/new/GoalWizard.tsx` — do not fork the shell or bypass its navigation/gating.
- Fetch the framework via the existing Pattern B endpoint only (`POST /api/generate` `{ mode:'goal', step:'framework', goal }`). No new endpoint, no direct provider call.
- The framework the AI returns is the Target Profile only — the client must never synthesize or pre-fill a user rating. `user_rating` is collected in Step 2 (Story 3.4); Step 1 holds items without it.
- Align the wizard's `SkillFrameworkItem` to the persisted schema shape (`name`, `required_level`, `description`, optional `user_rating`) so no rename is needed downstream. Update the one place 3.1 referenced the camelCase shape.
- Goal input: accept up to 500 characters with a live counter; empty/whitespace goal blocks advancing from Step 1 with inline validation.
- "Continue" shows "Building your framework…" while the fetch is in flight; the framework must return before Step 2 is reachable. Changing the goal text after a framework exists invalidates it (already wired in 3.1 via `applyGoalText`) — the user must re-Continue.
- User edits: remove any item (× / remove control) and add a user item via an inline "Add item" field (added items get a sensible default `required_level`, e.g. a mid value, since only the AI proposes levels for its own items — a user-added item's required level is user-owned, not AI-inferred).
- The advance control ("Next: Rate yourself →") is enabled only when a framework is present AND ≥ 3 items remain.
- Errors (timeout/provider/format) surface inline with a "Try again" that re-runs the fetch with the same goal, preserving the goal text — mirror the Project Mode error pattern (`NewProjectClient`). No framework is set on error.
- Accessibility: goal input has an associated label + `aria-describedby` for counter/validation; loading + errors announced via `aria-live`; remove/add controls are ≥44px and keyboard-operable; framework list is navigable.

**Ask First:**

- Broadening the shell's `StepContext` beyond what Step 1 needs (a generic `patchState` + framework gate is expected; anything larger is a design change).
- Any client-side synthesis of `user_rating` / current level for AI-proposed items.

**Never:**

- Do not implement Step 2 sliders/gap logic (Story 3.4) — Step 1 leaves items without ratings.
- Do not persist anything (transient state until Story 3.6 generation succeeds).
- Do not change the Pattern B endpoint contract.

## I/O & Edge-Case Matrix

| Scenario                     | Input / State                       | Expected Output / Behavior                                                                            | Error Handling      |
| ---------------------------- | ----------------------------------- | ----------------------------------------------------------------------------------------------------- | ------------------- |
| Idle load                    | Step 1, empty goal                  | Goal input focused/empty, counter at 0/500, Continue disabled, advance disabled                       | N/A                 |
| Typing                       | Goal text entered                   | Counter updates live; Continue enabled once non-empty trimmed                                         | N/A                 |
| Continue (happy)             | Valid goal, click Continue          | "Building your framework…"; on 200, framework list renders (name + level chip + description per item) | N/A                 |
| Empty goal advance           | Whitespace-only goal                | Inline validation blocks; no fetch                                                                    | Inline `role=alert` |
| Remove item                  | Framework of N items, click ×       | Item removed; advance gate re-evaluates (≥3)                                                          | N/A                 |
| Add item                     | Type in "Add item", submit          | New user item appended with a default required level; advance gate re-evaluates                       | N/A                 |
| Advance gate                 | Framework present, ≥3 items remain  | "Next: Rate yourself →" enabled; advancing goes to Step 2                                             | N/A                 |
| Advance blocked              | Framework present, <3 items remain  | Advance disabled                                                                                      | N/A                 |
| No framework yet             | Goal typed but not fetched          | Advance disabled (framework must return first)                                                        | N/A                 |
| Goal changed after framework | Framework present, goal text edited | Framework invalidated (cleared); must re-Continue                                                     | N/A                 |
| Fetch timeout/error          | Pattern B returns 504/500           | Inline error + "Try again" (re-runs with same goal); goal text preserved; no framework set            | `aria-live` alert   |

</frozen-after-approval>

## Code Map

- `app/app/goals/new/GoalWizard.tsx` -- EDIT. (1) Change `SkillFrameworkItem` to snake_case (`name`, `required_level`, `description`, `user_rating?`) and update `applyGoalText`/tests references. (2) Extend `StepContext` with a generic `patchState: (partial: Partial<WizardState>) => void` (keep `setGoalText`, which stays the framework-invalidating goal setter). (3) Tighten Step 1's `isComplete` gate to `goalText non-empty && (framework?.length ?? 0) >= 3`. (4) Replace the Step 1 placeholder `render` with `<WizardStep1 ctx={...} />`. Steps 2–4 stay placeholders.
- `components/goals/WizardStep1.tsx` -- NEW `"use client"` (or presentational) component: goal input (label, 500 counter via threshold like `ProjectModeInput`, empty validation), Continue button + Pattern B fetch (loading "Building your framework…", inline error + Try again), framework list (name + `required_level` chip + description, remove ×, inline "Add item"). Receives the step context (state + `patchState` + `setGoalText` + headingRef); orchestrates only Step 1.
- `components/projects/ProjectModeInput.tsx` -- REFERENCE. Canonical input + `useId` + counter-threshold + validation + disabled/loading button styling.
- `app/app/projects/new/NewProjectClient.tsx` -- REFERENCE. Canonical fetch-to-`/api/generate` + status→message mapping (504/500/network) + "Try again" preserving input. Mirror for the framework fetch.
- `lib/goals/generate-framework.ts` -- REFERENCE. `FrameworkItem = { name, required_level, description }` — the exact response item shape to consume.
- `lib/supabase/schema.ts` -- REFERENCE. `SkillFrameworkItem` canonical snake_case shape to align to.
- `app/globals.css` -- REFERENCE. Tokens for chips (`--radius-xs`), buttons, spacing, focus ring.

## Tasks & Acceptance

**Execution:**

- [x] `app/app/goals/new/GoalWizard.tsx` -- Align `SkillFrameworkItem` to snake_case, add `patchState` to `StepContext`, tighten Step 1 gate to require ≥3 framework items, and mount `<WizardStep1>` -- connects the real step to the shell without forking navigation/gating.
- [x] `components/goals/WizardStep1.tsx` -- Build the goal input (counter + validation), Continue→Pattern B fetch (loading/error/Try-again), and the reviewable/editable framework list (remove + add item) -- the real Step 1 UI and its transient framework fetch.
- [x] `components/goals/WizardStep1.test.tsx` -- Unit-test the I/O matrix rows: idle/typing/counter, empty-goal validation, Continue fetch happy path (mock fetch → renders items), remove drops item + re-gates, add appends + re-gates, advance gate at ≥3, no-framework advance blocked, error → inline alert + Try again preserves goal.
- [x] `app/app/goals/new/GoalWizard.test.tsx` -- Update for the snake_case type + the tightened Step 1 gate (advancing to Step 2 now requires ≥3 framework items, not just goal text); keep the existing navigation/focus/invalidation assertions green.

**Acceptance Criteria:**

- Given Step 1 loads, when rendered, then a goal input accepts up to 500 chars with a live counter, and an empty/whitespace goal blocks advancing with inline validation.
- Given valid goal text, when Continue is clicked, then "Building your framework…" shows while Pattern B is fetched, and the framework must return before Step 2 is reachable.
- Given the returned framework, when it renders, then each item shows a skill name, a required-level chip, and a goal-specific description, and the user can remove items and add their own via an inline field.
- Given the framework, when the user tries to advance, then "Next: Rate yourself →" is enabled only when ≥ 3 items remain.
- Given a fetch failure, when it occurs, then an inline error with "Try again" is shown, the goal text is preserved, and no framework is set.

## Design Notes

`WizardStep1` reads `ctx.state.framework` and calls `ctx.patchState({ framework })` on a successful fetch, `ctx.setGoalText(text)` for the goal input (so the shell's invalidation stays authoritative), and never sets `user_rating`. Fetch shape mirrors `NewProjectClient.run`:

```ts
const res = await fetch("/api/generate", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ mode: "goal", step: "framework", goal }),
});
// 200 → { framework: FrameworkItem[] } → patchState({ framework })
// 504 → timeout copy; 500 → payload.error; throw → network copy
```

Added items: give a neutral default `required_level` (e.g. 5) — the value is the user's own, set here or adjustable later; the AI is never asked to rate a user-authored item. Keep the loading/error copy consistent with Project Mode. The advance button label is "Next: Rate yourself →" per epics.md/EXPERIENCE.md.

## Verification

**Commands:**

- `npx tsc --noEmit` -- expected: no type errors.
- `npx eslint components/goals/WizardStep1.tsx components/goals/WizardStep1.test.tsx app/app/goals/new/GoalWizard.tsx app/app/goals/new/GoalWizard.test.tsx` -- expected: clean.
- `npx vitest run components/goals app/app/goals/new` -- expected: new + updated tests pass.
- `npx vitest run` -- expected: full suite green.

## Suggested Review Order

**Step 1 content (the change core)**

- Entry point: the Step 1 component — goal input, Continue fetch, framework list, all mounted through the shell context.
  [`WizardStep1.tsx:60`](../../components/goals/WizardStep1.tsx#L60)

- Pattern B fetch: maps items to `{name, required_level, description}` with NO `user_rating`; too-short/error → inline alert.
  [`WizardStep1.tsx:86`](../../components/goals/WizardStep1.tsx#L86)

- Framework list render: name + required-level chip + description, remove (×) and inline "Add item".
  [`WizardStep1.tsx:283`](../../components/goals/WizardStep1.tsx#L283)

**Shell wiring (minimal, non-forking)**

- Step 1 gate tightened to require ≥3 framework items; `nextLabel` supplies the AC's "Next: Rate yourself →" without forking the shell button.
  [`GoalWizard.tsx:139`](../../app/app/goals/new/GoalWizard.tsx#L139)

- `patchState` added to the step context so a step writes its own slice (Step 1 sets `framework`).
  [`GoalWizard.tsx:74`](../../app/app/goals/new/GoalWizard.tsx#L74)

**Tests (peripheral)**

- Step 1 I/O matrix: counter/validation, fetch happy/error/retry, remove/add re-gating, no-user_rating invariant.
  [`WizardStep1.test.tsx:1`](../../components/goals/WizardStep1.test.tsx#L1)

- Shell navigation updated for the ≥3 gate + the label AC.
  [`GoalWizard.test.tsx:1`](../../app/app/goals/new/GoalWizard.test.tsx#L1)
