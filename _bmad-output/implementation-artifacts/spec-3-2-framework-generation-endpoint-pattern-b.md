---
title: "Framework Generation Endpoint (Pattern B)"
type: "feature"
created: "2026-09-28"
status: "done"
review_loop_iteration: 0
baseline_commit: "8642c6bcff1e855c22f6b75255480326fc87557d"
context:
  - "{project-root}/_bmad-output/implementation-artifacts/epic-3-context.md"
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The goal wizard (Story 3.3) needs an AI-proposed skill framework for a goal to hold in transient state, but `/api/generate` only knows Pattern A (`mode: 'project'`). There is no way to request a framework, and no framework prompt or generator exists.

**Approach:** Add Pattern B to the existing single endpoint: a `{ mode: 'goal', step: 'framework', goal }` request returns a skill/attribute framework as JSON (items with `name`, `required_level` 1–10, and a goal-specific `description`) and writes NO database row. Mirror Pattern A's proven structure exactly — a `GOAL_FRAMEWORK_SYSTEM_PROMPT` in `lib/ai/prompts.ts`, a `lib/goals/generate-framework.ts` module (parse + validate, like `generate-project.ts`), and a new dispatch branch in `route.ts` — reusing the same auth guard, `lib/ai` provider path, and 30-second timeout.

## Boundaries & Constraints

**Always:**

- Reuse the ONE endpoint `app/api/generate/route.ts`. Add a `goal`/`framework` branch to the existing dispatch. No second endpoint, no inline provider fetch, no hardcoded model strings.
- Reuse the existing auth guard (401 before any provider call), the `generate()` provider path, and its 30-second timeout — do not duplicate them.
- Pattern B writes NO Supabase row. It returns the framework JSON for the client to hold in transient wizard state.
- The AI supplies only the Target Profile: each item's `name`, `required_level` (integer 1–10), and a goal-specific `description`. It must NEVER supply the user's current rating — that is user-owned data collected in Step 2 (Story 3.4). The Pattern B response contains no rating/current-level field of any kind.
- Validate before the provider call: `goal` must be a non-empty trimmed string and ≤ 2,000 characters (the same server cap Pattern A enforces). Reject with 400 otherwise.
- Validate the model output shape server-side (like `generate-project.ts`): a non-empty array of items, each with a non-empty `name`, an integer `required_level` in 1–10, and a non-empty `description`. Malformed output → a format error mapped to 500. Enforce a sane item-count floor/ceiling (at least 3 — the wizard's minimum — and a reasonable upper bound).
- Error mapping reuses Pattern A's contract: timeout → 504, provider/format/config error → 500, each with a user-safe, key-free message. Reuse the route's existing `mapGenerateError`.
- The framework item shape returned by the API aligns with the persisted `SkillFrameworkItem` field names (`name`, `required_level`, `description`) minus `user_rating`, so Pattern C (Story 3.6) and Step 2 (Story 3.4) add `user_rating` without renaming.

**Ask First:**

- Changing Pattern A's request/response contract or its `project` validation while adding Pattern B.
- Persisting anything for Pattern B (violates the no-DB-write invariant).

**Never:**

- Do not build the wizard Step 1 UI or fetch wiring (Story 3.3) — this is the endpoint + generator only.
- Do not include a current-rating / user-level field in the framework prompt or response.
- Do not remove or weaken the `project` mode path.

## I/O & Edge-Case Matrix

| Scenario               | Input / State                                                                        | Expected Output / Behavior                                                              | Error Handling |
| ---------------------- | ------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------- | -------------- |
| Happy path             | Authed `{ mode:'goal', step:'framework', goal:'Become a confident public speaker' }` | 200 `{ framework: [{ name, required_level, description }, …] }`, ≥ 3 items, no DB write | N/A            |
| Unauthenticated        | No/invalid session                                                                   | 401 before any provider call                                                            | 401 JSON error |
| Empty goal             | `{ mode:'goal', step:'framework', goal:'   ' }`                                      | Rejected before provider call                                                           | 400 JSON error |
| Over-cap goal          | `goal` length > 2000                                                                 | Rejected before provider call                                                           | 400 JSON error |
| Unknown step           | `{ mode:'goal', step:'bogus', goal }`                                                | Rejected                                                                                | 400 JSON error |
| Missing step           | `{ mode:'goal', goal }` (no `step`)                                                  | Rejected                                                                                | 400 JSON error |
| Malformed model output | Model returns non-JSON / wrong shape / <3 items / non-1–10 level                     | Format error                                                                            | 500 JSON error |
| Provider timeout       | `generate()` aborts at 30s                                                           | 504 timeout message                                                                     | 504 JSON error |
| Provider failure       | Provider HTTP/config error                                                           | 500 with the key-free provider message                                                  | 500 JSON error |
| Pattern A intact       | `{ mode:'project', input, depth }`                                                   | Unchanged: generates + saves + returns `{ id }`                                         | Unchanged      |

</frozen-after-approval>

## Code Map

- `app/api/generate/route.ts` -- EDIT. Extend the request type + validation to recognize `mode:'goal'` with `step:'framework'` and a `goal` string; add a dispatch branch calling `generateFramework(goal)` and returning `{ framework }` (no save). Extend `KNOWN_MODES`/mode typing to include `goal`. Reuse `getAuthenticatedUserId`, the 2000-char cap, and `mapGenerateError`. Keep the `project` branch byte-for-byte behaviourally identical.
- `lib/goals/generate-framework.ts` -- NEW. Mirror `lib/projects/generate-project.ts`: `generateFramework(goal)` selects `GOAL_FRAMEWORK_SYSTEM_PROMPT`, calls `generate()`, reuses/duplicates the tolerant JSON parse, and validates into `GeneratedFramework` (`{ framework: FrameworkItem[] }`). Export `parseJson`/`validate`-style helpers for unit tests. `FrameworkItem = { name: string; required_level: number; description: string }`.
- `lib/ai/prompts.ts` -- EDIT. Add `GOAL_FRAMEWORK_SYSTEM_PROMPT`: instruct the model to return ONLY a JSON object `{ "framework": [ { "name", "required_level" (int 1–10), "description" } ] }`, 5–8 items, goal-specific, required-level = "what level the ideal achiever needs" (NOT importance, NOT the user's current level), no current-rating field. Reference the Target Profile rules from the master prompt doc.
- `lib/projects/generate-project.ts` -- REFERENCE. Canonical parse/validate/format-error structure to mirror (`GenerationFormatError`, `parseJson`, `requireString`, `requireStringArray`).
- `lib/ai/generate.ts` + `lib/ai/index.ts` -- REFERENCE. `generate(systemPrompt, userMessage)` owns provider selection + 30s timeout; import via `@/lib/ai`. No edits.
- `lib/supabase/schema.ts` -- REFERENCE. `SkillFrameworkItem = { name, required_level, description, user_rating }` — Pattern B returns the first three; `user_rating` is added later. Align field names.
- `docs/MASTER GOAL → GTD PROJECT SYSTEM PROMPT.md` -- REFERENCE. Target Profile scoring rule (required level 1–10, not importance) informs the prompt wording.

## Tasks & Acceptance

**Execution:**

- [x] `lib/ai/prompts.ts` -- Add `GOAL_FRAMEWORK_SYSTEM_PROMPT` (strict JSON `{ framework: [...] }`, 5–8 goal-specific items, required_level int 1–10, no current-rating) -- the Pattern B system prompt, kept beside the Project prompts.
- [x] `lib/goals/generate-framework.ts` -- Build `generateFramework(goal)` + exported `parseJson`/`validate` mirroring `generate-project.ts` (tolerant parse, shape validation, `GenerationFormatError`, item-count + 1–10 level checks) -- turns raw model output into a typed, validated framework.
- [x] `app/api/generate/route.ts` -- Add `goal`/`framework` recognition, validation (non-empty ≤2000 goal, known step), and a dispatch branch returning `{ framework }` with no DB write; reuse auth + `mapGenerateError`; leave Pattern A intact -- wires Pattern B into the single endpoint.
- [x] `lib/goals/generate-framework.test.ts` -- Unit-test the parse/validate edge cases (valid, fenced JSON, non-JSON, missing fields, empty framework, <3 items, out-of-range/ non-integer `required_level`, current-rating field absent).
- [x] `app/api/generate/route.test.ts` -- Extend/adds route tests for the Pattern B matrix rows (auth 401, empty/over-cap 400, unknown/missing step 400, happy-path 200 shape + no DB write, timeout 504, provider/format 500) and assert Pattern A still returns `{ id }`.

**Acceptance Criteria:**

- Given an authenticated `{ mode:'goal', step:'framework', goal }` request, when processed, then the handler returns a JSON framework (items with `name`, `required_level` 1–10, goal-specific `description`) and writes no Supabase row.
- Given a `goal` longer than 2,000 characters, when the request is processed, then it is rejected with 400 before the AI call.
- Given Pattern B shares the endpoint, when inspected, then it reuses the same auth check (401), provider path, and 30-second timeout as Pattern A, and Pattern A's behaviour is unchanged.
- Given the AI-never-owns invariant, when the framework is returned, then it contains no user current-rating field of any kind.

## Design Notes

Route dispatch after the auth guard becomes: parse body → if `mode==='goal'` require `step` and branch on it (`framework` → Pattern B today; `generate` → 400 "not yet supported" until Story 3.6) → else `project` (Pattern A). Validate `goal` with the same non-empty + ≤2000 rules used for `input`; a shared local validator is fine.

Framework validation (in `generate-framework.ts`):

```ts
// each item: name non-empty, required_level an integer 1..10, description non-empty
// framework: array, length >= 3 (wizard minimum) and <= 12 (sane ceiling)
```

Prompt must be explicit that `required_level` is the level the _ideal achiever_ needs (per the master doc's SCORING RULE), never the user's current level, and that the object contains only `framework` with `{name, required_level, description}` — no ratings, no prose, no code fences.

## Verification

**Commands:**

- `npx tsc --noEmit` -- expected: no type errors.
- `npx eslint app/api/generate/route.ts lib/goals/generate-framework.ts lib/goals/generate-framework.test.ts app/api/generate/route.test.ts lib/ai/prompts.ts` -- expected: clean.
- `npx vitest run lib/goals app/api/generate` -- expected: new + existing route tests pass.
- `npx vitest run` -- expected: full suite green (no regression to Pattern A).

## Suggested Review Order

**Endpoint dispatch (the change's seam)**

- Entry point: mode dispatch — `goal` branches to Pattern B, `project` (Pattern A) is untouched.
  [`route.ts:130`](../../app/api/generate/route.ts#L130)

- Pattern B handler: validates step + goal (≤2000), calls the generator, returns `{ framework }` with no DB write.
  [`route.ts:267`](../../app/api/generate/route.ts#L267)

**Framework generator (parse + validate)**

- `generateFramework(goal)` — prompt → provider → parse → validate, mirroring `generate-project.ts`.
  [`generate-framework.ts:65`](../../lib/goals/generate-framework.ts#L65)

- Shape validation: 3–12 items, integer `required_level` 1–10, and each item rebuilt to drop any stray current-rating field.
  [`generate-framework.ts:107`](../../lib/goals/generate-framework.ts#L107)

**Prompt**

- `GOAL_FRAMEWORK_SYSTEM_PROMPT` — strict JSON, required_level = ideal-achiever level, never the user's current rating.
  [`prompts.ts:103`](../../lib/ai/prompts.ts#L103)

**Tests (peripheral)**

- Generator parse/validate edge cases + the no-current-rating unit assertion.
  [`generate-framework.test.ts:1`](../../lib/goals/generate-framework.test.ts#L1)

- Pattern B route matrix (auth, validation, happy path + no-DB-write, error mapping) + Pattern A intact.
  [`route.test.ts:294`](../../app/api/generate/route.test.ts#L294)
