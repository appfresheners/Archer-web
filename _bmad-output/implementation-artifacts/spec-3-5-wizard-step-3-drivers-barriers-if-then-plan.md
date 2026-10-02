---
title: "Wizard Step 3 — Drivers, Barriers & If–Then Plan"
type: "feature"
created: "2026-09-28"
status: "done"
review_loop_iteration: 0
baseline_commit: "2de67b80ccc3c60e49a1cacb30f1ac36f73df87c"
context:
  - "{project-root}/_bmad-output/implementation-artifacts/epic-3-context.md"
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Step 3 is a placeholder. The user can't record their own strengths (Drivers), real obstacles (Barriers), or an if–then implementation intention — the entirely user-owned inputs the breakdown depends on.

**Approach:** Replace the Step 3 placeholder with a real `WizardStep3` mounted through the shell contract. It renders three blank field groups: Drivers (multi-value list with add/remove), Barriers (multi-value list with add/remove), and a structured If–then plan composed from an "If …" input and a "then I will …" input. All fields start empty with inline label guidance and no AI-suggested content. Drivers/barriers write to the existing `state.drivers` / `state.barriers` string arrays; the if–then composes into the existing `state.ifThen` string. Advancement is gated on ≥ 1 Driver, ≥ 1 Barrier, and a complete if–then plan.

## Boundaries & Constraints

**Always:**

- Mount Step 3 through the shell step contract in `GoalWizard.tsx` — no fork, no bypass of navigation/gating.
- All three groups start blank with NO AI-suggested content. This is the AI-never-owns-self-assessment invariant applied to Step 3 — nothing is pre-filled or inferred.
- Drivers and Barriers are multi-value: an inline "Add" field appends a trimmed non-empty value; each entry has a remove control. Write to `state.drivers` / `state.barriers` (string arrays) via `patchState`.
- The If–then plan is structured in the UI as two inputs ("If **_" and "then I will _**") composed into the single `state.ifThen` string (matching the persisted `goals.if_then_plan` text column). Choose one canonical compose format (e.g. `If {if}, then I will {then}`) and keep it stable so Step 4/Pattern C reproduces it verbatim.
- Inline label guidance is shown per the AC: Drivers → "An internal strength already working for you"; Barriers → "What actually gets in the way". The if–then inputs carry their own guidance.
- Advance to Step 4 is enabled only when: `drivers.length >= 1` AND `barriers.length >= 1` AND the if–then plan is complete (both the "if" and "then" parts non-empty). Enforce in the shell gate.
- Back navigation preserves all entered values (shell already preserves state). Editing the Step 1 goal still invalidates the framework (not drivers/barriers/ifThen — those are goal-independent user words, preserved by `applyGoalText`).
- Accessibility: every input has an associated label; add/remove controls are ≥44px and keyboard-operable (Enter adds); lists are navigable; validation/empty states are announced where relevant.

**Ask First:**

- Changing the `ifThen` storage from a single composed string to a structured object (would ripple into Pattern C / persistence) — prefer the composed string.
- Any pre-filled or AI-suggested driver/barrier/if–then content.

**Never:**

- Do not implement Step 4 (review/generate) — this is Step 3 content only.
- Do not persist to Supabase (transient until Story 3.6).
- Do not pre-populate any field.

## I/O & Edge-Case Matrix

| Scenario             | Input / State                           | Expected Output / Behavior                                                                    | Error Handling              |
| -------------------- | --------------------------------------- | --------------------------------------------------------------------------------------------- | --------------------------- |
| Enter Step 3         | Fresh                                   | Three empty groups (Drivers, Barriers, If–then), inline guidance shown, no pre-filled content | N/A                         |
| Add driver           | Type a driver, Add/Enter                | Trimmed value appended to Drivers list; input clears                                          | N/A                         |
| Add barrier          | Type a barrier, Add/Enter               | Trimmed value appended to Barriers list; input clears                                         | N/A                         |
| Empty/whitespace add | Blank add submit                        | No-op (nothing appended)                                                                      | Disabled add / silent no-op |
| Remove entry         | Click remove on a driver/barrier        | Entry removed; gate re-evaluates                                                              | N/A                         |
| Compose if–then      | Fill "If" + "then I will"               | `state.ifThen` = composed string; gate sees a complete plan                                   | N/A                         |
| Partial if–then      | Only "if" filled (or only "then")       | If–then treated as incomplete; advance blocked                                                | N/A                         |
| Advance gate met     | ≥1 driver, ≥1 barrier, complete if–then | "Next: Review →" enabled; advancing goes to Step 4                                            | N/A                         |
| Advance blocked      | Any of the three unmet                  | Advance disabled                                                                              | N/A                         |
| Back then forward    | Enter values, go Back, return           | All values preserved                                                                          | N/A                         |
| No AI content audit  | Step 3 just loaded                      | No field contains suggested/pre-filled text                                                   | N/A                         |

</frozen-after-approval>

## Code Map

- `app/app/goals/new/GoalWizard.tsx` -- EDIT. (1) Tighten Step 3's `isComplete` gate to `drivers.length >= 1 && barriers.length >= 1 && ifThen is complete`. Because `ifThen` is a single composed string, add a small stable helper to detect completeness (e.g. the composed value contains both parts) OR store a structured `ifThen` — keep the string and gate on a non-empty composed value that includes both halves; document the rule. (2) Set Step 3 `nextLabel: "Next: Review →"`. (3) Replace the Step 3 placeholder `render` with `<WizardStep3 ctx={...} />`. Step 4 stays a placeholder.
- `components/goals/WizardStep3.tsx` -- NEW `"use client"`. Heading (via `headingRef`); a reusable multi-value group for Drivers and Barriers (label + guidance + inline add field + removable chips/rows) writing to `state.drivers` / `state.barriers`; a structured If–then group (two inputs → composed `state.ifThen`). All via `ctx.patchState`. No pre-fill.
- `components/goals/WizardStep1.tsx` / `WizardStep2.tsx` -- REFERENCE. Add-item pattern, remove-control styling, `useId` labels, `patchState` usage, Enter-to-add handler to mirror.
- `lib/supabase/schema.ts` -- REFERENCE. `goals.drivers text[]`, `goals.barriers text[]`, `goals.if_then_plan text` — the persisted shapes these map to (arrays + one composed string).
- `_bmad-output/planning-artifacts/ux-designs/.../EXPERIENCE.md` -- REFERENCE. Step 3 = three blank fields with the quoted label guidance; nothing pre-filled.
- `app/globals.css` -- REFERENCE. Tokens for inputs, chips, buttons, focus ring.

## Tasks & Acceptance

**Execution:**

- [x] `components/goals/WizardStep3.tsx` -- Build the three blank groups: multi-value Drivers + Barriers (add/remove, guidance labels) and a structured If–then plan composed into `ifThen`, all via `patchState`, nothing pre-filled -- the real Step 3 UI capturing user-owned inputs.
- [x] `app/app/goals/new/GoalWizard.tsx` -- Tighten Step 3 gate to ≥1 driver && ≥1 barrier && complete if–then, set Step 3 `nextLabel`, mount `<WizardStep3>` -- wires the real step + gate into the shell.
- [x] `components/goals/WizardStep3.test.tsx` -- Unit-test the I/O matrix: empty on load + guidance shown, add/remove driver + barrier, empty-add no-op, compose if–then, partial if–then blocks, advance gate met when all three satisfied, gate blocked when any unmet, back-then-forward preserves, no-pre-fill audit.
- [x] `app/app/goals/new/GoalWizard.test.tsx` -- Update for the Step 3 gate + label; keep existing navigation/invalidation tests green (advancing Step 3→4 now requires drivers/barriers/if–then).

**Acceptance Criteria:**

- Given Step 3 renders, when loaded, then three field groups appear — Drivers (multi-value), Barriers (multi-value), and a structured If–then plan ("If **_, then I will _**") — all blank with no AI-suggested content, with inline label guidance ("An internal strength already working for you", "What actually gets in the way").
- Given advancement, when the user tries to proceed, then at least one Driver, at least one Barrier, and a complete If–then plan are required.

## Design Notes

Compose `ifThen` from two inputs with a stable format, e.g.:

```ts
const composed =
  ifPart && thenPart ? `If ${ifPart}, then I will ${thenPart}` : "";
patchState({ ifThen: composed });
```

Gate completeness for the if–then: treat it as complete only when both the "if" and "then" parts are non-empty (compose to `""` otherwise, so the shell gate is simply `state.ifThen.trim() !== ""`). Keep the two-input local state in the component; the composed string is the single source in `state.ifThen`. Reuse the multi-value add/remove pattern from Step 1/2 for Drivers and Barriers (a small internal `MultiValueGroup` sub-component keeps the two lists DRY). Nothing is ever pre-filled — the no-AI-content audit is the invariant.

## Verification

**Commands:**

- `npx tsc --noEmit` -- expected: no type errors.
- `npx eslint components/goals/WizardStep3.tsx components/goals/WizardStep3.test.tsx app/app/goals/new/GoalWizard.tsx app/app/goals/new/GoalWizard.test.tsx` -- expected: clean.
- `npx vitest run components/goals app/app/goals/new` -- expected: new + updated tests pass.
- `npx vitest run` -- expected: full suite green.

## Suggested Review Order

**Step 3 content (the change core)**

- Entry point: the Step 3 component — three blank groups mounted through the shell context, nothing pre-filled.
  [`WizardStep3.tsx:198`](../../components/goals/WizardStep3.tsx#L198)

- `MultiValueGroup`: reusable blank list (add/remove, guidance label) for Drivers and Barriers.
  [`WizardStep3.tsx:85`](../../components/goals/WizardStep3.tsx#L85)

- If–then compose/parse: `composeIfThen` (both halves → canonical string) and its inverse `parseIfThen` (re-hydrates the inputs on Back/return so re-editing can't wipe the plan).
  [`WizardStep3.tsx:43`](../../components/goals/WizardStep3.tsx#L43)

**Shell wiring**

- Step 3 gate = ≥1 driver && ≥1 barrier && non-empty composed if–then; `nextLabel` "Next: Review →".
  [`GoalWizard.tsx:170`](../../app/app/goals/new/GoalWizard.tsx#L170)

**Tests (peripheral)**

- Step 3 I/O matrix + compose/parse round-trip + Back-then-forward now asserts the if–then input fields re-hydrate (the reviewed desync fix).
  [`WizardStep3.test.tsx:1`](../../components/goals/WizardStep3.test.tsx#L1)
