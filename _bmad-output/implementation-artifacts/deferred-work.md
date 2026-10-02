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
  status: done # 2026-09-28 verified — Story 2.6 already replaced app/page.tsx with a redirect to /app/engage; no goal-mode POST remains. Not a live bug.

- source_spec: `_bmad-output/implementation-artifacts/spec-2-1-single-generation-endpoint-with-auth-provider-path-pattern-a.md`
  summary: `docs/MASTER GOAL → GTD PROJECT SYSTEM PROMPT.md` still says it is the live prompt for `GOAL_SYSTEM_PROMPT` in `app/api/generate/route.ts`; that inline prompt was removed in 2.1 and the Goal prompt returns in Epic 3
  evidence: Review (verification-gap other-finding) — stale doc reference to a removed symbol. Not caused by this story's code behavior; refresh when the Goal prompt is reintroduced in Epic 3 (Pattern C).
  status: done # 2026-09-28 verified — the doc header now correctly points to GOAL_GENERATE_SYSTEM_PROMPT in lib/ai/prompts.ts (Pattern C, Story 3.6). Already accurate.

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
  status: done # 2026-09-28 verified — WizardStep1.tsx has the live counter (COUNTER_THRESHOLD 400, aria-live polite, aria-describedby), maxLength 500, and inline empty/whitespace validation. Delivered in 3.3.

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
  status: partial # 2026-09-28 — the /app/goals/[id] 404 concern is RESOLVED (Story 4.2 shipped the goal detail page). The client-side AbortController refinement remains open and is now tracked under epic-H (H-3 provider-resilience).

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

## Deferred from: code review of 4-3 (2026-09-28)

- source_spec: `_bmad-output/implementation-artifacts/spec-4-3-project-detail-edit-regeneration.md`
  summary: Make single-project regeneration atomic via a Postgres function/RPC — currently the project AI fields are updated, then actions are deleted and re-inserted in separate calls, so a mid-sequence failure leaves new fields with stale/absent actions
  evidence: Review (edge-case + verification-gap, consensus) — the route returns 500 on each failure branch (now tested) and best-effort restores the prior actions if the new insert fails, but the update+delete+insert is not transactional. Same non-transactional class already deferred for 3.6 and 4.2 goal-delete; a shared RPC would make all three atomic.

- source_spec: `_bmad-output/implementation-artifacts/spec-4-3-project-detail-edit-regeneration.md`
  summary: Warn the user (or preserve) when regenerating a project that has user-edited/committed actions — regeneration silently replaces the entire action list
  evidence: Review (blind-hunter) — once Story 4.4 lets users add/edit/commit actions and 4.5 commits a next action, a regenerate wipes that work. The confirmation modal states actions are replaced, but does not distinguish AI-generated from user-authored actions. Revisit after 4.4/4.5 land so the warning can reflect committed/edited state.

- source_spec: `_bmad-output/implementation-artifacts/spec-4-3-project-detail-edit-regeneration.md`
  summary: Add optimistic-lock / in-flight guarding for concurrent regenerate + status/edit on the same project, and a full Tab focus trap on the regenerate confirmation dialog
  evidence: Review (edge-case + blind) — concurrent mutations could lose updates; the dialog implements focus-on-open, Escape-to-close (guarded while busy), and focus-restore but not Tab cycling. Both are cross-cutting (a shared modal primitive + an RPC/lock) — same focus-trap item deferred for 4.2.

- source_spec: `_bmad-output/implementation-artifacts/spec-4-3-project-detail-edit-regeneration.md`
  summary: Refresh the browser title/breadcrumb promptly when regeneration changes the project name (currently stale until router.refresh resolves) and skip a redundant PATCH when Save is pressed with no field changes
  evidence: Review (edge-case + blind) — minor UX polish; router.refresh() does reconcile, and a no-op save is harmless. Low priority.

## Deferred from: code review of 4-4 (2026-09-28)

- source_spec: `_bmad-output/implementation-artifacts/spec-4-4-action-management-context-tags.md`
  summary: Make the action reorder atomic (single RPC/batched update) and race-safe — currently it verifies the id set then updates sort_order row-by-row in a loop, so a mid-loop failure (now tested → 500) or a concurrent add/delete can leave partially-applied ordering
  evidence: Review (edge-case + blind + verification-gap, consensus) — same non-transactional class already deferred for 3.6 / 4.2 / 4.3. A `reorder_actions(project_id, ids[])` Postgres function would make it atomic and let it re-verify the set under a lock. Also compute append `sort_order` inside the insert (or a sequence) to avoid concurrent-add collisions.

- source_spec: `_bmad-output/implementation-artifacts/spec-4-4-action-management-context-tags.md`
  summary: Decide the intended behavior when a committed action is completed/unchecked — toggling a committed action to done (then back to available) silently drops the committed marking
  evidence: Review (edge-case + blind) — completing a committed action → done is correct GTD, but un-completing returns it to available, losing "committed". Story 4.5 owns commit semantics and the "prompt for the next committed action" flow; resolve this there (e.g. completing a committed action triggers the 4.5 next-action prompt rather than a bare available/done toggle).
  status: done # 2026-09-28 verified — Story 4.5's ActionList.handleToggleDone detects a committed→done completion and opens the next-action prompt (commit the next available action, or mark the project complete) rather than a bare toggle.

- source_spec: `_bmad-output/implementation-artifacts/spec-4-4-action-management-context-tags.md`
  summary: Add optimistic UI + inline validation/rollback for action mutations, cap/validate context-tag value length in the editor to match the server's 60-char limit, and consider drag-and-drop reordering
  evidence: Review (blind + edge-case) — every add/toggle/edit/reorder waits a full round-trip + router.refresh(); the tag editor lets users type past the server cap with no counter; reorder is button-only (satisfies the AC's "reorder", keyboard-operable). All UX polish beyond the ACs.

- source_spec: `_bmad-output/implementation-artifacts/spec-4-4-action-management-context-tags.md`
  summary: Consider a unique/contiguous constraint on (project_id, sort_order) or document that gaps/ties are tolerated, and a per-project action cap / pagination for very large lists
  evidence: Review (edge-case + blind) — ordering is best-effort with possible gaps after add+delete; large projects rewrite all sort_order per move. Fine at expected scale; revisit with the Engage view (Epic 5) which reads the same rows.

## Deferred from: code review of 4-5 (2026-09-28)

- source_spec: `_bmad-output/implementation-artifacts/spec-4-5-commit-single-next-action-stuck-detection.md`
  summary: Add a DB-level backstop for the single-committed invariant (partial unique index `UNIQUE (project_id) WHERE status = 'committed'`, or row-locking in fn_commit_action) so two concurrent commits cannot both succeed
  evidence: Review (blind + edge-case, consensus) — the invariant is currently enforced only by the fn_commit_action trigger's decommit, which is not serialized against concurrent commits. Complements the existing 1-2 deferral about fn_commit_action concurrency/INSERT coverage; a schema-hardening migration should add the unique guard.

- source_spec: `_bmad-output/implementation-artifacts/spec-4-5-commit-single-next-action-stuck-detection.md`
  summary: Gate committing on project status — the commit route and the ActionItem "Commit" button both allow committing an action on a Paused/Completed/Archived project
  evidence: Review (blind + edge-case) — committing on a non-active project is odd but harmless (it just sets committed; stuck detection only applies to active). Restricting it (route 409 + hide/disable the button off-active) belongs with a broader "only active projects surface commit affordances" pass, best done alongside the Engage view (Epic 5) which also reads committed actions.

- source_spec: `_bmad-output/implementation-artifacts/spec-4-5-commit-single-next-action-stuck-detection.md`
  summary: Refresh remaining-available actions when the next-action prompt opens rather than building it from the current (pre-completion) props, and add an "Add next action" affordance for the empty-remaining case
  evidence: Review (edge-case + blind) — the prompt filters the current props excluding the just-completed action, which is valid today (choices are still-available actions), but could go stale under concurrent edits; and GTD's "always define the next action" suggests offering to add one when none remain. UX/robustness refinement beyond the AC.

- source_spec: `_bmad-output/implementation-artifacts/spec-4-5-commit-single-next-action-stuck-detection.md`
  summary: Make the page-level StuckIndicator CTA focus the commit/add-action control (via a small client wrapper) instead of only scrolling to `#actions`, and add a polite aria-live status region announcing commit/complete results
  evidence: Review (blind + edge-case) — the server-rendered StuckIndicator can't pass an onClick, so its CTA is an anchor to `#actions` (scrolls, doesn't focus). The next-action prompt now has focus-on-open + Escape (patched), but action-result feedback isn't announced beyond the assertive role=alert band. A11y enhancements beyond the AC's stated floor.

## Deferred from: code review of 5-1 (2026-09-28)

- source_spec: `_bmad-output/implementation-artifacts/spec-5-1-frictionless-inbox-capture.md`
  summary: Give CaptureDrawer a full focus trap (Tab/Shift+Tab cycling) and restore focus to the triggering FAB on close — currently it auto-focuses the field and closes on Escape/backdrop but Tab can leave the dialog
  evidence: Review (blind + edge-case, consensus) — the drawer is role="dialog" aria-modal but has no Tab containment and no focus-restore, so keyboard/AT users can tab to background content. This is the same dialog-focus-trap gap already deferred for the Epic 4 confirm dialogs (4.2/4.3); it belongs to the shared focus-trap modal primitive tracked under epic-H (H-2), which should adopt CaptureDrawer too. Focus-restore-to-trigger is folded into that primitive.

- source_spec: `_bmad-output/implementation-artifacts/spec-5-1-frictionless-inbox-capture.md`
  summary: Distinguish a transient inbox read failure from a genuinely empty inbox — loadInboxItems() try/catch returns [] on any error, so a Supabase/RLS failure renders "Inbox zero."
  evidence: Review (blind + edge-case + verification-gap, consensus) — matches the spec's chosen "degrade to empty rather than crash" behaviour and the identical pattern already deferred across the Epic 4 read surfaces (4.1) and the project detail view (2.3). Tracked for the cross-cutting error-vs-empty hardening under epic-H (H-3); fix once across all read surfaces.

- source_spec: `_bmad-output/implementation-artifacts/spec-5-1-frictionless-inbox-capture.md`
  summary: Extract a shared inbox-capture hook (POST /api/inbox + validation + inline-error handling) consumed by both InboxCaptureForm and CaptureDrawer, so the two capture paths cannot drift
  evidence: Review (blind + verification-gap) — the form and drawer duplicate the same capture flow with intentionally different post-submit behaviour (form refocuses & stays; drawer closes). Not a correctness bug today; a shared hook would keep the fetch/error contract single-sourced. DRY/maintainability refinement; revisit alongside Story 5.2 which adds more inbox mutations.

## Deferred from: code review of 5-2 (2026-09-28)

- source_spec: `_bmad-output/implementation-artifacts/spec-5-2-inbox-processing-clarify.md`
  summary: No executed test harness exercises the DB migration itself (nullable actions.project_id, new enum values, new columns) or RLS/FK behavior against a real Postgres — all route/component tests mock the Supabase client
  evidence: Review (verification-gap) — the entire suite mocks `@/lib/supabase/server`, so migration 0003 and the RLS/WITH-CHECK/FK contracts are verified only by tsc + manual apply. This is the project's standing posture (no DB-integration harness exists anywhere, Epics 1–4 included). A throwaway-Postgres migration/integration test (apply 0001→0003, insert a standalone action, insert each new enum value, attempt a cross-owner link) would close this and the app-layer ownership guards' DB half at once. Tracked as cross-cutting test-infra debt (pairs with epic-H).

- source_spec: `_bmad-output/implementation-artifacts/spec-5-2-inbox-processing-clarify.md`
  summary: Add a dedicated page.test.tsx for app/app/inbox/[id]/page.tsx asserting notFound() for a missing OR already-terminal item and a rendered wizard for an unprocessed item
  evidence: Review (verification-gap) — the "only clarify an unprocessed item" guard lives in the server component's loader and has no executed coverage (the ClarifyWizard component tests mock the page away). The route-level PATCH now also enforces unprocessed (tested), so the invariant is defended at the API; the page-load guard remains untested. Mirror app/app/projects/[id]/page.test.tsx when convenient.

- source_spec: `_bmad-output/implementation-artifacts/spec-5-2-inbox-processing-clarify.md`
  summary: Consider a full goal↔project linking UI (attach existing projects to a goal from the goal side; change a project's goal from project detail) — this story added the goal_id PATCH capability but no dedicated management surface
  evidence: Review (blind-hunter) — sanitizeProjectPatch now accepts goal_id (link/clear) and is route-exposed + tested, satisfying the linking mechanism the amendment required. A discoverable UI (goal detail "attach projects", project detail "change goal") is a usability follow-up beyond this story's clarify flow; revisit alongside Epic 4 goal/project detail polish.
  tracking: Added to approved Story 4.6 (`spec-4-6-project-goal-linking-filtering.md`), ready-for-dev on 2026-10-01; remains unresolved until implementation is complete.
  tracking: Added to approved Story 4.6 (`spec-4-6-project-goal-linking-filtering.md`), ready-for-dev on 2026-10-01; remains unresolved until implementation is complete.

## Deferred from: code review of 5-3 (2026-09-28)

- source_spec: `_bmad-output/implementation-artifacts/spec-5-3-engage-view-committed-actions-next-action-prompting.md`
  summary: The Engage `today` cutoff for future-scheduled exclusion uses the server's UTC date (new Date().toISOString().slice(0,10)) — not the user's local date, so a scheduled action can show/hide one day early or late near the timezone day boundary
  evidence: Review (all three layers, consensus) — the app has no per-user timezone plumbing anywhere, and `scheduled_for` is a bare DATE, so a fully-correct boundary needs user-tz infrastructure (a profile tz or client-side cutoff passed to the model). Low impact (a single day's fuzziness on the defer boundary); tracked for the broader user-timezone work rather than a misleading UTC→server-local swap that would not fix it.

- source_spec: `_bmad-output/implementation-artifacts/spec-5-3-engage-view-committed-actions-next-action-prompting.md`
  summary: Add focus restoration (and eventually a shared focus trap) to the Engage "What's next for [project]?" prompt — it focuses on open but does not restore focus to the triggering Done button on close
  evidence: Review (blind + edge-case) — the prompt is adapted verbatim from ActionList's nextPrompt (Epic 4), which has the same gap; both should adopt the epic-H shared focus-trap modal primitive (H-2). Consistent with the Epic 4 confirm dialogs and the CaptureDrawer (5.1) already tracked under H-2.

- source_spec: `_bmad-output/implementation-artifacts/spec-5-3-engage-view-committed-actions-next-action-prompting.md`
  summary: Collapsible goal groups (<details open>) reset to open after every router.refresh() (post-mutation) — a manually collapsed group snaps back open
  evidence: Review (edge-case) — the AC only requires groups be "collapsible" (satisfied); persisting collapse state across refresh (e.g. a per-goalId open map) is a UX refinement. Low impact; revisit if users report it.

- source_spec: `_bmad-output/implementation-artifacts/spec-5-3-engage-view-committed-actions-next-action-prompting.md`
  summary: A COMMITTED action with a future scheduled_for makes its project show neither a do-now row (excluded by isDoNow) nor a stuck band (isProjectStuck sees it as committed) — the project silently disappears from Engage until the date arrives
  evidence: Review (blind + edge-case) — an unusual combination (clarify creates scheduled actions as `available`, not `committed`), and arguably correct GTD behaviour (a committed action on the calendar is "handled"). Documented as a known corner; revisit only if committed+scheduled becomes a common path.

## Deferred from: code review of 5-4 (2026-09-28)

- source_spec: `_bmad-output/implementation-artifacts/spec-5-4-weekly-review-shell-phase-bar-persistence.md`
  summary: The weekly-review week identity is computed from the server's UTC instant (new Date() → isoWeek/weekBounds), not the user's local week — so which ISO week a review belongs to is server-timezone dependent near the week boundary
  evidence: Review (edge-case + blind, consensus) — same root cause and posture as the Engage `today` deferral (5.3): the app has no per-user timezone plumbing, and week identity is a bare ISO week. A fully-correct user-local week needs tz infrastructure (profile tz or a client-computed week passed to POST). Low impact for single-timezone users; tracked with the broader user-timezone work.

- source_spec: `_bmad-output/implementation-artifacts/spec-5-4-weekly-review-shell-phase-bar-persistence.md`
  summary: Move focus to the active phase panel's heading on phase change (in addition to the polite live-region announcement) once the panels carry real content
  evidence: Review (blind) — the phase name is announced via an aria-live region (AC satisfied), but focus is not moved to the new panel. The panels are placeholders in 5.4; the real Get Clear/Current/Creative content + snapshot fields land in 5.5/5.6, which is where focus-management belongs. Consistent with the shared focus-management debt tracked under epic-H (H-2).

## Deferred from: code review of 5-5 (2026-09-28)

- source_spec: `_bmad-output/implementation-artifacts/spec-5-5-weekly-snapshot-opening-closing-closed-loop.md`
  summary: On a failed weekly-review completion (empty closing field), move focus to the first invalid field in addition to rendering the inline aria-invalid validation
  evidence: Review (blind) — the empty-field completion now reveals inline `aria-required`/`aria-invalid` validation (AC satisfied) but does not move focus to the offending field. A focus-to-first-invalid pass belongs with the shared focus-management debt tracked under epic-H (H-2), alongside the auth/generation error-focus deferrals.

- source_spec: `_bmad-output/implementation-artifacts/spec-5-5-weekly-snapshot-opening-closing-closed-loop.md`
  summary: The closed-loop "Last week you said:" keys off the ISO week exactly 7 days prior — if a user skips a week, no prior snapshot shows even though a more-recent one exists
  evidence: Review (blind) — matches the AC as written ("the previous week's closing snapshot"), so this is a deliberate literal reading, not a defect. Showing the most-recent snapshot instead (when the immediately-prior week was skipped) is a possible future enhancement; revisit if users report the gap.

## Deferred from: code review of 5-6 (2026-09-28)

- source_spec: `_bmad-output/implementation-artifacts/spec-5-6-weekly-review-phases-get-clear-current-creative.md`
  summary: Re-enforce the weekly-review completion gate SERVER-SIDE in POST /api/review/[id]/complete (count unprocessed inbox items + verify no active project is stuck) in addition to the client gate
  evidence: Review (all three layers) — the completion gate is now enforced client-side in ReviewShell.handleComplete (blocks on non-empty inbox / unresolved stuck project, covering items re-injected during Get Creative). The complete route still only validates the closing fields, so a crafted request could bypass the gate. Matches the app's client-gate + server-validate posture; the server re-check is a hardening follow-up (pairs with the epic-H integrity work).

- source_spec: `_bmad-output/implementation-artifacts/spec-5-6-weekly-review-phases-get-clear-current-creative.md`
  summary: reviewedProjectIds is client-session state that can go stale — a project marked reviewed via commit can be re-stuck if its committed action changes elsewhere mid-review, and the gate still exempts it
  evidence: Review (blind + edge-case) — within a single guided review this is a narrow window and the gate errs toward advancing after the user acted (safe). Durable per-project review state would need a schema addition (review_sessions has no such column and sanitizeReviewPatch won't persist one). Revisit if per-project review state becomes a requirement.

- source_spec: `_bmad-output/implementation-artifacts/spec-5-6-weekly-review-phases-get-clear-current-creative.md`
  summary: Add pending/aria-busy affordances to the Get Current / Get Creative in-flight buttons, and reconcile the duplicated en-US formatDate helper (GetCurrentPanel + review page) into a shared util
  evidence: Review (blind) — buttons disable while busy but show no spinner/aria-busy; formatDate is duplicated verbatim. Minor polish; the locale-hardcoding is the same deferred cross-cutting concern as elsewhere (no user-tz/locale infra).

## Deferred from: code review of 2-7 (2026-10-01)

- source_spec: `_bmad-output/implementation-artifacts/spec-2-7-manual-project-creation.md`
  summary: `PATCH /api/projects/[id]` accepts a `goal_id` with no ownership check — a signed-in user can link their own project to another user's goal (FK + RLS only verify the project owner and goal existence)
  evidence: Review (verification-gap) — `sanitizeProjectPatch` passes a uuid `goal_id` straight into `.update(patch)` scoped only by project `id` + `user_id`; the goal's owner is never verified. The new `POST /api/projects` guards this cross-owner vector, so the edit route is now the remaining hole. Pre-existing route outside Story 2.7; pair with the 4.6 goal-linking work.

- source_spec: `_bmad-output/implementation-artifacts/spec-2-7-manual-project-creation.md`
  summary: `purpose` and `successful_outcome` have no length bound in `lib/projects/create.ts` (and the existing `sanitizeProjectPatch`) — unbounded text is accepted and stored
  evidence: Review (blind + edge-case) — `optionalText` only type-checks; the DB columns are unbounded `text`. Every other user string is bounded (name 200, goal_text/action text). The new validator deliberately mirrors the existing project-edit convention, which is also unbounded; a shared length cap should be added across both in one change.

- source_spec: `_bmad-output/implementation-artifacts/spec-2-7-manual-project-creation.md`
  summary: The manual parent-goal picker lists every goal with no order/limit/filter — nondeterministic ordering, includes completed/archived/someday goals, and grows unbounded with the user's history
  evidence: Review (blind + edge-case) — `loadGoalsForPicker` does `.select("id, goal_text")` with no `.order()`, `.limit()`, or status filter. Tolerable at expected scale; revisit with an ordering/status-filtering decision (which the spec leaves open) or alongside Epic 4 goal polish.

- source_spec: `_bmad-output/implementation-artifacts/spec-2-7-manual-project-creation.md`
  summary: Submit buttons set `aria-disabled` true when the field is merely empty while the button is still clickable (clicking surfaces inline validation) — assistive tech is told the control is disabled
  evidence: Review (blind) — the AI submit button already carried this pre-existing `aria-disabled`-on-empty pattern; the new manual button replicates it. The real `disabled` attribute already covers actual disabling; fix both buttons in a shared a11y pass without altering AI behavior.

## Deferred from: code review of 4-6 (2026-10-02)

- source_spec: `_bmad-output/implementation-artifacts/spec-4-6-project-goal-linking-filtering.md`
  summary: The new "Move this project?" confirm dialog in AttachProjectControl has no focus trap (Tab escapes the dialog, initial focus lands on the container, focus is not restored to the trigger on close)
  evidence: Review (blind + edge-case) — the dialog is role="alertdialog" aria-modal="true" with an Escape handler but no Tab/Shift+Tab containment, focus restore, or visible-focus on the overlay (focus:outline-none). Same dialog-focus-trap gap already deferred for the Epic 4 confirm dialogs (4.2/4.3) and CaptureDrawer (5.1); belongs to the shared focus-trap modal primitive tracked under epic-H (H-2), which should adopt this dialog too.

- source_spec: `_bmad-output/implementation-artifacts/spec-4-6-project-goal-linking-filtering.md`
  summary: The new goal-change fetch (ProjectDetailClient) and attach/move fetch (AttachProjectControl) have no AbortController/timeout — a stalled request leaves the control `busy`/disabled with no recovery
  evidence: Review (edge-case) — both fetches rely entirely on the server to bound the request. Same client-abort gap already deferred for Project Mode (2.4) and Step 4 generate (3.6); tracked under epic-H (H-3 provider-resilience). Pre-existing fetch pattern, not introduced by this story.
