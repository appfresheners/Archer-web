---
title: "Wizard Step 2 — Gap Rating"
type: "feature"
created: "2026-09-28"
status: "done"
review_loop_iteration: 0
baseline_commit: "3b9048655b78a5c0f74d130b4f943c22ad3bc34b"
context:
  - "{project-root}/_bmad-output/implementation-artifacts/epic-3-context.md"
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Step 2 is a placeholder. Users can't rate themselves against the confirmed framework, so there is no gap analysis — the whole point of the wizard's self-assessment.

**Approach:** Replace the Step 2 placeholder with a real `WizardStep2` that renders one row per framework item: skill name, required-level chip, a 1–10 slider (`<input type="range">`) starting at the neutral midpoint 5 with no AI-supplied value, and a live gap readout (Gap = Required − Current) shown amber when ≥ 4. Ratings are stored as `user_rating` inline on each framework item (matching the persisted schema), written via the shell's `patchState`. The user can also add their own item here. Advancement is gated on every item having a rating (touched or explicitly confirmed at the default).

## Boundaries & Constraints

**Always:**

- Mount Step 2 through the shell step contract in `GoalWizard.tsx` — no fork, no bypass of navigation/gating.
- Store each rating as `user_rating` on the corresponding framework item (`SkillFrameworkItem.user_rating`), written via `ctx.patchState({ framework })`. This is user-owned data; the AI never supplies it.
- Every slider starts at the neutral midpoint 5. No AI value, no pre-fill, no inference. The AC "nothing is pre-filled" is invariant.
- Each row shows: skill name, a required-level chip (e.g. "Required: 8"), a 1–10 range slider with a live current-value readout, and a live gap readout (Gap = Required − Current). The gap displays amber when ≥ 4, neutral otherwise.
- Slider accessibility: an `<input type="range">` with `min=1 max=10 step=1`, an `aria-label` naming the skill, `aria-valuenow/min/max`, and an `aria-valuetext` like "Current: 6, Gap: 2"; fully arrow-key adjustable.
- The user can add their own skill/attribute item on this step (reuse the Step 1 add pattern); an added item also starts at rating 5 with a user-owned required level.
- Advance to Step 3 is enabled only when every framework item has a rating — model "touched or explicitly confirmed" as: each item has a `user_rating` set (the default 5 counts as a rating once the step is entered / confirmed). Choose one coherent rule and enforce it in the shell gate.
- Reflect the amber gap using the existing warning tokens; respect `prefers-reduced-motion`.
- Back navigation preserves entered ratings (shell already preserves state); editing the Step 1 goal still invalidates the framework (and therefore ratings) via the existing `applyGoalText`.

**Ask First:**

- Storing ratings anywhere other than inline `user_rating` on framework items (e.g. keeping the parallel `ratings` map) — prefer inline to match the schema; flag if a different shape is needed.
- Any client synthesis of an initial rating other than the neutral 5.

**Never:**

- Do not implement Step 3/4 content.
- Do not persist to Supabase (transient until Story 3.6).
- Do not let the AI or any code pre-populate `user_rating` with a non-neutral value.

## I/O & Edge-Case Matrix

| Scenario          | Input / State                  | Expected Output / Behavior                                                                         | Error Handling |
| ----------------- | ------------------------------ | -------------------------------------------------------------------------------------------------- | -------------- |
| Enter Step 2      | Framework of N confirmed items | N rows: name + required chip + slider at 5 + gap readout; every slider starts at 5                 | N/A            |
| Read gap          | Required 8, slider at 5        | Gap readout "Gap: 3" neutral                                                                       | N/A            |
| Amber gap         | Required 9, slider at 4        | Gap readout "Gap: 5" amber (≥4)                                                                    | N/A            |
| Adjust slider     | Move slider to 6               | Current readout + gap update live; `aria-valuetext` updates; `user_rating` stored                  | N/A            |
| Keyboard          | Focus slider, press arrow keys | Value changes by step within 1–10 bounds                                                           | N/A            |
| Add item          | Add a skill on Step 2          | New row appended, slider at 5, required level user-owned                                           | N/A            |
| Advance gate met  | All items have a rating        | "Next: Drivers & Barriers →" enabled; advancing goes to Step 3                                     | N/A            |
| No pre-fill audit | Step 2 just loaded             | No item shows a rating other than the neutral 5; nothing AI-derived                                | N/A            |
| Back then forward | Rate items, go Back, return    | Ratings preserved                                                                                  | N/A            |
| Screen reader     | AT reads a slider              | Announces skill via `aria-label` + `aria-valuenow/min/max` + `aria-valuetext` "Current: X, Gap: Y" | N/A            |

</frozen-after-approval>

## Code Map

- `app/app/goals/new/GoalWizard.tsx` -- EDIT. (1) Remove the now-vestigial `ratings: Record<string,number>` from `WizardState` (+ `INITIAL_STATE`) and drop the `ratings: {}` reset in `applyGoalText` (ratings now live inline on `framework`, which that path already clears). Update the `applyGoalText` unit-test fixture accordingly. (2) Tighten Step 2's `isComplete` gate to "framework present AND every item has a numeric `user_rating`". (3) Set Step 2 `nextLabel: "Next: Drivers & Barriers →"`. (4) Replace the Step 2 placeholder `render` with `<WizardStep2 ctx={...} />`. Steps 3–4 stay placeholders.
- `components/goals/WizardStep2.tsx` -- NEW `"use client"`. Renders the heading (via `headingRef`), one `GapRatingRow`-style block per framework item (name + required chip + range slider at 5 + live current/gap readout with amber ≥4), and the inline "Add item" field. On mount/first render, seed each item's `user_rating` to 5 if unset (via `patchState`) so entering the step "confirms" defaults and the gate can pass; on slider change, write the new `user_rating` for that item.
- `components/goals/WizardStep1.tsx` -- REFERENCE. Add-item pattern, chip styling, list/row layout, `patchState` usage to mirror.
- `lib/supabase/schema.ts` -- REFERENCE. `SkillFrameworkItem.user_rating` is the storage field; keep integer 1–10.
- `app/globals.css` -- REFERENCE. Tokens: `--color-warning`/`--color-warning-subtle` (amber gap), `--radius-xs` chip, focus ring, `--color-primary` slider accent.
- `_bmad-output/planning-artifacts/ux-designs/.../DESIGN.md` -- REFERENCE. Gap Rating Slider row anatomy (label + required chip left, slider + readout, live gap amber ≥4).

## Tasks & Acceptance

**Execution:**

- [x] `app/app/goals/new/GoalWizard.tsx` -- Drop vestigial `ratings` map + its `applyGoalText` reset, tighten Step 2 gate to "all items rated", set Step 2 `nextLabel`, mount `<WizardStep2>` -- wires the real Step 2 into the shell and moves ratings inline onto framework items.
- [x] `components/goals/WizardStep2.tsx` -- Build the per-item gap-rating rows (required chip, 1–10 slider defaulting to 5, live current + gap readout amber ≥4, full ARIA range semantics) plus add-item; seed defaults and write `user_rating` on change via `patchState` -- the real Step 2 UI enforcing the no-pre-fill invariant.
- [x] `components/goals/WizardStep2.test.tsx` -- Unit-test the I/O matrix: N rows render at 5, gap math + amber threshold, slider change updates readout + `aria-valuetext` + stored rating, add-item appends at 5, advance gate met when all rated, no-pre-fill audit (no non-neutral initial value), ARIA attributes present.
- [x] `app/app/goals/new/GoalWizard.test.tsx` -- Update for the removed `ratings` field + Step 2 gate + label; keep existing navigation/invalidation tests green (advancing Step 1→2→3 now requires ratings).

**Acceptance Criteria:**

- Given each confirmed framework item, when Step 2 renders, then each row shows the skill name, required-level chip, a 1–10 slider, and a live gap readout (Gap = Required − Current), amber when ≥ 4 and neutral otherwise.
- Given Step 2 loads, when inspected, then every slider starts at 5 with no AI-supplied values.
- Given a missing item, when on Step 2, then the user can add their own skill/attribute item.
- Given advancement, when all items have been rated (touched or confirmed at default), then "Next: Drivers & Barriers →" becomes active.
- Given a slider for accessibility, when read by a screen reader, then it is an `<input type="range">` with `aria-label`, `aria-valuenow/min/max`, and `aria-valuetext` such as "Current: 6, Gap: 2", adjustable by arrow keys.

## Design Notes

Store ratings inline: `framework: [{ name, required_level, description, user_rating }]`. On entering Step 2, seed `user_rating = 5` for any item lacking one (single `patchState` with a mapped framework), so the gate rule "every item has a `user_rating`" is satisfiable by confirmation-at-default while still being a real, user-owned value the user can change. Gap = `required_level - user_rating` (may be negative if the user rates above required; display gap only when positive-or-treat ≤0 as "Gap: 0" neutral — pick one and keep the amber rule for ≥4). `aria-valuetext={`Current: ${rating}, Gap: ${Math.max(0, gap)}`}`.

```tsx
<input
  type="range"
  min={1}
  max={10}
  step={1}
  value={rating}
  aria-label={`Your current level for ${item.name}`}
  aria-valuetext={`Current: ${rating}, Gap: ${Math.max(0, gap)}`}
  onChange={(e) => setRating(index, Number(e.target.value))}
/>
```

Keep the amber styling token-based (`--color-warning`). The Step 2 gate lives in the shell (like Step 1's).

## Verification

**Commands:**

- `npx tsc --noEmit` -- expected: no type errors.
- `npx eslint components/goals/WizardStep2.tsx components/goals/WizardStep2.test.tsx app/app/goals/new/GoalWizard.tsx app/app/goals/new/GoalWizard.test.tsx` -- expected: clean.
- `npx vitest run components/goals app/app/goals/new` -- expected: new + updated tests pass.
- `npx vitest run` -- expected: full suite green.

## Suggested Review Order

**Step 2 content (the change core)**

- Entry point: the Step 2 component — per-item gap-rating rows + add-item, mounted through the shell context.
  [`WizardStep2.tsx:56`](../../components/goals/WizardStep2.tsx#L56)

- Seed-on-entry: any item lacking a rating gets the neutral 5 via one `patchState` (confirmation-at-default, never AI-derived, preserves existing).
  [`WizardStep2.tsx:66`](../../components/goals/WizardStep2.tsx#L66)

- `setRating`: writes `user_rating` inline, guarded against NaN and clamped 1–10.
  [`WizardStep2.tsx:81`](../../components/goals/WizardStep2.tsx#L81)

- Row render: required chip, range slider, live gap (floored at 0, amber ≥4 with a non-colour "(large gap)" a11y signal), full ARIA range semantics.
  [`WizardStep2.tsx:130`](../../components/goals/WizardStep2.tsx#L130)

**Shell wiring**

- Step 2 gate = every item has a numeric `user_rating`; `nextLabel` "Next: Drivers & Barriers →"; ratings moved inline (vestigial `ratings` map removed).
  [`GoalWizard.tsx:154`](../../app/app/goals/new/GoalWizard.tsx#L154)

**Tests (peripheral)**

- Step 2 I/O matrix: rows at 5, gap/amber math, slider change + aria-valuetext, add-item, advance gate, no-pre-fill audit, back-then-forward preserves ratings.
  [`WizardStep2.test.tsx:1`](../../components/goals/WizardStep2.test.tsx#L1)
