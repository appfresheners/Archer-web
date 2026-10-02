---
title: "Provider Resilience & Error Observability"
type: "hardening"
created: "2026-10-02"
status: "done"
route: "dispatch"
review_loop_iteration: 0
context: []
baseline_commit: "b34e237caca4ebb4363d1ef012c5c00acaa12512"
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The AI generation path fails hard on any transient provider hiccup — a single 429/5xx becomes a user-facing failure with no retry/backoff — and `assertOk` swallows non-JSON provider error bodies into `{}`, losing diagnostic detail. `generate()` owns its own `AbortController` and cannot be aborted by a disconnecting client, so a closed tab still burns a 30s upstream call. `getProviderConfig` logs on every call and `assertOk` logs raw error bodies unconditionally. `GenerationFormatError` is a duplicated private class with no friendly user message. Separately, every read surface collapses a transient backend/network error into the same empty/404 result as genuinely missing data.

**Approach:** Harden the AI layer — retry/backoff for 429/5xx, non-JSON-safe error diagnostics, an external `AbortSignal`, and log-level-gated + scrubbed logging — wire client fetch abort on unmount, deduplicate `GenerationFormatError` into one shared exported type with a friendly message, and make read surfaces return a discriminated result so a transient error renders as an error instead of empty/404.

## Boundaries & Constraints

**Always:** Preserve the external HTTP API contract (routes, status codes: 504 timeout, 400 validation, 404 not-found, 500 provider/format). No key or prompt material is ever logged; scrubbed logs carry status + a short message only. Retries apply only to 429 and 5xx, never to other 4xx. The 30s timeout and abort semantics are preserved. Read-path data-fetching semantics are unchanged except that errors are now distinguished from empty/404. A transient read failure renders a minimal error message with a Retry button; a genuine empty/404 is unchanged.

**Never:** No UI redesign and no new dependencies. No logging framework — a minimal env-gated helper. Do not change provider/model selection logic. Do not touch the database layer (H-1 owns that). Do not alter the success response shapes of any route or read page.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Transient 429 then success | provider returns 429 once | Request retried and succeeds | N/A |
| Transient 5xx then success | provider returns 500 once | Request retried and succeeds | N/A |
| 429 with Retry-After | provider returns 429 + header | Backoff honors Retry-After | N/A |
| Client error (401/400) | provider returns 401 | No retry; surfaces immediately | 500 friendly |
| Non-JSON error body | provider returns non-OK with text body | Diagnostic captured; friendly 500 | 500 friendly |
| Client disconnect mid-generate | client aborts its fetch | Upstream provider fetch aborted | N/A |
| Transient read error | DB/network error on a list/detail | Error state rendered | error state |
| Genuine empty/404 | no rows / row missing | Empty state or 404 as today | N/A |

</frozen-after-approval>

## Code Map

- `lib/ai/generate.ts` — `generate()` (37-66) owns its `AbortController` + 30s timeout; `dispatch()` (69-92); `generateWithGemini()` (95-124); `generateWithOpenAiCompatible()` (127-155); `assertText()` (161-176); `assertOk()` (182-199) does `response.json().catch(() => ({}))` and logs the raw body.
- `lib/ai/config.ts` — `getProviderConfig()` (121-132) `console.info`s provider/model on every call.
- `lib/ai/types.ts` / `lib/ai/index.ts` — no error types exported.
- `lib/goals/generate-framework.ts` (51-56), `lib/goals/generate-goal.ts` (63-68), `lib/projects/generate-project.ts` (38-43) — duplicated private `GenerationFormatError`.
- `app/api/generate/route.ts` `mapGenerateError()` (603-640) and `app/api/projects/[id]/regenerate/route.ts` `mapGenerateError()` (29-50) — timeout→504 via `/timed out/i`/`AbortError`, else 500 raw message.
- Client fetch sites (no AbortController): `app/app/projects/new/NewProjectClient.tsx` (~89), `components/goals/WizardStep1.tsx` (~104), `components/goals/WizardStep4.tsx` (~64), `app/app/projects/[id]/ProjectDetailClient.tsx` (~160).
- Read surfaces (conflate error with empty/404): `app/app/goals/page.tsx` `loadGoals()` (52-118); `app/app/projects/page.tsx` `loadProjects()` (33-54); `app/app/inbox/page.tsx` `loadInboxItems()` (27-43); `app/app/engage/page.tsx` `loadEngageModel()` (53-76); `app/app/projects/[id]/page.tsx` `loadProject()` (69-109); `app/app/goals/[id]/page.tsx` `loadGoalDetail()` (60-124); `app/app/inbox/[id]/page.tsx` `loadClarifyData()` (43-66); `app/app/review/monthly/[goalId]/page.tsx` (48-75).
- `lib/ai/generate.test.ts`, `lib/ai/config.test.ts` — existing test structure to extend.

## Tasks & Acceptance

**Execution:**
- [x] `lib/ai/generate.ts` — add retry/backoff for 429/5xx (honor Retry-After; cap retries; jitter), accept an external `AbortSignal` alongside the internal timeout, make `assertOk` read non-JSON bodies via `.text()`, and scrub error logging to status + short message — resilient, observable provider calls
- [x] `lib/ai/config.ts` — gate the per-call `console.info` behind a minimal log-level env gate — quieter prod logs
- [x] `lib/ai/errors.ts` (new) — export a single shared `GenerationFormatError` — one source of truth
- [x] `lib/goals/generate-framework.ts`, `lib/goals/generate-goal.ts`, `lib/projects/generate-project.ts` — import the shared error instead of the private copies — dedupe
- [x] `app/api/generate/route.ts`, `app/api/projects/[id]/regenerate/route.ts` — map `GenerationFormatError` to a friendly message (still 500) in `mapGenerateError` — friendly format errors
- [x] `app/app/projects/new/NewProjectClient.tsx`, `components/goals/WizardStep1.tsx`, `components/goals/WizardStep4.tsx`, `app/app/projects/[id]/ProjectDetailClient.tsx` — create an `AbortController` per fetch and abort on unmount — no state update after unmount
- [x] `app/app/goals/page.tsx`, `app/app/projects/page.tsx`, `app/app/inbox/page.tsx`, `app/app/engage/page.tsx`, `app/app/projects/[id]/page.tsx`, `app/app/goals/[id]/page.tsx`, `app/app/inbox/[id]/page.tsx`, `app/app/review/monthly/[goalId]/page.tsx` — return a discriminated result (data | not-found | error) and render an error message with a Retry button on the error branch — transient errors are no longer silent empty/404
- [x] `lib/ai/generate.test.ts`, `lib/ai/config.test.ts` and colocated page tests — cover retry success, no-retry-on-4xx, non-JSON body, external abort, log gating, and error-vs-empty rendering — regression coverage

**Acceptance Criteria:**
- Given a 429 or 5xx that then succeeds, when generation runs, then the request is retried and succeeds without surfacing a failure
- Given a 401 or other 4xx, when generation runs, then no retry occurs and the error surfaces immediately
- Given a provider error with a non-JSON body, when the error is read, then the body text is captured and the message is not `{}`
- Given a client disconnect during generation, when the client aborts, then the upstream provider fetch is aborted
- Given a transient read failure, when a list or detail page loads, then it renders a minimal error message with a Retry button rather than empty/404
- Given genuinely missing data, when a list or detail page loads, then it renders empty/404 exactly as before
- Given the changed surfaces, when `npm run test`, `npm run lint`, and `npx tsc --noEmit` run, then they pass

## Implementation Notes

- Retry loop lives in `lib/ai/generate.ts` (`dispatch`) around a new internal `ProviderHttpError` carrying `status` + `retryAfterSeconds`; `assertOk` now reads `.text()` and logs only status + a truncated/scrubbed detail.
- `AI_LOG_LEVEL` (default `warn`) gates `getProviderConfig`'s `console.info`; `GenerationFormatError` is shared from `lib/ai/errors.ts` and mapped to a friendly 500 in both route `mapGenerateError`s.
- Server routes pass `request.signal` through to `generate()`; the four client fetch sites abort on unmount via a ref-held `AbortController`.
- Read pages return `ReadResult`/`ReadListResult` (from `lib/read-result.ts`) and render `components/shared/ReadErrorState.tsx` on the error branch; detail pages reserve `not-found` for a genuinely missing/non-owned row.

## Spec Change Log

## Review Triage Log

- blind-hunter · sprint-status epic-H comments misattributed (a11y/resilience comment ↔ key rotation) · defer: pre-existing tracking-file issue; human chose to leave keys as-is.
- blind-hunter · external abort conflated with the 30s timeout message · low: rejected (the client has already disconnected, so nobody receives the misleading 504; fixing adds an abort-origin flag).
- blind-hunter · `ProviderHttpError` says "check your API key" for 429/5xx that exhausted retries · medium: patched — status-specific message (rate-limit vs temporary problem vs key/billing).
- blind-hunter · AC "all tests pass" vs Verification excluding 31 pre-existing failures · false: already reconciled in Verification.
- blind-hunter · `supabase/.temp/cli-latest` bundled · false: reverted, not in the change.
- blind-hunter · `parseRetryAfterSeconds` HTTP-date branch untested · low: rejected (rare branch; delta-seconds is the common form).
- blind-hunter · abort-during-backoff `sleep()` path untested · low: rejected (needs fake timers for marginal coverage).
- blind-hunter · `ProjectDetailClient` status/goal/save fetches not aborted · medium: patched — all four fetches now abort on unmount.
- blind-hunter · `ReadErrorState` focus management + Retry disabled state · focus part defer (belongs to the a11y-cluster story); Retry-disabled part low: rejected.
- blind-hunter · `GenerationFormatError` branch returns friendly 500 without logging the diagnostic · medium: patched — both routes log the underlying message.
- blind-hunter · `mapGenerateError` duplicated between routes · low: rejected (no named divergence harm).
- blind-hunter · `AI_LOG_LEVEL=silent` does not silence `console.error` · low: rejected (default `warn` already gates info; errors are scrubbed).
- edge-case-hunter · secondary-query errors ignored in `loadGoals`/`loadProject`/`loadGoalDetail`/`loadClarifyData` · medium: patched — each loader now captures and surfaces sub-query errors.
- verification-gap · `GenerationFormatError` friendly branch untested in routes · patch: added route tests asserting the friendly 500 and that the internal message is not leaked.
- verification-gap · route → `generate()` signal forwarding untested · defer: mock wrappers drop the options arg; behavior is covered at the `lib/ai` level.
- verification-gap · `loadProjects` error branch untested · patch: added a read-error test.
- verification-gap · `loadMonthlyCheck` error branches untested · patch: added a goal-error test.
- verification-gap · inbox list and clarify loaders have no tests · defer: no test files exist; low-complexity surfaces.
- verification-gap · client abort-on-unmount untested in four components · defer: component unmount/abort tests not added.
- verification-gap · engage explicit error-field branch untested · patch: added a resolved-error test.

## Design Notes

- **Retry policy:** retry only 429 and 5xx, at most two additional attempts, exponential backoff (base ~500ms) with full jitter, honoring `Retry-After` when present — all within the existing 30s timeout budget. 4xx is never retried (client errors are not transient).
- **Log gating:** a minimal `AI_LOG_LEVEL` env gate (default `warn`) controls `getProviderConfig`'s per-call `console.info` (only at `info`/`debug`); error bodies are scrubbed to status + a short provider message before any `console.error`. No key, prompt, or response body is ever logged.
- **Abort wiring:** the server route passes the incoming request's signal through to `generate()`, so a client disconnect cancels the upstream fetch; client components abort their own fetch on unmount.

## Verification

**Commands:**
- `npx tsc --noEmit` — expected: no type errors
- `npm run test` — expected: all tests pass (excluding the 31 pre-existing `WizardStep2/3` failures)
- `npm run lint` — expected: clean
- `npm run build` — expected: successful build
