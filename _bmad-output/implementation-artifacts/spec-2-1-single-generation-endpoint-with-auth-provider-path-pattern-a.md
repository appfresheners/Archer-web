---
title: "Single Generation Endpoint with Auth & Provider Path (Pattern A)"
type: "refactor"
created: "2026-09-27"
status: "done"
baseline_commit: "04e5dd6bbebb62691f3b3719254761586633e7da"
review_loop_iteration: 0
context:
  - "{project-root}/_bmad-output/implementation-artifacts/epic-2-context.md"
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The MVP1 `app/api/generate/route.ts` is unauthenticated, embeds its own inline provider code (defaulting to OpenAI with hardcoded model fallbacks), and carries the full goal/project prompt bodies inline. The v1-full architecture requires ONE authenticated route that all generation flows share — one auth check, one provider path (the `lib/ai/` layer built in Story 1.7), one 30-second timeout — and Pattern A (`{ mode: 'project', input }`) is the first flow to run through it.

**Approach:** Rework the route so it (1) rejects any request without a valid Supabase session with 401 before any AI call, (2) validates and dispatches on a discriminated body `{ mode, input }` (only `project` is wired now; the route is structured so Epic 3 adds Patterns B/C without a second endpoint), (3) enforces the 2,000-character server safety cap before the AI call, and (4) delegates the actual provider call to `generate()` from `lib/ai`, which already owns provider selection and the 30s timeout. The response is a non-streamed JSON `{ markdown }`. Move the Project Mode system prompt into a dedicated `lib/ai/prompts` module so the route stays thin.

## Boundaries & Constraints

**Always:**

- The route reads the session via the server Supabase client (`lib/supabase/server.ts` → `createClient().auth.getUser()`). If there is no authenticated user, respond `401` and make NO provider call.
- Input validation runs before any provider call: empty/whitespace-only → `400`; input longer than 2,000 characters → `400`; `mode` must be a recognized value.
- The provider call goes through `generate(systemPrompt, userMessage)` from `lib/ai` — the route never calls a provider (fetch to OpenAI/Gemini/Groq) directly and never reads API keys.
- The route is the single generation endpoint. Structure the handler so additional patterns (goal framework = Pattern B, goal generate = Pattern C in Epic 3) slot in by adding a branch, reusing the same auth check, provider path, and timeout — not a new file.
- The response is non-streamed JSON. Success → `{ markdown }`; failures → `{ error }` with an appropriate status.
- The 30-second timeout is owned by `lib/ai` (`generate()` aborts at 30s); the route maps a timeout/provider error to a clear, actionable message with the right status.

**Ask First:**

- Changing the `lib/ai/` layer's public surface or timeout behavior (it is the frozen Story 1.7 contract).
- Adding persistence (saving a `projects` row) — that is Story 2.3, not this story.

**Never:**

- Do not implement Pattern B or Pattern C generation logic here (Epic 3).
- Do not save anything to Supabase in this story (Story 2.3 owns save-before-return).
- Do not build the `/app/projects/new` UI here (Story 2.2).
- Do not stream the response.
- Do not read API keys from the request body or reintroduce inline provider fetch code / hardcoded model fallbacks.

## I/O & Edge-Case Matrix

| Scenario              | Input / State                          | Expected Output / Behavior                                           | Error Handling                  |
| --------------------- | -------------------------------------- | -------------------------------------------------------------------- | ------------------------------- |
| Unauthenticated       | No valid Supabase session              | `401 { error }`, no provider call                                    | Loud, pre-AI                    |
| Valid project request | Authed, `{ mode: 'project', input }`   | Loads Project prompt, calls `generate()`, returns `200 { markdown }` | N/A                             |
| Empty input           | Authed, `input` empty/whitespace       | `400 { error }`, no provider call                                    | Pre-AI validation               |
| Over safety cap       | Authed, `input.length > 2000`          | `400 { error }`, no provider call                                    | Pre-AI validation               |
| Unknown mode          | Authed, `mode` not recognized          | `400 { error }`, no provider call                                    | Pre-AI validation               |
| Provider timeout      | provider hangs > 30s                   | `504 { error }` clear retry message                                  | `generate()` aborts; route maps |
| Provider/config error | missing key / HTTP error from provider | `500 { error }` actionable (incl. API-key guidance)                  | route maps `generate()` error   |
| Empty AI response     | provider returns 200 but no text       | surfaced as error (not silent "")                                    | `generate()` throws; route maps |

</frozen-after-approval>

## Code Map

- `app/api/generate/route.ts` -- **rework.** Currently unauthenticated with inline provider fns (`generateWithOpenAI/Groq/Gemini`, `getProvider`) and inline `GOAL_SYSTEM_PROMPT`/`PROJECT_SYSTEM_PROMPT`. Replace with: auth guard via `createClient().auth.getUser()` → 401; parse `{ mode, input }`; validate (empty, 2000-cap, mode); build `userMessage`; call `generate(systemPrompt, userMessage)`; return `{ markdown }`. Map errors: `AbortError`/timeout → 504, config/provider → 500. Remove all inline provider code and prompt bodies.
- `lib/ai/index.ts` -- **read-only.** Barrel exports `generate`, `getProviderConfig`, types. Import `generate` from here.
- `lib/ai/generate.ts` -- **read-only.** `generate(systemPrompt, userMessage)` owns provider dispatch + 30s AbortController timeout; throws named/timeout + mapped HTTP errors. The route relies on this contract.
- `lib/supabase/server.ts` -- **read-only.** `createClient()` → server Supabase client; use `.auth.getUser()` for the auth guard (matches `app/app/layout.tsx` pattern).
- `lib/ai/prompts.ts` -- **new.** Export `PROJECT_SYSTEM_PROMPT` (the Project Mode GTD system prompt). Extracted from the current route's `PROJECT_SYSTEM_PROMPT` so the route stays thin and Epic 2/3 prompts live in one place. (Goal prompt stays out until Epic 3.)
- `app/app/layout.tsx` -- **reference only.** Shows the established `createClient()` + `auth.getUser()` + graceful-failure pattern to mirror.

## Tasks & Acceptance

**Execution:**

- [x] `lib/ai/prompts.ts` -- Extract and export `PROJECT_SYSTEM_PROMPT` (the GTD Project Mode system prompt) so the route body is thin and prompts are centralized.
- [x] `app/api/generate/route.ts` -- Rework: add Supabase auth guard (401 before any AI call); parse and validate `{ mode, input }` (empty → 400, `> 2000` → 400, unknown mode → 400); dispatch `project` through `generate(PROJECT_SYSTEM_PROMPT, userMessage)`; return non-streamed `{ markdown }`; map timeout → 504 and config/provider errors → 500 with actionable messages; delete all inline provider fns, `getProvider`, and inline prompt bodies.
- [x] `app/api/generate/route.test.ts` -- Unit-test the I/O matrix by mocking `lib/supabase/server` (`getUser`) and `lib/ai` (`generate`): 401 when unauthenticated (asserts `generate` NOT called), 200 `{ markdown }` on valid project request, 400 for empty / over-2000 / unknown-mode, 504 on timeout error, 500 on provider/config error, and empty-response surfaced as error.

**Acceptance Criteria:**

- Given the `/api/generate` route, when a request arrives without a valid Supabase session, then it responds 401 and no AI call is made.
- Given an authenticated request with body `{ mode: 'project', input }`, when it is processed, then the handler loads the Project Mode system prompt, calls the configured provider via `lib/ai`, applies a 30-second timeout, and the response is not streamed.
- Given the endpoint, when inspected, then it is the single route serving generation (Pattern A now; B/C added in Epic 3) sharing one auth check, one provider-selection path, and one timeout handler, and components would call `fetch('/api/generate', ...)` rather than a provider directly.
- Given a request whose input exceeds the server safety cap, when it is processed, then input longer than 2,000 characters is rejected with 400 before the AI call.

## Design Notes

The auth guard mirrors `app/app/layout.tsx`: isolate the Supabase call so it never swallows control flow, treat any error or missing user as unauthenticated (401). Keep the discriminated dispatch obvious — a `switch (mode)` with a `project` branch today and a clear extension point — so Epic 3 adds `goal`/`step` branches without touching auth/validation/timeout. Reuse the existing route's error mapping shape (AbortError → timeout status) but source the actual abort from `generate()`.

## Verification

**Commands:**

- `npx tsc --noEmit` -- expected: route + prompts type-check.
- `npm test` -- expected: new `route.test.ts` matrix passes; existing suite green.
- `npm run lint` -- expected: no new errors.
- `npm run build` -- expected: succeeds; standalone intact.

**Manual checks:**

- Confirm no provider `fetch(...)` calls or model strings remain in `route.ts` (all provider logic is in `lib/ai`).
- Confirm an unauthenticated POST returns 401 with no provider invocation.

## Suggested Review Order

**Endpoint contract (the core of the change)**

- Entry point — the single POST handler: auth-first, then validate, then dispatch, then delegate.
  [`route.ts:56`](../../app/api/generate/route.ts#L56)

- Auth guard — Supabase session read isolated in try/catch; any error or no user → treated as unauthenticated.
  [`route.ts:46`](../../app/api/generate/route.ts#L46)

- Discriminated dispatch — `switch (mode)` with the `project` branch today and a `never`-guarded extension point for Epic 3 B/C.
  [`route.ts:103`](../../app/api/generate/route.ts#L103)

- Mode allow-list — `KNOWN_MODES`/`isKnownMode` gate unknown modes to 400 before any AI call.
  [`route.ts:32`](../../app/api/generate/route.ts#L32)

**Error mapping**

- Timeout → 504, everything else → 500 with the (key-free) actionable message preserved.
  [`route.ts:138`](../../app/api/generate/route.ts#L138)

**Supporting**

- Project Mode system prompt extracted from the route so the handler stays thin.
  [`prompts.ts:1`](../../lib/ai/prompts.ts#L1)

- I/O matrix coverage: 401/400/200/504/500 paths with `lib/ai` + Supabase mocked.
  [`route.test.ts:1`](../../app/api/generate/route.test.ts#L1)
