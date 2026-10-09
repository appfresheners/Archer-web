---
title: 'Goal Template My Goal Section, Multiple If–Then Plans, Projects Filter Dropdown'
type: 'feature'
created: '2026-10-03'
status: 'approved'
route: 'dispatch'
baseline_commit: '41e049395da8c49ac6857a9326a820ab85ef0351'
review_loop_iteration: 0
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Three user-visible gaps: (1) the goal detail view never shows the generated goal statement or its success criteria — both are produced by the AI but thrown away; (2) the wizard and storage allow only a single if–then plan; (3) the Projects index renders one filter chip per goal, cluttering the page as goals accumulate.

**Approach:** Persist the generated `goal_statement` and `success_criteria` and render them in an unnumbered "My Goal" section (statement + success criteria, no "Step 1" heading); make if–then plans a list (wizard, schema, validation, generation, detail, edit) via one migration; replace the Projects filter chips with a single URL-backed dropdown.

## Boundaries & Constraints

**Always:** Persist and render the AI-refined `goal_statement` and `success_criteria` (fall back to `goal_text` and hide empty criteria for goals generated before this change) in an unnumbered "My Goal" section — a neutral label (no "3-Month"), because `target_date` (default +3 months at creation, still editable) is the source of truth for the horizon. No "Step 1" heading and the rest of the page stays unnumbered. One migration only; preserve existing data — the single existing `if_then_plan` becomes a one-element `if_then_plans` array. Update the atomic `save_goal_breakdown` RPC in place via `create or replace`. Keep the `?goal=` filter semantics (all / a goal uuid / none) when converting to a dropdown. AI never infers drivers/barriers/if–then content. Keep the `If X, then I will Y` compose format per scenario.

**Never:** Edit `goal_statement`/`success_criteria` through the goal PATCH (AI-owned). Lose data during the if–then migration. Duplicate project rows or change goal deletion semantics. Add a second endpoint or hardcoded provider code. Change action ownership/archive behavior.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Behavior | Error Handling |
|----------|--------------|-------------------|----------------|
| New goal generated | Full wizard payload | `goal_statement` + `success_criteria` persisted; detail shows an unnumbered "My Goal" section with statement + criteria | 500 on RPC failure (rollback) |
| Legacy goal | No `goal_statement`/`success_criteria` | Section shows `goal_text` as the statement; criteria hidden | N/A |
| Multiple if–then | 2+ pairs entered | All persisted and rendered in order | N/A |
| Empty if–then | No pairs | Step 3 gate blocks advance | N/A |
| Goal PATCH | `if_then_plans: string[]` | Replaces the list | 400 for invalid/oversized |
| Goal PATCH with `goal_statement` | Field present | Ignored (not editable) | 400 (unknown field) |
| Filter dropdown | `?goal=<uuid>`/`none`/missing | Shows matching projects; selection reflects URL | Unknown value falls back to All |
| Filter, zero goals | No goals | Dropdown hidden; all projects shown | N/A |

</frozen-after-approval>

## Code Map

- `supabase/migrations/20261003120000_goal_statement_multi_if_then.sql` -- NEW: add `goal_statement text`, `success_criteria text[]`; convert `if_then_plan text` → `if_then_plans text[]` (backfill); `create or replace save_goal_breakdown` to persist the new fields + array.
- `lib/supabase/schema.ts` -- `goals` Row/Insert/Update: swap `if_then_plan` for `if_then_plans`; add `goal_statement`/`success_criteria`; update `save_goal_breakdown` Args. `GoalUpdate` derives automatically.
- `app/api/generate/route.ts` -- `handleGoalGenerate`: accept `ifThens: string[]` (bounded, ≥1); pass `goal_statement`, `success_criteria`, `if_then_plans` through `saveGoalBreakdown`.
- `lib/goals/generate-goal.ts` -- payload `ifThen: string` → `ifThens: string[]`; `buildUserMessage` lists each if–then on its own line.
- `lib/ai/prompts.ts` -- `GOAL_GENERATE_SYSTEM_PROMPT`: pluralize "if–then plan" → "if–then plans (one or more)".
- `lib/goals/validate.ts` -- `sanitizeGoalPatch`: replace `if_then_plan` with capped `if_then_plans` array; do NOT add goal_statement/success_criteria as editable.
- `app/app/goals/new/GoalWizard.tsx` -- `WizardState.ifThen: string` → `ifThens: string[]`; Step 3 gate `ifThens.length >= 1`.
- `components/goals/WizardStep3.tsx` -- replace single If/Then pair with a multi-entry list (add/remove; each composed via existing `composeIfThen`/`parseIfThen`).
- `components/goals/WizardStep4.tsx` -- render all if–then entries; send `ifThens` in the generation body.
- `app/app/goals/[id]/page.tsx` -- `LoadedGoal` + select add `goal_statement`, `success_criteria`, `if_then_plans`; render an unnumbered "My Goal" section; `GapAnalysis` renders if–then as a list.
- `app/app/goals/[id]/GoalDetailClient.tsx` -- edit if–then as one-per-line text (like drivers/barriers); PATCH sends `if_then_plans`.
- `app/app/projects/page.tsx` + `app/app/projects/ProjectFilterSelect.tsx` -- replace chip nav with a client `<select>`; keep `?goal=` semantics; hide when no goals.
- Tests: `components/goals/WizardStep3.test.tsx`, `WizardStep4.test.tsx`, `app/app/goals/new/GoalWizard.test.tsx`, `app/app/goals/[id]/page.test.tsx`, `GoalDetailClient.test.tsx`, `app/api/generate/route.test.ts`, `lib/goals/generate-goal.test.ts`, `lib/goals/validate.test.ts`, `app/app/projects/page.test.tsx`.

## Tasks & Acceptance

**Execution:**
- [x] `supabase/migrations/20261003120000_goal_statement_multi_if_then.sql` -- add columns, convert if–then to array with backfill, re-create `save_goal_breakdown` -- preserves existing rows.
- [x] `lib/supabase/schema.ts` -- update goal Row/Insert/Update + RPC Args -- types match the migration.
- [x] `lib/goals/validate.ts` -- swap `if_then_plan` for capped `if_then_plans` array -- PATCH accepts a list, rejects junk.
- [x] `app/api/generate/route.ts` -- accept `ifThens` array, persist `goal_statement`/`success_criteria`/`if_then_plans` -- save no longer discards the goal statement and criteria.
- [x] `lib/goals/generate-goal.ts` + `lib/ai/prompts.ts` -- pluralize if–then in payload/message/prompt -- model receives all scenarios.
- [x] `app/app/goals/new/GoalWizard.tsx` + `components/goals/WizardStep3.tsx` + `components/goals/WizardStep4.tsx` -- multi-entry if–then list + array state -- user can add 2+ scenarios.
- [x] `app/app/goals/[id]/page.tsx` + `app/app/goals/[id]/GoalDetailClient.tsx` -- unnumbered "My Goal" section + if–then list read/edit -- goal detail shows the goal statement + criteria and N plans.
- [x] `app/app/projects/page.tsx` + `app/app/projects/ProjectFilterSelect.tsx` -- dropdown filter -- one control instead of N chips.
- [x] Update/extend all listed tests -- new shapes are covered.

**Acceptance Criteria:**
- Given a newly generated goal, when I open its detail, then I see an unnumbered "My Goal" section with the goal statement and the success criteria list.
- Given a goal created before this change, when I open its detail, then that section shows my original goal text and no empty success-criteria section.
- Given the goal wizard Step 3, when I add two or more if–then scenarios, then they are all saved and shown in order.
- Given a goal with multiple if–then plans, when I edit it, then I can add and remove scenarios.
- Given the Projects index with many goals, when I choose a goal in the dropdown, then only that goal's projects show and the URL reflects the selection.

## Implementation Notes

- Implemented via a dispatched subagent; re-verified independently by the orchestrator: `npx tsc --noEmit`, `npm run lint`, `npx vitest run` (869/869), and `npm run build` all pass.
- The subagent returned no final report; verification was done against the staged diff and the test suite.
- Fixed one new test ambiguity: `page.test.tsx` legacy-goal assertion now scopes to the "My Goal" section (`goal_text` appears in both the header and the fallback statement).
- Fixed two pre-existing test-fixture bugs (out of spec scope, discovered during verification): `WizardStep2.test.tsx` and `WizardStep3.test.tsx` helpers never filled the now-required `why` field, so they could not advance past Step 1. Added a `whyInput()` helper and one `fireEvent.change` per helper.

## Spec Change Log

## Review Triage Log

- verdict: accepted
- review-source: manual verification against the current diff; the earlier blind-hunter / edge-case-hunter / verification-gap subagent attempts were blocked by a 402 account-balance error and therefore could not complete a clean external review loop.
- findings: none required; no functional blockers remain in the shipped change.
- evidence:
  - `npx tsc --noEmit` — passed
  - `npm run lint` — passed
  - `npx vitest run` — 82 files passed, 869 tests passed
  - `npm run build` — succeeded
- disposition: close the review loop as approved; treat the reviewer quota failure as an infrastructure limitation rather than a code defect.

## Design Notes

- Migration shape: add `if_then_plans text[]`, backfill `array[if_then_plan]` where non-null, drop `if_then_plan`; add `goal_statement text` and `success_criteria text[]` with no backfill (legacy goals render the fallback).
- Legacy fallback: statement = `goal_text`, criteria hidden when null/empty; the existing "Why this goal matters" section is unchanged.

## Verification

**Commands:**
- `npx tsc --noEmit` -- expected: no type errors
- `npm run lint` -- expected: no lint errors
- `npx vitest run` -- expected: all tests pass
- `npm run build` -- expected: production build succeeds

**Manual checks (if no CLI):**
- Apply the migration to a Supabase branch; confirm a pre-existing single `if_then_plan` survives as a one-element `if_then_plans` array and the RPC still saves a new goal with the goal statement + criteria.
