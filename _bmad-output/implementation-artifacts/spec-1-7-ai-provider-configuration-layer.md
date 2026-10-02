---
title: "AI Provider Configuration Layer"
type: "feature"
created: "2026-09-27"
status: "done"
baseline_commit: "e5f7bd1bf8adf4111a09dc4a6856d46fc7455a23"
review_loop_iteration: 0
context:
  - "{project-root}/_bmad-output/implementation-artifacts/epic-1-context.md"
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Generation features (Epics 2–3) need to call an AI provider, but there is no clean provider-agnostic configuration layer. The only provider code lives inline in the MVP1 `app/api/generate/route.ts`, and it defaults to OpenAI and uses hardcoded model fallbacks — both of which violate the v1-full contract (Gemini default, no hardcoded models, keys from env only).

**Approach:** Add a `lib/ai/` configuration layer that resolves the provider from `AI_PROVIDER` (default `gemini`), resolves the model from the provider's env var with NO hardcoded fallback (fail loud if unset), reads API keys only from env, and exposes a single `generate(systemPrompt, userMessage)` dispatch that calls the selected provider. This is the reusable foundation Epic 2's `/api/generate` rework will consume; the existing MVP1 route is left untouched here (its cleanup/rework is Epic 2).

## Boundaries & Constraints

**Always:**

- Provider is resolved from `AI_PROVIDER`, lowercased; valid values `gemini | groq | openai`; unset/empty defaults to `gemini`. An invalid non-empty value fails loud (clear error), rather than silently falling back.
- Model is resolved from the provider's env var (`GEMINI_MODEL` / `GROQ_MODEL` / `OPENAI_MODEL`) with NO hardcoded fallback — a missing model var throws a clear, logged error naming the variable. Documented defaults (`gemini-3.1-flash-lite`, `llama-3.1-8b-instant`, `gpt-4o-mini`) live only in `.env.example`, not in code.
- API keys are read only from env (`GEMINI_API_KEY` / `GROQ_API_KEY` / `OPENAI_API_KEY`); a missing key for the active provider throws a clear, actionable error (incl. key-issuance guidance). No key is ever read from request input or persisted.
- Provider config (id, model, key, endpoint) is exposed via a typed accessor; secrets are never logged (log the provider id and model name only, never the key).
- A single `generate(systemPrompt, userMessage)` (or equivalent) dispatches to the selected provider using the resolved config, with a shared 30s timeout via `AbortController`, returning the generated text. Provider HTTP errors surface a clear, actionable message.
- There is no in-app API-key entry UI, anywhere.

**Ask First:**

- Changing the MVP1 `app/api/generate/route.ts` to consume this layer — that wiring is Epic 2; confirm before touching the route here.
- Adding an AI SDK dependency instead of `fetch` (the layer can use `fetch` like the existing route).

**Never:**

- Do not add hardcoded model fallbacks in code (the whole point of the story).
- Do not read or accept API keys from request bodies, query params, or any client input.
- Do not build an in-app key-entry UI.
- Do not rewrite the MVP1 route's Pattern A/B/C handling (Epic 2) — only the config layer is in scope.
- Do not log secrets.

## I/O & Edge-Case Matrix

| Scenario          | Input / State                         | Expected Output / Behavior                               | Error Handling  |
| ----------------- | ------------------------------------- | -------------------------------------------------------- | --------------- |
| Default provider  | `AI_PROVIDER` unset                   | Resolves to `gemini`                                     | N/A             |
| Explicit provider | `AI_PROVIDER=groq`                    | Resolves to `groq`                                       | N/A             |
| Invalid provider  | `AI_PROVIDER=cohere`                  | Throws a clear error naming the invalid value            | Loud failure    |
| Model resolution  | provider=gemini, `GEMINI_MODEL` set   | Returns that model string                                | N/A             |
| Missing model     | provider=gemini, `GEMINI_MODEL` unset | Throws a clear error naming `GEMINI_MODEL` (no fallback) | Loud failure    |
| Missing key       | active provider's key unset           | Throws a clear, actionable error incl. issuance guidance | Loud failure    |
| Generate OK       | valid config, provider returns text   | Returns the generated text                               | N/A             |
| Generate timeout  | provider hangs > 30s                  | Aborts and throws a timeout error                        | AbortController |

## Code Map

- `lib/ai/types.ts` -- **new.** `AiProvider` union (`'gemini' | 'groq' | 'openai'`); `ProviderConfig` shape (id, model, apiKey, endpoint); `GenerateFn` signature.
- `lib/ai/config.ts` -- **new.** `resolveProvider()` (AI_PROVIDER → default gemini, invalid → throw); `resolveModel(provider)` (provider model env var, no fallback → throw naming var); `resolveApiKey(provider)` (provider key env var → throw with issuance guidance); `getProviderConfig()` composing all three. Secrets never logged.
- `lib/ai/generate.ts` -- **new.** `generate(systemPrompt, userMessage)`: gets config, dispatches to the provider-specific fetch call (Gemini `x-goog-api-key`, OpenAI/Groq bearer) with a 30s `AbortController` timeout; returns text; maps provider HTTP errors to actionable messages. Provider request builders may live here or in a small per-provider helper.
- `lib/ai/index.ts` -- **new.** Barrel re-exporting the public surface (`getProviderConfig`, `generate`, types).
- `.env.example` (root) -- existing (Story 1.3). Already lists `AI_PROVIDER`, `GEMINI_MODEL` default, and commented Groq/OpenAI vars; confirm the documented defaults match (`gemini-3.1-flash-lite`, `llama-3.1-8b-instant`, `gpt-4o-mini`). Update only if a default is missing/wrong. Read-mostly.
- `app/api/generate/route.ts` -- existing MVP1 route. Read-only in THIS story (Epic 2 will refactor it to consume `lib/ai/`). Referenced only to mirror the working provider request shapes.
- `lib/supabase/*` -- existing (Stories 1.2–1.3). Note for the data-restoration AC: session + typed clients + RLS are already in place; per-feature data loading is delivered in later epics. No new data-loading code here.

## Tasks & Acceptance

**Execution:**

- [x] `lib/ai/types.ts` -- Provider union, config shape, and generate signature -- shared types for the layer.
- [x] `lib/ai/config.ts` -- `resolveProvider` (default gemini, invalid throws), `resolveModel` (no fallback, throws naming the var), `resolveApiKey` (throws with issuance guidance), `getProviderConfig` -- the env-driven config contract.
- [x] `lib/ai/generate.ts` -- `generate(systemPrompt, userMessage)` dispatching to the selected provider via fetch with a 30s AbortController timeout and actionable error mapping -- the single generation entry the later route consumes.
- [x] `lib/ai/index.ts` -- Barrel export of the public surface.
- [x] `.env.example` -- Verify/complete the documented model defaults and provider/key var list (no code fallbacks).
- [x] `lib/ai/config.test.ts` (+ `generate.test.ts`) -- Unit-test the matrix: default gemini, explicit provider, invalid provider throws, model resolution + missing-model throws (no fallback), missing-key throws, and generate success/timeout/error via a mocked `fetch` -- covers the matrix.

**Acceptance Criteria:**

- Given the `AI_PROVIDER` environment variable, when it is set to `gemini`, `groq`, or `openai`, then the corresponding provider is selected; and when unset, `gemini` is the default.
- Given a selected provider, when the model is resolved, then it comes from the provider's model env var (`GEMINI_MODEL` / `GROQ_MODEL` / `OPENAI_MODEL`) with no hardcoded fallback; and the documented defaults are `gemini-3.1-flash-lite`, `llama-3.1-8b-instant`, `gpt-4o-mini`.
- Given the API keys, when the configuration is inspected, then keys are read only from environment variables (`GEMINI_API_KEY` / `GROQ_API_KEY` / `OPENAI_API_KEY`), and there is no in-app key entry UI.
- Given data restoration on sign-in, when a user authenticates, then their goals, projects, actions, inbox items, and review history load from Supabase and reflect their last known state. (Foundation only: the authenticated session, typed Supabase clients, and RLS established in Stories 1.2–1.3 make per-user data available; the per-feature loading UI is delivered in the epics that build those views.)

## Design Notes

Mirror the provider request shapes already proven in the MVP1 route (Gemini `x-goog-api-key` + `system_instruction`/`contents`; OpenAI/Groq bearer + chat/completions `messages`) but drive model/key/provider entirely from `lib/ai/config.ts` with NO fallbacks — the key behavioral difference from the MVP1 route is: default `gemini` (not openai) and a missing model var throws instead of silently using a hardcoded model. Keep secrets out of logs. The MVP1 route is intentionally left consuming its own inline copy until Epic 2 refactors it onto this layer — do not change it now.

The fourth AC (data restoration) is a foundation-level guarantee for this epic, not new code in this story: sign-in establishes the Supabase session (Story 1.4), the typed server/browser clients exist (Story 1.3), and RLS scopes every table to the user (Story 1.2), so a signed-in user's rows are queryable. The views that render goals/projects/actions/inbox/reviews are built in Epics 2–5; note this explicitly rather than adding speculative loading code here.

## Verification

**Commands:**

- `npx tsc --noEmit` -- expected: the `lib/ai/` layer type-checks.
- `npm test` -- expected: new `lib/ai` config/generate tests pass (matrix incl. no-fallback + default-gemini); existing suite green.
- `npm run lint` -- expected: no new errors.
- `npm run build` -- expected: succeeds; standalone intact.

**Manual checks:**

- Confirm no hardcoded model strings exist in `lib/ai/` code (defaults only in `.env.example`); `resolveModel` throws when the var is unset.
- Confirm `AI_PROVIDER` unset → gemini, invalid → throws.
- Confirm API keys are read only from env and never logged; no key-entry UI anywhere.

## Suggested Review Order

**Config contract (the core of the change)**

- Entry point — env-driven resolution: default gemini, no model fallback (throws naming the var), key-issuance guidance, secrets never logged.
  [`config.ts:52`](../../lib/ai/config.ts#L52)

- Types — provider union, config shape, generate signature.
  [`types.ts:1`](../../lib/ai/types.ts#L1)

**Generation dispatch**

- `generate()` — 30s abort timeout (cross-runtime abort detection), provider dispatch with exhaustive default guard, empty-but-OK responses surfaced as errors, HTTP errors mapped.
  [`generate.ts:38`](../../lib/ai/generate.ts#L38)

**Verification (peripheral)**

- Config + generate unit tests: default/explicit/invalid provider, missing model/key throws, success/HTTP-error/timeout, and empty-response guards.
  [`config.test.ts:1`](../../lib/ai/config.test.ts#L1)
