---
title: "Project Mode Generation, Save & Navigation"
type: "feature"
created: "2026-09-27"
status: "done"
baseline_commit: "44f3bcaa4a66bc579de15d4a3834f97ad5402bcf"
review_loop_iteration: 0
context:
  - "{project-root}/_bmad-output/implementation-artifacts/epic-2-context.md"
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Story 2.1 built the `/api/generate` endpoint and 2.2 built the input surface, but nothing turns a submitted project into a saved, depth-aware GTD breakdown and lands the user on it. The endpoint ignores `depth`, uses a single prompt, does not persist, and there is no Project detail view to navigate to.

**Approach:** Complete the Project Mode value loop. Make `/api/generate` depth-aware (Minimal vs Full-GTD Natural Planning Model prompts), and on success write a `projects` row (owned by the signed-in user, with the chosen `planning_depth`, parsed `name`/`purpose`/`successful_outcome`, and full `breakdown_md`) **before** returning the new row `id`. Add a `/app/projects/[id]` detail view that loads the row (RLS-scoped) and renders its breakdown. Wire the `NewProjectClient` seam to POST, then navigate to `/app/projects/{id}`. Save-before-return is mandatory: there is no "show output then decide to save" path, and no copy/download action anywhere.

## Boundaries & Constraints

**Always:**

- `/api/generate` accepts `{ mode: 'project', input, depth }` where `depth` is `'minimal' | 'full_gtd'`. An unrecognized/missing depth for a project request is rejected with 400 before the AI call. (All Story 2.1 guards — auth 401, empty/2000-cap 400 — remain.)
- Depth selects the system prompt and output structure:
  - **Minimal:** outcome-based Name + Purpose + Successful Outcome + exactly 12 sequenced micro next actions.
  - **Full GTD (Allen's Natural Planning Model):** Name + Purpose and Principles + Vision/Outcome + Ideas/Brainstorming + Organizing + exactly 12 micro next actions.
- Save-before-return: on a successful generation the route writes ONE `projects` row for the signed-in user (`user_id = auth.uid()` via the session), `planning_depth` = the request depth, `goal_id = null` (Project Mode is the permitted null-goal case), `breakdown_md` = the full generated markdown, and parsed `name` / `purpose` / `successful_outcome` columns; then it returns `{ id }`. The client navigates only after it has the id.
- Every generated next action follows GTD rules: begins with a physical verb, references a specific real tool/app/website/location, is completable in 2–5 minutes; the first action is the lowest-friction starting point; no action references "Open Notion" as a destination. The project name is outcome-based.
- The Project detail view `/app/projects/[id]` loads the row via the server Supabase client (RLS scopes it to the owner), and renders the stored `breakdown_md`. A row that does not exist or is not owned by the user yields a 404 (RLS returns no row).
- The client navigates to `/app/projects/{id}` after a successful POST. No output is shown on `/app/projects/new` and no "save now?" decision is offered.

**Ask First:**

- Adding a DB migration or changing `projects` columns (the schema already has `name`, `purpose`, `successful_outcome`, `planning_depth`, `breakdown_md`, nullable `goal_id` — use them as-is).
- Introducing a markdown-parsing dependency — prefer a small hand-rolled extractor over adding a library.

**Never:**

- Do not offer any copy or download action, anywhere.
- Do not render generated output on the input page or add a "show output then decide to save" path.
- Do not persist for an unauthenticated request (401 still applies).
- Do not implement the loading/timeout/error UX polish (Story 2.4) or the output-rendering/Notion-optimization polish (Story 2.5) beyond what is needed to display the saved breakdown here.
- Do not write `actions` rows in this story (Project Mode persists the breakdown markdown; structured action rows are an Epic 4 concern) unless a later spec says otherwise.

## I/O & Edge-Case Matrix

| Scenario                   | Input / State                               | Expected Output / Behavior                                                            | Error Handling      |
| -------------------------- | ------------------------------------------- | ------------------------------------------------------------------------------------- | ------------------- |
| Minimal generate           | authed `{project, input, depth:'minimal'}`  | Minimal prompt used; row saved `planning_depth='minimal'`; returns `{ id }`           | N/A                 |
| Full-GTD generate          | authed `{project, input, depth:'full_gtd'}` | Natural-Planning prompt used; row saved `planning_depth='full_gtd'`; returns `{ id }` | N/A                 |
| Missing/invalid depth      | authed project request, `depth` absent/bad  | 400 before AI call                                                                    | Pre-AI validation   |
| Unauthenticated            | no session                                  | 401, no AI call, no save (Story 2.1)                                                  | Loud, pre-AI        |
| Save fails                 | provider ok, Supabase insert errors         | 500 with a clear error; client does NOT navigate                                      | Insert error mapped |
| Navigate after save        | POST returns `{ id }`                       | Client pushes `/app/projects/{id}`                                                    | N/A                 |
| Detail: owned row          | authed, own project id                      | Renders the stored breakdown                                                          | N/A                 |
| Detail: missing/other-user | id not found or not owned                   | 404 (RLS returns no row)                                                              | `notFound()`        |

</frozen-after-approval>

## Code Map

- `lib/ai/prompts.ts` -- **edit.** Rename/replace the single `PROJECT_SYSTEM_PROMPT` with two exports: `PROJECT_MINIMAL_SYSTEM_PROMPT` (current structure: Name + Purpose + Successful Outcome + 12 actions, tightened GTD action rules incl. "no Open Notion", first action lowest-friction) and `PROJECT_FULL_GTD_SYSTEM_PROMPT` (Natural Planning Model: Purpose & Principles → Vision/Outcome → Ideas/Brainstorming → Organizing → 12 actions). Keep both authoritative and placeholder-free.
- `app/api/generate/route.ts` -- **edit.** Read `depth` from the body; validate it (`'minimal' | 'full_gtd'`) for the `project` branch → 400 if missing/invalid. Select the prompt by depth. After `generate()` returns markdown: parse `name`/`purpose`/`successful_outcome`, insert the `projects` row via the server Supabase client (user id from the already-fetched session), and return `{ id }`. Map an insert failure to 500 (no navigation). Preserve the Story 2.1 auth/validation/timeout structure; keep the discriminated `switch` extension point.
- `lib/projects/parse-breakdown.ts` -- **new.** Pure helper `parseProjectBreakdown(markdown): { name; purpose; successful_outcome }` extracting the H1 as name and the `## Purpose` / `## Successful Outcome` section bodies (tolerant of the Full-GTD extra sections; falls back to sensible values, e.g. the input-derived name, if a section is absent). No side effects.
- `app/app/projects/[id]/page.tsx` -- **new.** Server component: load the project by id via `createClient()` (RLS-scoped to the owner); `notFound()` when absent; render heading + the stored `breakdown_md` through the existing `OutputPanel`. Sets `metadata` (or generateMetadata) from the project name.
- `app/app/projects/new/NewProjectClient.tsx` -- **edit.** Replace the no-op `onSubmit` seam: POST `{ mode: 'project', input, depth }` to `/api/generate`; on `{ id }` `router.push('/app/projects/${id}')` + `router.refresh()`; drive `disabled` while in flight. (Deeper loading/timeout/error UX is Story 2.4 — keep a minimal in-flight guard + basic error surface here.)
- `components/OutputPanel.tsx` -- **read-only/reuse.** Renders markdown with react-markdown + remark-gfm + rehype-raw; the detail view reuses it. Polishing (fade-in/scroll/Notion-optimization) is Story 2.5.
- `lib/supabase/server.ts` + `lib/supabase/schema.ts` -- **read-only.** `createClient()` for the route/detail insert+select; `ProjectInsert` / `Project` / `PlanningDepth` types drive the row shape.

## Tasks & Acceptance

**Execution:**

- [x] `lib/ai/prompts.ts` -- Replace the single prompt with `PROJECT_MINIMAL_SYSTEM_PROMPT` and `PROJECT_FULL_GTD_SYSTEM_PROMPT` (Natural Planning Model), each enforcing outcome-based names, exactly 12 micro actions, physical-verb/real-tool/2–5-min rules, first action lowest-friction, and no "Open Notion".
- [x] `lib/projects/parse-breakdown.ts` -- Pure `parseProjectBreakdown(markdown)` returning `{ name, purpose, successful_outcome }` from the H1 + `## Purpose` / `## Successful Outcome` sections, tolerant of missing sections. (ATX-hash-tolerant H1; name clamped to the 200-char DB cap — added in review.)
- [x] `app/api/generate/route.ts` -- Accept + validate `depth`; select prompt by depth; after generation parse the breakdown and insert the `projects` row (owner, `planning_depth`, `goal_id=null`, `breakdown_md`, parsed columns); return `{ id }`; map insert failure to 500.
- [x] `app/app/projects/[id]/page.tsx` -- Server detail view: RLS-scoped load by id, `notFound()` when absent, render name + stored `breakdown_md` via `OutputPanel`, metadata from the name.
- [x] `app/app/projects/new/NewProjectClient.tsx` -- Wire the real submit: POST to `/api/generate`, navigate to `/app/projects/{id}` on success, disable while in flight, surface a basic error if the POST fails (full UX in 2.4).
- [x] `lib/projects/parse-breakdown.test.ts` -- Unit-test the parser: Minimal markdown, Full-GTD markdown (extra sections), and missing-section fallbacks.
- [x] `app/api/generate/route.test.ts` -- Extend: valid Minimal and Full-GTD requests select the right prompt and insert a row with the right `planning_depth` then return `{ id }` (mock Supabase insert + `lib/ai`); missing/invalid depth → 400 with no AI call; insert failure → 500 with no `{ id }`.
- [x] `app/app/projects/[id]/page.test.tsx` + `app/app/projects/new/NewProjectClient.test.tsx` -- Detail-page render/notFound and client navigate/error coverage (added during review to close a verification gap).

**Acceptance Criteria:**

- Given a valid Minimal submission, when generation succeeds, then the AI produces Name (outcome-based) + Purpose + Successful Outcome + exactly 12 sequenced micro next actions, the breakdown is saved as a new `projects` row linked to the signed-in user with `planning_depth = minimal`, and I am navigated to the new Project detail view.
- Given a valid Full GTD submission, when generation succeeds, then the AI produces Name + Purpose and Principles + Vision/Outcome + Ideas/Brainstorming + Organizing + exactly 12 micro next actions, and the row is saved with `planning_depth = full_gtd`.
- Given the save-before-return rule, when generation completes, then the handler writes the Supabase row and returns the row id before the client navigates, there is no "show output then decide whether to save" path, and no copy or download action is offered anywhere.
- Given all generated next actions, when inspected, then each begins with a physical verb, references a specific real tool/app/website/location, and is completable in 2–5 minutes; the first action is the lowest-friction possible starting point; and no action references "Open Notion" as a destination.

## Design Notes

Save happens server-side in the route (not the client) so "save-before-return" is atomic with generation and the client never holds an unsaved result — the POST resolves to `{ id }` and the only next step is navigation. The detail view reads from the DB (not from the POST response body), which keeps the saved row the single source of truth and lets Story 2.5 polish rendering in one place. `parseProjectBreakdown` is a pragmatic extractor for the denormalized columns (used by list/detail later); `breakdown_md` remains the full artifact, so a parser miss degrades a column, never the content. GTD action-quality rules live in the prompts (LLM output isn't unit-testable); tests pin the deterministic seams — depth→prompt selection, row shape, and navigation.

## Verification

**Commands:**

- `npx tsc --noEmit` -- expected: route, parser, detail page, client all type-check.
- `npm test` -- expected: parser + extended route tests pass; existing suite green.
- `npm run lint` -- expected: no new errors.
- `npm run build` -- expected: succeeds; `/app/projects/[id]` dynamic route present; standalone intact.

**Manual checks:**

- Confirm a Minimal and a Full-GTD submission each create a `projects` row with the right `planning_depth` and navigate to `/app/projects/{id}`.
- Confirm no copy/download control appears on the input or detail view.
- Confirm requesting another user's project id (or a nonexistent id) renders the not-found page.

## Suggested Review Order

**Generation → save loop (entry point)**

- Entry point — the POST handler: auth → validate (incl. depth) → depth-aware prompt → generate → save-before-return `{ id }`.
  [`route.ts:83`](../../app/api/generate/route.ts#L83)

- Depth is a required, validated project input that selects both the prompt and the persisted `planning_depth`.
  [`route.ts:136`](../../app/api/generate/route.ts#L136)

- Save-before-return: one `projects` row (owner, `goal_id=null`, parsed columns, full `breakdown_md`); insert failure → 500, no navigation.
  [`route.ts:172`](../../app/api/generate/route.ts#L172)

**Depth-aware prompts**

- Minimal + Full-GTD (Natural Planning Model) prompts with shared GTD action-quality rules (12 actions, physical verb, real tool, no "Open Notion").
  [`prompts.ts:1`](../../lib/ai/prompts.ts#L1)

**Denormalization helper**

- Pure breakdown parser → `{ name, purpose, successful_outcome }`; H1 (ATX-hash-tolerant, clamped to the 200-char DB cap), section bodies keep nested `###`.
  [`parse-breakdown.ts:101`](../../lib/projects/parse-breakdown.ts#L101)

**Destination + client wiring**

- Project detail view: RLS-scoped load, `notFound()` when absent/unowned, renders the stored breakdown via `OutputPanel`.
  [`page.tsx:1`](../../app/app/projects/[id]/page.tsx#L1)

- Client seam: POST → navigate to `/app/projects/{id}` only after `{ id }`; disabled in flight; inline error on failure.
  [`NewProjectClient.tsx:30`](../../app/app/projects/new/NewProjectClient.tsx#L30)

**Supporting**

- Route matrix: depth→prompt, row shape, insert-failure 500, plus all Story 2.1 guards.
  [`route.test.ts:1`](../../app/api/generate/route.test.ts#L1)

- Parser cases (Minimal / Full-GTD / fallbacks / ATX hashes / 200-char clamp).
  [`parse-breakdown.test.ts:1`](../../lib/projects/parse-breakdown.test.ts#L1)

- Detail-page (render + notFound) and client (navigate + error) coverage added during review.
  [`page.test.tsx:1`](../../app/app/projects/[id]/page.test.tsx#L1)
