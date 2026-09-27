# Deferred Work Ledger

## Deferred from: code review of 2-2/2-3 (2026-08-27)

- ModeToggle tabs missing `aria-controls` and `id` attributes — WAI-ARIA tablist pattern recommends associating tabs with panels via id/aria-controls. Not blocking since this design doesn't use formal tabpanels. [archer/components/ModeToggle.tsx]
- ModeToggle tabs don't handle Home/End keys — WAI-ARIA tablist recommends Home/End for first/last tab. Not critical for a 2-tab toggle. [archer/components/ModeToggle.tsx]

- source_spec: `_bmad-output/implementation-artifacts/spec-3-1-copy-markdown-to-clipboard.md`
  summary: Add focus trap to fallback clipboard modal (Tab cycles between textarea and Close button)
  evidence: WCAG aria-modal contract requires focus to remain within the dialog; currently focus can escape to background content

- source_spec: `_bmad-output/implementation-artifacts/spec-3-1-copy-markdown-to-clipboard.md`
  summary: Add aria-live announcement for clipboard failure case (fallback modal shown)
  evidence: Screen reader users get no audible notification that the copy failed; the modal's role="dialog" provides some signal but an explicit announcement would be more accessible

- source_spec: `_bmad-output/implementation-artifacts/spec-3-2-download-as-markdown-file.md`
  summary: Add focus trap to fallback clipboard modal so keyboard users cannot Tab behind the overlay
  evidence: Backdrop div lacks tabIndex and focus-trap mechanism; Tab navigates to obscured page content violating WCAG 2.4.3

- source_spec: `_bmad-output/implementation-artifacts/spec-3-2-download-as-markdown-file.md`
  summary: Return focus to the trigger button when fallback modal closes
  evidence: WAI-ARIA dialog pattern requires focus return to previously-focused element on dismiss

- source_spec: `_bmad-output/implementation-artifacts/spec-3-2-download-as-markdown-file.md`
  summary: Add backdrop tabIndex to modal so Escape key handler fires on keyboard interaction
  evidence: Backdrop onKeyDown never fires because the div has no tabIndex attribute

- source_spec: `_bmad-output/implementation-artifacts/spec-3-2-download-as-markdown-file.md`
  summary: Add loading/disabled state on Copy button while async clipboard write is pending
  evidence: Rapid clicks can queue multiple clipboard writes and flash confirmation text erratically

- source_spec: `_bmad-output/implementation-artifacts/spec-3-5-notion-optimized-markdown-quality.md`
  summary: escapeMarkdown does not neutralize user input containing `<!--` sequences which could produce HTML comment artifacts in rendered markdown
  evidence: Pre-existing behavior from Epic 2; escapeMarkdown escapes common markdown special chars but HTML comment delimiters are not in its character class

- source_spec: `_bmad-output/implementation-artifacts/spec-3-5-notion-optimized-markdown-quality.md`
  summary: escapeMarkdown does not handle literal newlines or carriage returns in user input which could break table structure
  evidence: Pre-existing behavior from Epic 2; input field is single-line so risk is minimal but the function itself has no newline handling

- source_spec: none
  summary: Extract escapeMarkdown into shared utility (duplicated in goal-template.ts and project-template.ts)
  evidence: Blind-hunter review identified code duplication; both template files define identical escapeMarkdown functions
  status: done

- source_spec: none
  summary: Add input length validation to /api/generate route to prevent prompt injection and cost inflation
  evidence: Blind-hunter review; no maxLength check on user input before concatenating into LLM prompt
  status: done

- source_spec: none
  summary: Add AbortController timeout to outbound fetch calls in /api/generate route
  evidence: Blind-hunter review; if a provider hangs the serverless function will exhaust its execution budget
  status: done

- source_spec: none
  summary: Move Gemini API key from URL query parameter to x-goog-api-key header
  evidence: Blind-hunter review; key in URL leaks to access logs and intermediate proxies
  status: done

- source_spec: none
  summary: Verify default Gemini model name (gemini-3.6-flash) is a valid model identifier
  evidence: Blind-hunter review; does not match known published Gemini model names — changed to gemini-2.0-flash
  status: done

- source_spec: `_bmad-output/implementation-artifacts/spec-4-1-local-vault-storage-layer.md`
  summary: Validate individual vault entry shape (not just the container's entries array) in isVaultSchema/readVault
  evidence: Review found isVaultSchema only checks entries is an array; malformed entries (e.g. [null], [{}]) pass and are cast to VaultEntry unsafely, flowing to listEntries/readEntry consumers (relevant once 4.3 renders them)

- source_spec: `_bmad-output/implementation-artifacts/spec-4-1-local-vault-storage-layer.md`
  summary: Gate on schemaVersion and add a migration path before treating stored data as current version
  evidence: isVaultSchema ignores schemaVersion; a future/foreign version is silently read and mutated as v1. Deliberately deferred in 4.1 but needed before the schema evolves (4.2 encryption changes the stored shape)

- source_spec: `_bmad-output/implementation-artifacts/spec-4-1-local-vault-storage-layer.md`
  summary: Multi-tab / concurrent write safety for the vault (read-modify-write can clobber across tabs)
  evidence: saveEntry/deleteEntry do readVault -> mutate -> writeVault with no storage-event listener or locking; two tabs saving concurrently lose entries (last write wins)

- source_spec: `_bmad-output/implementation-artifacts/spec-4-1-local-vault-storage-layer.md`
  summary: Add a size/entry-count bound or pruning strategy to prevent unbounded vault growth toward QuotaExceededError
  evidence: Every saveEntry appends with no cap or eviction; quota failure is only reported, never prevented. Also no length guard on inputText/outputMarkdown before persisting

- source_spec: `_bmad-output/implementation-artifacts/spec-4-1-local-vault-storage-layer.md`
  summary: Preserve/quarantine corrupt-but-parseable vault data instead of silently overwriting it on the next save
  evidence: When stored JSON parses but fails isVaultSchema, readVault returns empty; a subsequent save overwrites the recoverable raw bytes with an empty container, with no backup or user warning

- source_spec: `_bmad-output/implementation-artifacts/spec-1-1-standalone-nextjs-runtime-design-token-foundation.md`
  summary: Add `--font-weight-*` tokens (heading 700, subheading 600, body 400, caption 500) to the `@theme` block
  evidence: Review (blind-hunter) noted DESIGN.md specifies per-role font weights but Story 1.1's accepted scope only required the type-size scale; weight tokens would let later components consume weights from the token system instead of hardcoding

- source_spec: `_bmad-output/implementation-artifacts/spec-1-1-standalone-nextjs-runtime-design-token-foundation.md`
  summary: Add line-height / `--leading-*` tokens (hero 1.2, section 1.3, body 1.6, mono 1.7) to complete the DESIGN.md type scale
  evidence: Review (blind-hunter) noted DESIGN.md defines a line-height per type role but Story 1.1's accepted scope only required the size scale; line-heights are currently hardcoded in `.output-prose`

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
