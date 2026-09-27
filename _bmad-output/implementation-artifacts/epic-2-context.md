# Epic 2 Context: Project Mode Generation & Output Rendering

<!-- Compiled from planning artifacts. Edit freely. Regenerate with compile-epic-context if planning docs change. -->

## Goal

This epic delivers the first end-to-end AI generation flow: a signed-in user types a project, picks how deep the plan should go (Minimal or Full GTD), and receives a complete GTD project breakdown that is generated, persisted to Supabase, rendered as formatted output, and lands them on the new project's detail view. It stands up the single `/api/generate` endpoint (Pattern A) that every later generation flow will reuse, and it retires the superseded copy/download output path so no unauthenticated or non-persisted output can exist. It matters because it proves the whole generate → save → render → navigate spine on the simplest input before the more complex goal wizard (Epic 3) is layered on top.

## Stories

- Story 2.1: Single Generation Endpoint with Auth & Provider Path (Pattern A)
- Story 2.2: Project Mode Input with Depth Control & Validation
- Story 2.3: Project Mode Generation, Save & Navigation
- Story 2.4: Loading, Timeout & Provider Error Handling
- Story 2.5: Formatted Output Rendering & Notion-Optimized Markdown
- Story 2.6: Remove Dead Copy/Download Code

## Requirements & Constraints

- Every generation request requires an authenticated Supabase session. An unauthenticated call must return 401 before any AI provider call is made. There is no unauthenticated or guest generation path.
- Input handling: free-text up to 500 characters enforced in the UI (character counter shown once past 400 chars), with a hard 2,000-character server-side safety cap that rejects longer input before the AI call. Empty or whitespace-only input is blocked with inline validation. Enter key and the "Break it down" button are equivalent submit paths.
- A project depth choice (Minimal default / Full GTD) is a first-class input: it is passed to the endpoint and determines both the system prompt used and the generated structure. Minimal must remain the zero-friction default — the depth control must not obstruct the one-input flow.
- Generation output structure is depth-aware. Minimal: outcome-based name + Purpose + Successful Outcome + exactly 12 sequenced micro next actions. Full GTD (Allen's Natural Planning Model): name + Purpose & Principles + Vision/Outcome + Ideas/Brainstorming + Organizing + exactly 12 micro next actions.
- GTD template integrity is a generation-quality gate, not just a formatting nicety: project names are outcome-based; every next action begins with a physical verb, references a specific real tool/app/website/location, and is completable in 2–5 minutes; the first action is the lowest-friction possible starting point; generic filler is a quality failure; no action may reference "Open Notion" as a destination.
- Save-before-return is mandatory: on success the handler writes the new `projects` row (with `planning_depth` = `minimal` or `full_gtd`) linked to the signed-in user and returns the row ID before the client navigates to the project detail view. There is no "show output, then decide whether to save" path.
- No copy or download action appears anywhere in the product.
- Timeout is 30 seconds. On timeout, a user-facing error toast with a retry option appears and the user's input is preserved. Provider errors surface a clear, actionable message, including API-key misconfiguration guidance (e.g. add the provider key to `.env.local`).
- While a request is in flight the submit button shows a spinner and "Generating…" and the input is disabled.
- Output must render with `react-markdown` + `remark-gfm` + `rehype-raw`; `rehype-raw` is mandatory so `<details>/<summary>` accordions render. Generated content body uses the JetBrains Mono typeface.
- The output panel is hidden until the first generation, then enters with a subtle fade-in that is suppressed when `prefers-reduced-motion` is set. After generation the viewport smooth-scrolls so the top of the output panel is visible.
- Generated markdown must be Notion-optimized: `#`/`##`/`###` headings, `- [ ]` checkboxes, `| pipe |` tables, `<details>/<summary>` accordions for the projects section, and blank-line block separation with no trailing-whitespace empty blocks.

## Technical Decisions

- Single generation endpoint (Pattern A): one `app/api/generate/route.ts` handler serves all generation. It performs one auth check (401 if unauthenticated), one provider-selection path, and one 30-second timeout handler. This epic implements only Pattern A `{ mode: 'project', input }` → markdown → saved `projects` row; Patterns B and C are added in Epic 3 on this same route. No streaming.
- Components never call an AI provider directly — they call `fetch('/api/generate', ...)`. Provider selection and keys stay server-side.
- Provider abstraction: the provider is chosen via `AI_PROVIDER` (gemini default; groq; openai) with a per-provider configurable model env var and no hardcoded fallbacks. API keys come from environment variables only (`.env.local` / `.env.example` canonical); there is no in-app key entry. A missing var should fail loudly.
- Persistence: a generated project is written to the `projects` table with a `user_id` owned by the signed-in user and a `planning_depth` enum column persisting the depth choice so re-open/regenerate preserves it. RLS is default-deny scoped to `auth.uid()`. Project Mode is the one permitted case where a project may have a null `goal_id`.
- Server-side Supabase access uses the route-handler client; client components use the browser client. Auth is read from the Supabase session cookie.
- Cleanup: `ActionBar`, `lib/utils/clipboard.ts`, and `lib/utils/download.ts` remain from the prior static-export build and must be removed / left unreferenced by any UI surface. After cleanup, build and existing tests must pass with no references to the removed modules.

## UX & Interaction Patterns

- Project Mode surface (`/app/projects/new`): a single text input with placeholder "e.g., Personal portfolio website deployed online", the Minimal/Full-GTD depth control, and a "Break it down" button, followed by an Output Panel that appears only after the first generation.
- The depth control meets the same accessibility bar as every other control: keyboard-operable, exposes ARIA state, ≥ 44×44px touch target, and ≥ 4.5:1 contrast.
- Convenience affordances: "Try an example" pre-fills the input and auto-generates; "Start over" clears the input and refocuses it.
- On success, auto-save to Supabase then navigate to the Project detail view — the flow never leaves the user on a transient, unsaved result.

## Cross-Story Dependencies

- Story 2.1 (the endpoint) is the foundation for 2.2–2.5; the UI stories consume the route it defines.
- Stories 2.3 and 2.5 depend on the authenticated app shell, Supabase schema, and `projects` table with `planning_depth` established in Epic 1.
- The `/api/generate` route built here is extended in Epic 3 (Patterns B and C for the goal wizard); keep the auth/provider/timeout scaffolding generic enough to host those without a second endpoint.
- Story 2.6 (dead-code removal) is independent of the others but should land so no copy/download path coexists with the new save-before-return flow.
