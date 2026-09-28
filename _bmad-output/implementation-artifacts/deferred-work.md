# Deferred Work Ledger

## Deferred from: code review of 2-2/2-3 (2026-08-27)

- source_spec: `_bmad-output/implementation-artifacts/spec-1-1-standalone-nextjs-runtime-design-token-foundation.md`
  summary: Add `@media (prefers-reduced-motion: reduce)` handling to disable the `animate-fade-in` utility
  evidence: Review (blind-hunter) — the preserved MVP1 `@utility animate-fade-in` runs a 300ms animation unconditionally; NFR4 accessibility floor calls for respecting reduced-motion. Pre-existing (not introduced by this story); best fixed alongside the Epic 2 output-panel work

- source_spec: `_bmad-output/implementation-artifacts/spec-1-2-supabase-schema-rls-database-triggers.md`
  summary: Enforce that a child row's user_id matches its parent's owner (actions↔projects, projects↔goals, weekly_snapshots↔review_sessions) via constraint/trigger
  evidence: Review (blind + edge-case) — RLS scopes each table by its own user_id only; nothing prevents an action/project/snapshot from linking to another user's parent row. Schema is spine-faithful (spine does not enforce this either); flagged as a security-hardening follow-up

- source_spec: `_bmad-output/implementation-artifacts/spec-1-2-supabase-schema-rls-database-triggers.md`
  summary: fn_commit_action only fires BEFORE UPDATE — a direct INSERT of an action with status='committed' bypasses the single-committed-action decommit
  evidence: Review (edge-case-hunter) — matches the spine's UPDATE-only design and the app commits via UPDATE, but a BEFORE INSERT path (or INSERT branch) would fully close the invariant at the DB layer

- source_spec: `_bmad-output/implementation-artifacts/spec-1-2-supabase-schema-rls-database-triggers.md`
  summary: fn_commit_action has no row-lock/serialization — concurrent commits on the same project could momentarily yield two committed actions
  evidence: Review (edge-case-hunter) — spine-level design; add `select ... for update` on the project row or rely on serializable isolation if the invariant must hold under concurrency

- source_spec: `_bmad-output/implementation-artifacts/spec-1-2-supabase-schema-rls-database-triggers.md`
  summary: Add data-integrity CHECK constraints not present in the spine — week_number 1..53, week_end_date >= week_start_date, inbox processed_at/resolved_project_id consistency with processing_status, completed_at >= started_at
  evidence: Review (edge-case-hunter) — spine omits these; they would reject temporally/logically impossible rows. Deferred to a schema-hardening migration to keep 0001 spine-faithful

- source_spec: `_bmad-output/implementation-artifacts/spec-1-2-supabase-schema-rls-database-triggers.md`
  summary: Enforce weekly_snapshots immutability (block UPDATE) and consider FK indexes on inbox_items.resolved_project_id and weekly_snapshots.review_session_id
  evidence: Review (blind-hunter) — spine describes snapshots as "immutable" but adds no guard; the two FK columns are unindexed. Spine-faithful omissions; harden in a later migration

- source_spec: `_bmad-output/implementation-artifacts/spec-1-3-supabase-client-wiring-auth-middleware-guard.md`
  summary: Capture the originally-requested path as a `redirectedFrom`/`next` query param on the /app/\* → /sign-in redirect so post-login return-to works
  evidence: Review (blind + edge-case) — the guard redirects to a fixed /sign-in with no return-to; cheap to add now, painful to retrofit. Not required by the story ACs (fixed targets); the sign-in page (1.4) must consume the param, so defer to that story

- source_spec: `_bmad-output/implementation-artifacts/spec-1-3-supabase-client-wiring-auth-middleware-guard.md`
  summary: Migrate root middleware.ts to the Next.js 16 `proxy` file convention (middleware→proxy codemod) — currently a deprecation warning
  evidence: Review (blind + verification-gap) — Next 16.3.3 warns the `middleware` convention is deprecated in favor of `proxy`; it still runs correctly as Proxy(Middleware). The frozen spec named `middleware.ts`, so renaming would deviate from approved scope — deferred as a dated tech-debt decision (2026-09-27) to migrate when convenient
  status: done # 2026-09-27 — renamed middleware.ts→proxy.ts and export middleware()→proxy(); deprecation warning gone, build shows "ƒ Proxy (Middleware)", 466 tests pass

- source_spec: `_bmad-output/implementation-artifacts/spec-1-3-supabase-client-wiring-auth-middleware-guard.md`
  summary: Add an `import 'server-only'` guard around the service-role key path so it can never be imported into a client bundle
  evidence: Review (blind-hunter) — getServiceRoleKey lives in lib/supabase/env.ts alongside browser-safe getters used by client.ts, so a whole-module server-only guard would break the browser client. Split the service-role accessor into a server-only module in a later hardening pass

- source_spec: `_bmad-output/implementation-artifacts/spec-1-4-sign-up-sign-in-with-email-and-password.md`
  summary: Move focus to the error region (or first invalid field) when an auth error renders, for keyboard/screen-reader users
  evidence: Review (blind-hunter) — the error is `role="alert"` so it is announced, but focus is not moved; a focus-management pass would improve the a11y floor. Not required by the story ACs

- source_spec: `_bmad-output/implementation-artifacts/spec-1-4-sign-up-sign-in-with-email-and-password.md`
  summary: Add client-side email-format and password-minlength pre-validation before calling Supabase for immediate feedback
  evidence: Review (blind + edge-case) — currently only emptiness is checked client-side (server still validates); pre-validation avoids a round-trip and gives faster feedback. UX refinement, not an AC

- source_spec: `_bmad-output/implementation-artifacts/spec-1-4-sign-up-sign-in-with-email-and-password.md`
  summary: Replace English substring matching in friendlyError with Supabase error code/status-based mapping
  evidence: Review (edge-case + verification-gap) — message-string matching is brittle to locale/wording changes; it falls back to the raw message safely, so this is a robustness refinement

- source_spec: `_bmad-output/implementation-artifacts/spec-1-5-password-reset.md`
  summary: Add a confirm-password field (and client-side minlength) to ResetPasswordForm so a mistyped new password can't lock the user out
  evidence: Review (blind + edge-case) — a single new-password field means a typo becomes the new password with no second-entry check. Real UX-safety improvement; not in the story ACs

- source_spec: `_bmad-output/implementation-artifacts/spec-1-5-password-reset.md`
  summary: Surface the callback's `/sign-in?error=` message on the sign-in page (read via useSearchParams, wrapped in Suspense)
  evidence: Review (edge-case + blind) — the callback sets a descriptive error param on failure but SignInForm does not render it, so the reason is dropped. Deferred because useSearchParams needs a Suspense boundary in the sign-in page (touches Story 1.4 surface); the message is preserved in the URL meanwhile

- source_spec: `_bmad-output/implementation-artifacts/spec-1-5-password-reset.md`
  summary: Handle Supabase `error`/`error_description` params (expired/denied recovery link) in the callback distinctly from a missing code, and add client-side email-format validation to ForgotPasswordForm
  evidence: Review (edge-case) — an expired link arrives with error params and no code, currently falling into the generic no-code branch (still safe, just less specific); email-format pre-validation avoids a user believing an email was sent for a malformed address

- source_spec: `_bmad-output/implementation-artifacts/spec-1-6-authenticated-app-shell-with-responsive-navigation.md`
  summary: Make Settings reachable on mobile (<768px) — e.g. a mobile top bar with wordmark + menu, or a Settings entry/overflow in the bottom nav
  evidence: Review (edge-case + blind, consensus) — Settings lives only in the Sidebar footer which is hidden <768px; the bottom nav has the 4 primary destinations per the AC/DESIGN, so mobile users can only reach /app/settings by direct URL. DESIGN.md mentions a mobile top bar (wordmark + hamburger) not built in this story — implement it in a follow-up

- source_spec: `_bmad-output/implementation-artifacts/spec-1-6-authenticated-app-shell-with-responsive-navigation.md`
  summary: Add a skip-to-content link and route-change focus/announcement for the authenticated shell
  evidence: Review (blind-hunter) — with persistent nav landmarks, keyboard users have no bypass to <main>, and App Router does not reset focus on navigation. WCAG 2.4.1 bypass-blocks improvement beyond this story's stated a11y floor

- source_spec: `_bmad-output/implementation-artifacts/spec-1-6-authenticated-app-shell-with-responsive-navigation.md`
  summary: Handle safe-area insets (env(safe-area-inset-bottom)) for the fixed bottom nav and floating capture button on notched devices, and guard role=textbox in the C-shortcut editable check
  evidence: Review (edge-case + blind) — fixed bottom elements can sit under the iOS home indicator at some zoom levels; the C-shortcut editable guard covers input/textarea/select/contenteditable but not ARIA role=textbox widgets. Minor hardening

- source_spec: `_bmad-output/implementation-artifacts/spec-1-7-ai-provider-configuration-layer.md`
  summary: Verify the documented default model names in .env.example against each provider's current catalog (esp. GEMINI_MODEL=gemini-3.1-flash-lite)
  evidence: Review (blind-hunter) flagged gemini-3.1-flash-lite as possibly not a real model. The value comes from the planning artifacts (epics FR33/FR34); code has no fallback so the operator sets GEMINI_MODEL regardless. Operator/planning verification, not a code fix

- source_spec: `_bmad-output/implementation-artifacts/spec-1-7-ai-provider-configuration-layer.md`
  summary: Add retry/backoff for transient provider failures (429 with Retry-After, 5xx) in lib/ai/generate
  evidence: Review (blind + edge-case) — a single fetch turns every transient blip into a user-facing failure. Out of this story's ACs (timeout is the only resilience requirement); worth adding when generation UX matters (Epic 2)

- source_spec: `_bmad-output/implementation-artifacts/spec-1-7-ai-provider-configuration-layer.md`
  summary: Improve provider-error diagnostics (read .text() when the error body is non-JSON) and accept an external AbortSignal so a client disconnect can cancel the upstream fetch
  evidence: Review (blind + edge-case) — assertOk swallows non-JSON error bodies into {}, losing detail; generate() owns its own AbortController only. Refinements beyond this story's scope; the empty-output guard already surfaces the common blocked-response failure

- source_spec: `_bmad-output/implementation-artifacts/spec-1-7-ai-provider-configuration-layer.md`
  summary: Gate diagnostic logging (getProviderConfig console.info on every call; console.error of provider error bodies) behind a log level, and scrub error bodies before logging
  evidence: Review (blind-hunter) — no key is logged, but per-call info logs are noisy in prod and provider error bodies could echo prompt metadata. Minor observability hardening

- source_spec: `_bmad-output/implementation-artifacts/spec-2-1-single-generation-endpoint-with-auth-provider-path-pattern-a.md`
  summary: The MVP1 root page `app/page.tsx` still POSTs `{ mode: 'goal' }` to /api/generate, which now returns 400 (goal mode moves to Epic 3); the default Home flow errors until this superseded surface is removed
  evidence: Review (verification-gap + blind-hunter) — `app/page.tsx:handleSubmit` defaults mode to 'goal' and its test mocks fetch so no test catches the mismatch. Root cause is the superseded static-export root page, which Story 2.6 removes (dead copy/download + MVP1 output path). Tracked here so 2.6 closes it.

- source_spec: `_bmad-output/implementation-artifacts/spec-2-1-single-generation-endpoint-with-auth-provider-path-pattern-a.md`
  summary: `docs/MASTER GOAL → GTD PROJECT SYSTEM PROMPT.md` still says it is the live prompt for `GOAL_SYSTEM_PROMPT` in `app/api/generate/route.ts`; that inline prompt was removed in 2.1 and the Goal prompt returns in Epic 3
  evidence: Review (verification-gap other-finding) — stale doc reference to a removed symbol. Not caused by this story's code behavior; refresh when the Goal prompt is reintroduced in Epic 3 (Pattern C).

- source_spec: `_bmad-output/implementation-artifacts/spec-2-2-project-mode-input-with-depth-control-validation.md`
  summary: DepthControl does not handle Home/End keys (WAI-ARIA radiogroup pattern recommends Home→first, End→last option)
  evidence: Review (edge-case + blind-hunter) — arrow keys work and the AC only requires keyboard-operability; Home/End is a completeness nicety for a 2-option group. Mirrors the same deferral made for ModeToggle in Epic 1.

- source_spec: `_bmad-output/implementation-artifacts/spec-2-3-project-mode-generation-save-navigation.md`
  summary: Project detail `loadProject` conflates transient DB/network errors with not-found/RLS-deny — all render as 404 instead of distinguishing a 500-class error
  evidence: Review (blind-hunter) — `page.tsx` try/catch returns null on any failure → notFound(). Fail-closed is safe for a detail view and matches the app-shell's fail-to-redirect pattern, but a transient backend error shows as 404, hurting debuggability. Add an error boundary / distinct error state in a later hardening pass.

- source_spec: `_bmad-output/implementation-artifacts/spec-2-4-loading-timeout-provider-error-handling.md`
  summary: Move focus to the error alert (or first invalid field) when a generation error renders, for keyboard/screen-reader users
  evidence: Review (blind-hunter) — the error uses role="alert" aria-live="assertive" so it is announced, but focus is not moved to it. A focus-management pass would raise the a11y floor beyond the AC. Mirrors the same deferral made for the auth forms in Epic 1.

- source_spec: `_bmad-output/implementation-artifacts/spec-2-4-loading-timeout-provider-error-handling.md`
  summary: Recover the in-flight state if client-side navigation to the new project fails to mount (form stays disabled with no error)
  evidence: Review (edge-case + blind-hunter) — on a successful `{id}`, `router.push` leaves `inFlight` true through the transition (intentional, to block double-submit); if the destination fails to load, the form has no recovery path. Low risk (a remount resets state); revisit with a navigation error boundary. Same class of issue noted in Story 2.3.

- source_spec: `_bmad-output/implementation-artifacts/spec-2-6-remove-dead-copy-download-code.md`
  summary: Remove now-unused npm dependencies (react-markdown, rehype-raw, remark-gfm, qrcode) from package.json and regenerate the lockfile
  evidence: Review (blind-hunter) — these were consumed only by the deleted MVP1 components (OutputPanel, SavedBreakdowns). The 2.6 spec's "Ask First" deferred dependency removal (harmless to leave; a later epic may reintroduce a renderer). Drop them in a dedicated dependency-cleanup pass with a lockfile regen + full build.

## Deferred from: code review of 3-1 (2026-09-28)

- source_spec: `_bmad-output/implementation-artifacts/spec-3-1-wizard-shell-stepper-navigation.md`
  summary: Give the Step 1 goal input an explanatory validation message (not just a disabled Next) and a live character counter for the 500-char cap
  evidence: Review (blind-hunter) — the shell's Step 1 uses a placeholder input that gates advancement via a disabled Next button with no reason surfaced, and caps at maxLength=500 with no counter/aria-describedby. Both belong to Story 3.3 (Wizard Step 1 — Goal & Skill Framework), which replaces this placeholder input with the real one (epics.md 3.3 AC: "inline validation blocks advancing" + "live counter"). Deferred to 3.3 so the real input carries them.

- source_spec: `_bmad-output/implementation-artifacts/spec-3-1-wizard-shell-stepper-navigation.md`
  summary: Consider an aria-live region announcing wizard step changes for screen-reader users, in addition to moving focus to the step heading
  evidence: Review (blind-hunter) — focus moves to the new step's first interactive element / heading on advance (per AC), which is the required behavior; a supplementary polite live-region announcement ("Step 2 of 4: Gap Rating") would further aid AT users. A11y enhancement beyond this story's AC; revisit when step content lands (3.3–3.6).

## Deferred from: code review of 3-3 (2026-09-28)

- source_spec: `_bmad-output/implementation-artifacts/spec-3-3-wizard-step-1-goal-skill-framework.md`
  summary: Add UX feedback when the framework is below 3 items and when the advance gate is unmet — an inline hint ("Keep at least 3 skills to continue") near the framework list
  evidence: Review (blind + edge-case) — removing items below 3 silently disables Next with no explanation. AC only requires the gate to enforce ≥3; the "why" hint is a discoverability nicety. Revisit alongside Step 2/wizard polish.

- source_spec: `_bmad-output/implementation-artifacts/spec-3-3-wizard-step-1-goal-skill-framework.md`
  summary: Guard the "Add item" field against duplicate skill names and enforce the 12-item ceiling (MAX_FRAMEWORK_ITEMS) on client-side adds; give framework items stable ids for React keys instead of name-index
  evidence: Review (edge-case + blind) — a user can add a duplicate-named skill or exceed 12 items client-side (the endpoint caps its own output but not user adds); name-index keys collide on duplicates. Benign today (extra rows, no crash); harden when Step 2 consumes the list.

- source_spec: `_bmad-output/implementation-artifacts/spec-3-3-wizard-step-1-goal-skill-framework.md`
  summary: Announce framework readiness to screen readers (polite live region "Framework ready. Rate yourself.") and/or move focus to the framework heading when it renders after Continue
  evidence: Review (blind-hunter) + EXPERIENCE.md ("Framework ready. Rate yourself.") — the framework list appends without an AT announcement or focus move; the loading/error states already use aria-live. A11y enhancement beyond this story's AC.

- source_spec: `_bmad-output/implementation-artifacts/spec-3-3-wizard-step-1-goal-skill-framework.md`
  summary: Give the "Add a skill" input a shorter, name-appropriate maxLength (it currently reuses the 500-char goal cap) and disable Add while a framework re-fetch is in flight
  evidence: Review (blind + edge-case) — a single skill name doesn't need 500 chars; adding during an in-flight re-fetch could race an overwrite. Low impact (list only shows post-fetch); tidy in a later pass.

## Deferred from: code review of 3-4 (2026-09-28)

- source_spec: `_bmad-output/implementation-artifacts/spec-3-4-wizard-step-2-gap-rating.md`
  summary: Guard the Step 2 "Add a skill" field against duplicate names, add a char counter for the 500-char cap, and support Home/End/PageUp/PageDown on the sliders
  evidence: Review (blind + edge-case) — duplicate names produce ambiguous slider `aria-label`s; the add field silently drops whitespace and reuses the 500-char goal cap; native range gives arrow keys but not Home/End. All UX-completeness niceties beyond the AC. Shares the duplicate-guard class already deferred for Step 1 (3.3) — best done once for the shared add-item pattern.

- source_spec: `_bmad-output/implementation-artifacts/spec-3-4-wizard-step-2-gap-rating.md`
  summary: Consider surfacing over-qualification (user rates above required) rather than flooring the gap silently to 0
  evidence: Review (edge-case) — gap = max(0, required − rating) hides the case where the user exceeds the required level. The spec chose the floor-at-0 option deliberately; a "met/exceeded" affordance is a possible future enhancement, not a defect.

- source_spec: `_bmad-output/implementation-artifacts/spec-3-4-wizard-step-2-gap-rating.md`
  summary: Extract the neutral-default (5) and 1–10 scale into shared constants referenced by the instructional copy, so prose can't drift from behaviour
  evidence: Review (blind-hunter) — the intro paragraph hard-codes "starts at 5" / "1 to 10" as prose while the values live as constants in code. Minor maintainability nicety.

## Deferred from: code review of 3-5 (2026-09-28)

- source_spec: `_bmad-output/implementation-artifacts/spec-3-5-wizard-step-3-drivers-barriers-if-then-plan.md`
  summary: Dedupe (or intentionally allow + document) driver/barrier entries and give multi-value rows stable ids instead of value-index keys
  evidence: Review (blind + edge-case) — adding an identical driver/barrier twice yields duplicate rows with colliding value-index React keys and ambiguous remove `aria-label`s. Benign today; part of the shared add-item hardening already deferred for Steps 1/3 (3.3/3.4). Do once for the shared pattern.

- source_spec: `_bmad-output/implementation-artifacts/spec-3-5-wizard-step-3-drivers-barriers-if-then-plan.md`
  summary: Wrap each multi-value group in a fieldset/legend (or role=group + aria-labelledby) and label the add input distinctly (e.g. "Add a driver"); add the shared if-then guidance as aria-describedby on BOTH halves
  evidence: Review (blind-hunter) — the group `<label>` currently names the add input, which reads oddly for AT; only the "If …" input references the shared guidance, not "then I will …". A11y refinements beyond the AC's stated floor.

- source_spec: `_bmad-output/implementation-artifacts/spec-3-5-wizard-step-3-drivers-barriers-if-then-plan.md`
  summary: Add char counters for the 500-char inputs and validate the COMPOSED if-then length against any downstream prompt/storage limit (two 500-char halves + template can exceed ~1000 chars)
  evidence: Review (blind + edge-case) — the maxLength cap is silent and the composed string can be long; Pattern C (3.6) should confirm the goal payload stays within provider/DB limits. Revisit when 3.6 wires the generate payload.

## Deferred from: code review of 3-6 (2026-09-28)

- source_spec: `_bmad-output/implementation-artifacts/spec-3-6-wizard-step-4-review-generate-save-pattern-c.md`
  summary: Make the goals→projects→actions save atomic via a Postgres function/RPC instead of three round-trips with manual compensating deletes
  evidence: Review (blind + edge-case) — the multi-row save is not transactional; a crash mid-sequence can leave partial state, and the manual rollback (now explicit actions→projects→goal) is best-effort. Matches Pattern A's existing non-transactional approach; a shared RPC would make both atomic. Cross-cutting infra improvement.

- source_spec: `_bmad-output/implementation-artifacts/spec-3-6-wizard-step-4-review-generate-save-pattern-c.md`
  summary: Map `GenerationFormatError` to a friendly user-facing message instead of surfacing the internal validation string (e.g. "Expected exactly 12 next actions for project 3 but got 11") verbatim via the 500 path
  evidence: Review (blind-hunter) — `mapGenerateError` passes the error message through for 500s; format-error messages leak internal contract detail to users. Pre-existing behaviour shared with Pattern A (generate-project); fix once across both patterns.

- source_spec: `_bmad-output/implementation-artifacts/spec-3-6-wizard-step-4-review-generate-save-pattern-c.md`
  summary: Add a client-side AbortController on the Step 4 generate fetch aligned to the 30s server timeout, and a success confirmation/placeholder before navigating to the (Epic 4) /app/goals/[id] detail route
  evidence: Review (blind-hunter) — the client relies entirely on the server to bound the request; if the connection stalls the button stays "Generating…" indefinitely. And on success the user is pushed to a route that 404s until Epic 4 ships the Goal detail view. Mirrors the same client-abort deferral noted for Project Mode (2.4). The detail page is Epic 4 (Story 4.2) — the goal IS saved regardless.

- source_spec: `_bmad-output/implementation-artifacts/spec-3-6-wizard-step-4-review-generate-save-pattern-c.md`
  summary: Preserve a framework item's AI `description` on save rather than blanking a non-string to "" in validateFramework, and rely on returned-row identity (not insert array order) to link actions to projects
  evidence: Review (edge-case + blind) — the client always sends the real description so blanking is unreachable today; PostgREST returns multi-row inserts in input order in practice (and sort_order is stored), so action↔project linkage is correct today. Both are robustness hardening for shape drift. Low risk.

## Deferred from: code review of 4-1 (2026-09-28)

- source_spec: `_bmad-output/implementation-artifacts/spec-4-1-goals-list-status-badges.md`
  summary: Distinguish a transient DB/auth failure from a truly-empty goals list — the goals-list `loadGoals` try/catch returns `[]` on any error, so a backend failure renders the "No goals yet" empty state
  evidence: Review (edge-case + blind, consensus) — matches the spec's chosen "degrade to empty state rather than crash" behaviour and the existing project-detail fail-closed pattern (see the 2.3 defer), but a real read failure is indistinguishable from zero goals, hurting debuggability. Add an error boundary / distinct error state in a later hardening pass across the read surfaces.

- source_spec: `_bmad-output/implementation-artifacts/spec-4-1-goals-list-status-badges.md`
  summary: Add pagination / row limits to the goals list reads — `loadGoals` fetches all goals, all projects, and all actions for the user on every render with no bound
  evidence: Review (edge-case + blind) — fine at expected personal-use scale, but the unbounded `projects`/`actions` selects grow with history and the in-memory aggregation loads every action row. Introduce limits/pagination (or a server-side aggregate) when a user can accumulate large volumes; revisit alongside the Engage view (Epic 5) which reads the same tables.

- source_spec: `_bmad-output/implementation-artifacts/spec-4-1-goals-list-status-badges.md`
  summary: Handle a partial read failure (goals succeed but projects OR actions error) explicitly rather than treating a missing result as zero rows
  evidence: Review (edge-case-hunter) — `Promise.all` destructures `data` as undefined on a per-query error and `?? []` then silently yields projectCount/stuckCount of 0 for affected goals. Degrades safely (no crash) but shows misleading counts. Surface a soft indicator or retry when the count reads fail; low risk at current scale.

## Deferred from: code review of 4-2 (2026-09-28)

- source_spec: `_bmad-output/implementation-artifacts/spec-4-2-goal-detail-edit-status-changes.md`
  summary: Make the goal soft-delete cascade (archive projects → archive goal) atomic via a Postgres function/RPC instead of sequential updates with a mid-cascade 500
  evidence: Review (edge-case + verification-gap, consensus) — a failure archiving the goal after its projects are archived leaves projects archived while the goal stays active. The handler halts before archiving the goal if the project step fails (tested), but the reverse partial state is possible. Matches the non-transactional multi-write pattern already deferred for 3.6; a shared RPC would make goal-delete and the generate saves atomic together.

- source_spec: `_bmad-output/implementation-artifacts/spec-4-2-goal-detail-edit-status-changes.md`
  summary: Make the goal delete idempotent — early-return when the goal is already archived rather than re-archiving it and its projects
  evidence: Review (edge-case-hunter) — deleting an already-archived goal re-runs the project + goal archive writes. Harmless (same terminal state) but wasteful; a `status === 'archived'` short-circuit would make DELETE idempotent.

- source_spec: `_bmad-output/implementation-artifacts/spec-4-2-goal-detail-edit-status-changes.md`
  summary: Add client-side pre-validation (goal_text length, date presence) and de-duplication of drivers/barriers before PATCH, and format the header target date like the goals list (short label, not raw YYYY-MM-DD)
  evidence: Review (blind + edge-case) — the edit form relies entirely on the server 400 for feedback and the detail header shows the raw ISO date while the list formats it. UX-consistency niceties beyond the ACs; the mutations are safe as-is.

- source_spec: `_bmad-output/implementation-artifacts/spec-4-2-goal-detail-edit-status-changes.md`
  summary: Add a full focus trap (Tab cycling) to the delete confirmation dialog — focus-on-open, Escape-to-close, and focus-restore are implemented, but Tab can still leave the modal
  evidence: Review (edge-case-hunter) — the alertdialog now moves focus in on open, closes on Escape, and restores focus to the trigger on close, but does not wrap Tab within the dialog. A shared modal primitive with a proper focus trap would close this across Epic 4; low risk for a two-button confirmation.
