# Epic 2 Context: Project Mode Generation & Structured Persistence

<!-- Compiled from planning artifacts. Edit freely. Regenerate with compile-epic-context if planning docs change. -->

## Goal

This epic delivers the first end-to-end AI generation flow: a signed-in user types a project, picks how deep the plan should go (Minimal or Full GTD), and receives a complete GTD project breakdown that is generated as structured JSON, validated server-side, persisted to Supabase as structured rows (`projects` + `actions`), and lands them on the new project's detail view — which renders directly from the stored structured data. It stands up the single `/api/generate` endpoint (Pattern A) that every later generation flow will reuse, and it retires the superseded copy/download output path so no unauthenticated or non-persisted output can exist. It matters because it proves the whole generate → validate → save → navigate spine on the simplest input before the more complex goal wizard (Epic 3) is layered on top. No markdown is ever generated, parsed, or stored.

## Stories

- Story 2.1: Single Generation Endpoint with Auth & Provider Path (Pattern A)
- Story 2.2: Project Mode Input with Depth Control & Validation
- Story 2.3: Project Mode Generation, Save & Navigation (structured JSON → Supabase rows → detail view)
- Story 2.4: Loading, Timeout & Provider Error Handling
- Story 2.5: REMOVED — obsolete markdown/Notion rendering story; the detail view (2.3) renders from structured rows.
- Story 2.6: Remove Dead Copy/Download Code

## Requirements & Constraints

- Every generation request requires an authenticated Supabase session. An unauthenticated call must return 401 before any AI provider call is made. There is no unauthenticated or guest generation path.
- Input handling: free-text up to 500 characters enforced in the UI (character counter shown once past 400 chars), with a hard 2,000-character server-side safety cap that rejects longer input before the AI call. Empty or whitespace-only input is blocked with inline validation. Enter key and the "Break it down" button are equivalent submit paths.
- A project depth choice (Minimal default / Full GTD) is a first-class input: it is passed to the endpoint and determines both the system prompt used and the generated structure. Minimal must remain the zero-friction default — the depth control must not obstruct the one-input flow.
- Generation returns STRUCTURED JSON, never markdown, and it is validated server-side before persistence. Minimal: `{ name (outcome-based), purpose, successful_outcome, next_actions: string[12] }`. Full GTD (Allen's Natural Planning Model): `{ name, purpose, principles[], vision, ideas[], organizing[], next_actions: string[12] }`. A shape that fails validation (missing field, wrong action count) is a generation error, not a saved row.
- GTD template integrity is a generation-quality gate: project names are outcome-based; every next action begins with a physical verb, references a specific real tool/app/website/location, and is completable in 2–5 minutes; the first action is the lowest-friction possible starting point; generic filler is a quality failure; no action may reference "Open Notion" — Archer itself is the system of record.
- Save-before-return is mandatory: on success the handler writes the new `projects` row (scalar `name`/`purpose`/`successful_outcome`, `planning_depth`, `planning_detail` JSON for Full GTD, `goal_id = null`) plus one `actions` row per next action, all owned by the signed-in user, and returns the new project id before the client navigates. If the actions insert fails, the orphaned project row is rolled back. There is no "show output, then decide whether to save" path.
- No copy or download action appears anywhere in the product. No markdown is stored (`breakdown_md` is dropped).
- Timeout is 30 seconds. On timeout, a user-facing error with a retry option appears and the user's input is preserved. Provider errors surface a clear, actionable message, including API-key misconfiguration guidance (e.g. add the provider key to `.env.local`).
- While a request is in flight the submit button shows a spinner and "Generating…" and the input is disabled.
- The project detail view renders every field from the stored structured data — scalar columns, the `planning_detail` JSON sections, and the `actions` rows as a checklist. There is no markdown renderer and no same-page output panel (the flow navigates to a dedicated detail page).

## Technical Decisions

- Single generation endpoint (Pattern A): one `app/api/generate/route.ts` handler serves all generation. It performs one auth check (401 if unauthenticated), one provider-selection path, and one 30-second timeout handler, then persists structured rows. This epic implements only Pattern A `{ mode: 'project', input, depth }` → validated JSON → saved `projects` + `actions` rows; Patterns B and C are added in Epic 3 on this same route. No streaming.
- Structured generation lives in `lib/projects/generate-project.ts`: it selects the depth-aware prompt, calls `lib/ai`'s `generate()`, then parses + validates the JSON into a typed shape. `lib/ai/prompts.ts` holds the two JSON-emitting prompts.
- Components never call an AI provider directly — they call `fetch('/api/generate', ...)`. Provider selection and keys stay server-side.
- Provider abstraction: the provider is chosen via `AI_PROVIDER` (gemini default; groq; openai) with a per-provider configurable model env var and no hardcoded fallbacks. API keys come from environment variables only. A missing var fails loudly.
- Persistence: a generated project is written to `projects` (owner `user_id`, `planning_depth` enum, `planning_detail` JSONB for Full-GTD extras) plus `actions` rows (one per next action, `sort_order` preserving sequence). RLS is default-deny scoped to `auth.uid()`. Project Mode is the one permitted case where a project may have a null `goal_id`. The `projects.breakdown_md` column is dropped (migration `0002`).
- Server-side Supabase access uses the route-handler / server client; the detail view is a server component reading the RLS-scoped rows.
- Cleanup: `ActionBar`, `lib/utils/clipboard.ts`, and `lib/utils/download.ts` remain from the prior static-export build and must be removed / left unreferenced by any UI surface. After cleanup, build and existing tests must pass with no references to the removed modules.

## UX & Interaction Patterns

- Project Mode surface (`/app/projects/new`): a single text input with placeholder "e.g., Personal portfolio website deployed online", the Minimal/Full-GTD depth control, and a "Break it down" button.
- The depth control meets the same accessibility bar as every other control: keyboard-operable, exposes ARIA state, ≥ 44×44px touch target, and ≥ 4.5:1 contrast.
- On success, auto-save to Supabase then navigate to the Project detail view — the flow never leaves the user on a transient, unsaved result. The detail view renders the structured breakdown (purpose, outcome, Full-GTD sections, and a next-actions checklist).

## Cross-Story Dependencies

- Story 2.1 (the endpoint) is the foundation for 2.2–2.4; the UI stories consume the route it defines.
- Story 2.3 depends on the authenticated app shell, Supabase schema (`projects` + `actions` with `planning_depth`/`planning_detail`), established in Epic 1 + migration `0002`.
- The `/api/generate` route built here is extended in Epic 3 (Patterns B and C for the goal wizard); keep the auth/provider/timeout/validation scaffolding generic enough to host those without a second endpoint.
- Story 2.6 (dead-code removal) is independent of the others but should land so no copy/download path coexists with the new save-before-return flow.
