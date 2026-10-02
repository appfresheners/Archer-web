---
title: "Wizard Step 4 — Review, Generate, Save (Pattern C)"
type: "feature"
created: "2026-09-28"
status: "done"
review_loop_iteration: 0
baseline_commit: "58fd1191d266b0b48ab0f09f0ecb9e32def3e851"
context:
  - "{project-root}/_bmad-output/implementation-artifacts/epic-3-context.md"
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Step 4 is a placeholder and the `goal`/`generate` endpoint branch is stubbed to 400. There is no way to review the wizard inputs, generate the full Reverse-Goal-Setting + GTD breakdown, or save it — the payoff of the whole wizard.

**Approach:** Complete the wizard end to end. (1) Add a `GOAL_GENERATE_SYSTEM_PROMPT` that returns STRUCTURED JSON (never markdown), mirroring the master doc's template as a JSON shape. (2) Add `lib/goals/generate-goal.ts` (parse + validate) like `generate-project.ts`. (3) Wire the Pattern C branch in `route.ts`: validate the full payload, call the generator, and SAVE `goals` + `projects` + `actions` rows (save-before-return, with rollback on partial failure), returning `{ id }`. (4) Build `WizardStep4` — a review summary of Steps 1–3 with per-section "Edit" links, a "Generate my breakdown" button with a "Generating your GTD breakdown…" 30-second flow, and an error path that stays on Step 4 with inputs intact + "Try again". On success, navigate to `/app/goals/{id}`.

## Boundaries & Constraints

**Always:**

- Generation returns STRUCTURED JSON, never markdown (the Epic 2 decision). Persist as structured rows; nothing markdown is stored or rendered.
- Reuse the single endpoint `app/api/generate/route.ts`, its auth guard, the `lib/ai` provider path, the 30-second timeout, and `mapGenerateError`. Replace the stubbed `goal`/`generate` 400 with the real branch. Patterns A and B stay unchanged.
- Pattern C request: `{ mode:'goal', step:'generate', goal, framework, ratings, drivers, barriers, ifThen }`. Here `framework` is the confirmed `SkillFrameworkItem[]` (with each `user_rating` from Step 2); `ratings` may be omitted since ratings live inline on `framework` — send `framework` as the source of truth. Validate: authed; `goal` non-empty ≤2000; `framework` a non-empty array (≥3) each with numeric `required_level` (1–10) and numeric `user_rating` (1–10); `drivers`/`barriers` non-empty string arrays; `ifThen` non-empty string. Reject with 400 before the provider call.
- Save-before-return, in order, all owned by the signed-in user: insert ONE `goals` row (`goal_text = goal`, `target_date` = today + 3 months, `skill_framework` = the framework JSON incl. `user_rating`, `drivers`, `barriers`, `if_then_plan = ifThen`, default status); then one `projects` row per generated project (`goal_id` = new goal id, `name`, `purpose`, `successful_outcome`, `sort_order`); then one `actions` row per next action (`project_id`, `text`, `sort_order`). On ANY insert failure, roll back what was written (delete the goal — its projects/actions cascade or are deleted first) and return 500; the client must never navigate on failure.
- Breakdown JSON contract (validated server-side): a `goal_statement` string; `success_criteria` string[] (≥3); `projects` array of 5–6 items, each `{ name, purpose, successful_outcome, next_actions: string[12] }`; each next action a physical-verb micro-action. Enforce counts (projects 5–6, exactly 12 actions each) like `generate-project.ts` enforces 12. Malformed → GenerationFormatError → 500.
- On success the API returns `{ id }` (the goal id). The client navigates to `/app/goals/{id}` only after the save resolves.
- On timeout/provider/format/save error: the wizard stays on Step 4 with ALL inputs intact, shows an error (toast/inline alert, `aria-live`) and a "Try again" that re-runs generation with the same payload; NO goal is created (or it was rolled back).
- Abandoning the wizard writes nothing (transient state; no mid-flow persistence) — already true, keep it.
- Step 4 review shows all inputs: goal text, framework with required levels + the user's ratings (gaps highlighted, amber ≥4 like Step 2), drivers, barriers, if–then plan; each section has an "Edit" affordance returning to the relevant step (via the shell — add a `goToStep(index)` to the step context, gated so it can't skip forward past unmet gates).

**Ask First:**

- Emitting markdown instead of structured JSON (contradicts the Epic 2 decision).
- Changing the `goals`/`projects`/`actions` schema or the Pattern A/B contracts.
- Persisting a partial breakdown without rollback.

**Never:**

- Do not build the Goal detail view (`/app/goals/[id]`) — that is Epic 4 (Story 4.2). Navigation targets `/app/goals/{id}`; the page arriving later is a known forward dependency (documented below), not this story's scope.
- Do not store markdown anywhere.
- Do not let the AI supply the user's ratings/drivers/barriers/if–then — those come from the wizard payload verbatim and are persisted as given.

## I/O & Edge-Case Matrix

| Scenario               | Input / State                                                              | Expected Output / Behavior                                                                             | Error Handling          |
| ---------------------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | ----------------------- |
| Review render          | On Step 4 with full state                                                  | Summary of goal, framework+ratings (gaps, amber ≥4), drivers, barriers, if–then; Edit link per section | N/A                     |
| Edit link              | Click "Edit" on framework                                                  | Returns to the relevant step (state preserved)                                                         | N/A                     |
| Generate happy         | Click Generate                                                             | "Generating your GTD breakdown…"; on 200 `{id}`, navigate to `/app/goals/{id}`                         | N/A                     |
| Save-before-return     | Successful generation                                                      | goals + projects + actions rows written before `{id}` returned                                         | N/A                     |
| Unauthenticated        | No session                                                                 | 401 before provider call                                                                               | 401 JSON                |
| Bad payload            | Missing/short framework, empty goal/drivers/barriers/ifThen, over-cap goal | 400 before provider call                                                                               | 400 JSON                |
| Malformed model output | Wrong shape / <5 or >6 projects / ≠12 actions                              | 500 format error; nothing saved                                                                        | 500 JSON                |
| Timeout                | Provider aborts at 30s                                                     | 504; wizard stays on Step 4, inputs intact, Try again; no goal created                                 | 504 JSON + inline alert |
| Save failure           | goals/projects/actions insert fails                                        | Rollback written rows; 500; client does not navigate                                                   | 500 JSON + inline alert |
| Patterns A/B intact    | project / goal-framework requests                                          | Unchanged                                                                                              | Unchanged               |

</frozen-after-approval>

## Code Map

- `lib/ai/prompts.ts` -- EDIT. Add `GOAL_GENERATE_SYSTEM_PROMPT`: instruct STRICT JSON `{ goal_statement, success_criteria: string[≥3], projects: [{ name, purpose, successful_outcome, next_actions: string[12] }] (5–6) }`. Encode the master-doc rules (outcome-based project names; first 2 projects close the top-2 gaps; physical-verb 2–5-min actions; no "Open Notion"; specific to the user's goal + inputs; no generic filler). The user's ratings/drivers/barriers/if–then are provided as CONTEXT to tailor output but are NOT re-emitted. Keep beside the Project/Framework prompts. Update the master doc's header note (it says the prompt is markdown + lives inline in the route — now it's JSON in prompts.ts).
- `lib/goals/generate-goal.ts` -- NEW. Mirror `generate-project.ts`: `generateGoal(payload)` builds the user message from goal+framework+ratings+drivers+barriers+ifThen, calls `generate()`, tolerant `parseJson`, `validate` into `GeneratedGoal` (`{ goal_statement, success_criteria, projects: GeneratedGoalProject[] }`). Enforce counts (success_criteria ≥3; projects 5–6; each next_actions exactly 12). Export helpers for tests.
- `app/api/generate/route.ts` -- EDIT. Replace the `step === 'generate'` 400 stub with the real branch: validate the Pattern C payload, call `generateGoal`, then persist goals→projects→actions with rollback, return `{ id }`. Reuse `getAuthenticatedUserId`, `MAX_INPUT_LENGTH`, `mapGenerateError`. Compute `target_date` = today + 3 months (ISO date). Keep Patterns A/B behaviourally identical.
- `lib/projects/generate-project.ts` + `app/api/generate/route.ts` (Pattern A save) -- REFERENCE. Canonical parse/validate/format-error + the projects/actions insert-with-rollback pattern to mirror for the multi-row goal save.
- `lib/supabase/schema.ts` -- REFERENCE. `GoalInsert`, `ProjectInsert`, `ActionInsert` shapes; `SkillFrameworkItem` (persisted in `skill_framework`); default statuses.
- `app/app/goals/new/GoalWizard.tsx` -- EDIT. Add `goToStep(index)` to `StepContext` (gated: may go back freely, may not jump forward past an unmet gate). Set Step 4 `nextLabel` unused (Step 4 has no "next" — it generates); ensure the shell's advance button is hidden/disabled on the last step (already `isLastStep` disables it). Mount `<WizardStep4 ctx={...} />`.
- `components/goals/WizardStep4.tsx` -- NEW `"use client"`. Review summary (goal, framework rows with required + user rating + gap amber ≥4, drivers, barriers, if–then), per-section "Edit" → `ctx.goToStep(n)`, "Generate my breakdown" button → POST Pattern C (loading "Generating your GTD breakdown…", error inline + "Try again"), navigate to `/app/goals/{id}` on success via `useRouter`.
- `app/app/projects/new/NewProjectClient.tsx` -- REFERENCE. Fetch → status→message mapping (504/500/network) + Try-again preserving inputs + `router.push` only after `{id}`.

## Tasks & Acceptance

**Execution:**

- [x] `lib/ai/prompts.ts` -- Add `GOAL_GENERATE_SYSTEM_PROMPT` (strict JSON breakdown; master-doc rules; user self-assessment as context only) and refresh the master-doc sync note -- the Pattern C system prompt.
- [x] `lib/goals/generate-goal.ts` -- Build `generateGoal(payload)` + exported parse/validate mirroring `generate-project.ts` (counts: success_criteria ≥3, projects 5–6, 12 actions each) -- typed, validated breakdown.
- [x] `app/api/generate/route.ts` -- Replace the `generate`-step stub with payload validation + `generateGoal` + goals→projects→actions save (rollback on failure) + `{ id }`; reuse auth/timeout/error mapping; leave A/B intact -- Pattern C wired end to end.
- [x] `app/app/goals/new/GoalWizard.tsx` -- Add gated `goToStep` to the step context and mount `<WizardStep4>` -- enables Edit links and the review step.
- [x] `components/goals/WizardStep4.tsx` -- Build the review summary (Edit links), Generate flow (loading/error/Try-again), and navigate-on-success -- the Step 4 UI.
- [x] `lib/goals/generate-goal.test.ts` -- Unit-test parse/validate edge cases (valid, fenced, non-JSON, missing fields, <3 criteria, <5/>6 projects, ≠12 actions).
- [x] `app/api/generate/route.test.ts` -- Extend for Pattern C: auth 401; bad-payload 400 (each field); happy path saves goal+projects+actions and returns `{id}`; save-failure rollback → 500; timeout 504; format 500; Patterns A/B still pass.
- [x] `components/goals/WizardStep4.test.tsx` -- Test the review render (all sections + gaps), Edit → goToStep, Generate happy (mock fetch → navigate), error → inline alert + Try again + stays on Step 4.
- [x] `app/app/goals/new/GoalWizard.test.tsx` -- Update for `goToStep` + Step 4 mount; keep navigation/gating green.

**Acceptance Criteria:**

- Given Step 4 renders, when shown, then it summarizes all Step 1–3 inputs (goal, framework with required levels and the user's ratings + gaps, drivers, barriers, if–then) and each section has an "Edit" link returning to the relevant step.
- Given "Generate my breakdown", when clicked, then it posts `{ mode:'goal', step:'generate', goal, framework, ratings, drivers, barriers, ifThen }` and shows "Generating your GTD breakdown…" under a 30-second timeout.
- Given successful generation, when the breakdown returns, then it contains a 3-month goal statement, ≥3 success criteria, 5–6 outcome-named projects each with purpose, successful outcome, and 12 micro next actions; and the result is written to Supabase as `goals` + `projects` + `actions` rows before navigating to the new Goal detail view.
- Given a timeout or provider/save error, when generation fails, then the wizard stays on Step 4 with all inputs intact, shows an error and a "Try again", and no goal is created.
- Given the user abandons the wizard before success, when checked, then nothing is written to localStorage or Supabase mid-flow and there is no recovery.

## Design Notes

Persistence order + rollback (mirror Pattern A's projects/actions save, extended by the parent goal):

```
insert goals row → goalId
insert projects rows (goal_id=goalId, sort_order=i) → projectIds[]
insert actions rows (project_id=projectIds[p], sort_order=j)
on any failure: delete goal (cascade) — or delete actions→projects→goal — return 500
```

`target_date`: `new Date(); setMonth(+3)` → ISO `YYYY-MM-DD`. `skill_framework` persists the framework array verbatim (with `user_rating`). The breakdown's Priority-1/2 "names match linked project character-for-character" rule is a prompt instruction; the server validates structure (counts/shape), not cross-references — keep validation structural to avoid over-fitting. JSON shape kept flat and Pattern-A-like so the same tolerant parse works.

Known forward dependency: `/app/goals/[id]` (Goal detail) is Epic 4. Navigation targets it per the AC; until Epic 4 lands, the destination 404s but the goal IS saved. Do not build the detail page here.

## Verification

**Commands:**

- `npx tsc --noEmit` -- expected: no type errors.
- `npx eslint app/api/generate/route.ts lib/goals/generate-goal.ts lib/goals/generate-goal.test.ts app/api/generate/route.test.ts lib/ai/prompts.ts components/goals/WizardStep4.tsx components/goals/WizardStep4.test.tsx app/app/goals/new/GoalWizard.tsx app/app/goals/new/GoalWizard.test.tsx` -- expected: clean.
- `npx vitest run lib/goals app/api/generate components/goals app/app/goals/new` -- expected: new + updated tests pass.
- `npx vitest run` -- expected: full suite green (Patterns A/B, Steps 1–3 unregressed).

## Suggested Review Order

**Persistence (the highest-risk surface)**

- Entry point: Pattern C handler — validates the full payload (goal, framework ≥3 rated, bounded drivers/barriers/ifThen) before any provider call.
  [`route.ts:361`](../../app/api/generate/route.ts#L361)

- Save-before-return: goals→projects→actions with explicit FK-order rollback (actions→projects→goal, because `goal_id` is SET NULL not cascade).
  [`route.ts:428`](../../app/api/generate/route.ts#L428)

**Generation**

- `generateGoal` + validation (goal_statement, ≥3 success criteria, 5–6 projects, exactly 12 actions each), user self-assessment sent as context only.
  [`generate-goal.ts:111`](../../lib/goals/generate-goal.ts#L111)

- `GOAL_GENERATE_SYSTEM_PROMPT` — strict JSON breakdown, master-doc rules, never re-emits the user's ratings/drivers/barriers.
  [`prompts.ts:160`](../../lib/ai/prompts.ts#L160)

**Step 4 UI + shell**

- Review summary (Edit links via `goToStep`), Generate flow (loading/error/Try-again), navigate to `/app/goals/{id}` only after `{id}`.
  [`WizardStep4.tsx:50`](../../components/goals/WizardStep4.tsx#L50)

- Gated `goToStep` added to the step context (backward free, forward blocked past an unmet gate).
  [`GoalWizard.tsx:258`](../../app/app/goals/new/GoalWizard.tsx#L258)

**Tests (peripheral)**

- Generator parse/validate edges.
  [`generate-goal.test.ts:1`](../../lib/goals/generate-goal.test.ts#L1)

- Pattern C route: validation, happy-path save (goal+5 projects+60 actions, drivers/barriers verbatim), FK-order rollback, caps, error mapping; A/B intact.
  [`route.test.ts:1`](../../app/api/generate/route.test.ts#L1)

- Step 4: review render + gaps, Edit→goToStep, generate→navigate, error→Try again stays on Step 4.
  [`WizardStep4.test.tsx:1`](../../components/goals/WizardStep4.test.tsx#L1)
