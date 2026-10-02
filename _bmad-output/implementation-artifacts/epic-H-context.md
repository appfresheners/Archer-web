# Epic H Context: Cross-cutting Hardening

<!-- Compiled from planning artifacts. Edit freely. Regenerate with compile-epic-context if planning docs change. -->

## Goal

Epic H consolidates the cross-cutting hardening findings promoted from the implementation deferred-work ledger. It is not new feature scope: each story absorbs a cluster of recurring correctness, accessibility, resilience, and interaction defects that surfaced across Epics 1–4 and are cheaper and safer to fix once, at the shared-infrastructure level, than to retrofit into each feature. The epic turns scattered review findings into a tracked, prioritized body of work that raises the whole system's data integrity, accessibility floor, and failure behavior.

## Stories

- Story H-1: Atomic writes & DB integrity hardening
- Story H-2: Shared focus-trap modal & a11y announcements
- Story H-3: Provider resilience & error observability
- Story H-4: App-wide clickable cursor affordance

## Requirements & Constraints

- The app must meet WCAG 2.1 Level AA: full keyboard navigation, ARIA roles and live regions, focus management between steps, 44×44px touch targets, 4.5:1 contrast for body text and 3:1 for large text, and respect for `prefers-reduced-motion`.
- Accessibility is a component-level invariant applied as features are built, not a post-build audit.
- Error resilience: a missing or invalid API key produces a clear, actionable message; a generation timeout surfaces a retry rather than a silent failure; wizard inputs survive a failed generation.
- Data integrity: no user data is lost on reload, crash, or session end (Supabase persistence); every stored item must be present in any export.
- Privacy: no cookies beyond the Supabase Auth session, no analytics or tracking, and outbound network requests are limited to AI generation and Supabase reads/writes.
- Pointer affordance: enabled interactive controls show a pointer cursor and disabled controls show `not-allowed`; the cursor must never be the sole interaction signal, only a supplement to semantic controls and visible hover/focus states.

## Technical Decisions

- Database layer is authoritative for invariants: the single-committed-action rule is enforced by a trigger/function, not the UI; stuck detection has no quiet render path.
- Multi-row writes that must not partially apply (generation saves, goal soft-delete cascade, project regeneration, action reorder) should move into a Postgres function/RPC so they are atomic, rather than sequential client calls with best-effort compensating deletes.
- Cross-owner integrity: a child row's `user_id` must match its parent's owner; per-table RLS (`user_id = auth.uid()`) alone does not prevent linking to another user's parent row.
- Schema conventions to preserve: UUID primary keys, `user_id` on every user-owned table, RLS default-deny on every table, `created_at`/`updated_at` maintained by a shared trigger, soft deletes via a `status` column, and enum types defined at the database level.
- Data-integrity `CHECK` constraints should reject impossible rows (e.g. week-number and date-ordering bounds) and snapshots should be immutable; FK columns on hot lookup paths should be indexed.
- Provider-layer resilience: retry/backoff on transient 429/5xx failures, richer diagnostics when an error body is non-JSON, an external abort signal so a client disconnect cancels the upstream fetch, and diagnostic logging gated behind a level with error bodies scrubbed.
- Confirm/prompt dialogs, the capture drawer, and the next-action prompt should share a single focus-trap modal primitive rather than each hand-rolling focus containment.

## UX & Interaction Patterns

- On error, move focus to the error alert or first invalid field in addition to `role="alert"` announcements; provide skip-to-content and route-change focus in the authenticated shell.
- Modals trap focus while open, close on Escape, and restore focus to their trigger on close.
- Wizard step and readiness changes are announced via polite live regions; step changes should also move focus to the new step's heading or first interactive element.
- Announce commit/complete results via a polite status region; the stuck indicator uses `role="alert"`.
- Read surfaces must distinguish a transient backend error from a genuinely empty/not-found state, instead of collapsing both into an empty state or 404.
- Error states are never color-only: inline validation messages are linked to their inputs via `aria-describedby` and paired with text or an icon.
- Cursor tokens are defined as `interactive-affordance` (enabled `pointer`, disabled `not-allowed`); hover, focus, and selected states must remain visible alongside the cursor change.

## Cross-Story Dependencies

- H-2's shared modal primitive is the dependency for every dialog flagged across the app (delete/regenerate confirmations, capture drawer, next-action prompts, project-move confirmation); those surfaces adopt it rather than implementing focus traps locally.
- H-1's atomicity RPCs and DB constraints touch the same multi-write routes (generate saves, goal delete, regenerate, reorder) and complement the `fn_commit_action` concurrency/INSERT coverage.
- H-3's error-vs-empty distinction spans all read surfaces (goals list, project/inbox detail, Engage), and its error surfaces are the natural consumers of H-2's focus-to-error and announcement patterns.
- H-4 is UI-only and independent of the other stories.
