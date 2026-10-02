# Epic 5 Context: The GTD Loop — Inbox, Engage & Reviews

<!-- Compiled from planning artifacts. Edit freely. Regenerate with compile-epic-context if planning docs change. -->

## Goal

This epic delivers the full GTD reflect-and-engage loop for a signed-in user. Raw thoughts are captured frictionlessly into an inbox from anywhere, then clarified into the right place so the inbox reaches zero. An Engage view shows only committed next actions across active goals, and prompts for the next action the moment one is completed so no project silently goes stuck. A guided, non-timed weekly review walks the user through three phases — Get Clear, Get Current, Get Creative — bookended by an opening and closing weekly snapshot, with all progress persisted so the review can be resumed after stepping away. A separate, prompted monthly goal check keeps each goal relevant. Together these surfaces close the loop between capturing work, doing it, and honestly reviewing it week to week.

## Stories

- Story 5.1: Frictionless Inbox Capture
- Story 5.2: Inbox Processing (Clarify)
- Story 5.3: Engage View — Committed Actions & Next-Action Prompting
- Story 5.4: Weekly Review Shell, Phase Bar & Persistence
- Story 5.5: Weekly Snapshot — Opening & Closing (Closed Loop)
- Story 5.6: Weekly Review Phases — Get Clear, Get Current, Get Creative
- Story 5.7: Monthly Goal Check (Prompted & Manual)

## Requirements & Constraints

Inbox capture accepts raw text with no required classification (no project, tag, or AI processing at capture time) and must be reachable from any view without navigating away, via a keyboard shortcut and floating button. Processing (clarify) asks "Is this actionable?"; actionable items branch to "do it now" (< 2 min) or assign/create a project, non-actionable items go to trash, someday/maybe, or reference. Items unprocessed for 7+ days must be flagged.

The Engage view shows only committed next actions across active, non-paused goals — never the full action list, a Kanban board, or a project tree. Completing an action must immediately prompt for the next committed action from that project. Stuck projects (active, zero committed action) must be surfaced visibly, never hidden, with a direct path to commit or pause. Optional filtering by context tag is supported when actions are tagged.

The weekly review follows the three-phase GTD structure in strict order, is guided (each phase surfaces its own data rather than a blank page), and has no time limit. Completion is gated: it cannot finish until every inbox item is processed and every active project has either a committed action or a changed status. Review progress must survive leaving and returning mid-review, and the timestamp of the last completed review must be visible.

The monthly goal check is a distinct flow (not part of the weekly review). It asks whether each goal is still relevant, surfaces linked/active projects and stuck counts, flags missing projects for priority gaps, and lets the user change goal status directly.

## Technical Decisions

Review state is persisted to Supabase (adopted decision). A `review_sessions` row is created at review start and updated on every phase transition, capturing phase position, snapshot fields, and inbox-processing position so a session survives browser close. The row is marked complete only when the closing snapshot is saved; on completion the flow writes an immutable `weekly_snapshots` row and navigates to `/app/engage`.

Relevant data model (all tables have `user_id` FK to `auth.users`, RLS restricting rows to their owner, and `updated_at` triggers):

- `inbox_items`: `raw_text` (1–2000 chars), `processing_status` (default `unprocessed`), `resolved_project_id` (set on assignment, FK to projects), `captured_at`, `processed_at`. Partial index on unprocessed items by capture time.
- `review_sessions`: ISO week identity (`week_number`, `week_year`, `week_start_date` = Monday, `week_end_date` = Sunday), `current_phase` (default `snapshot_open`), `opening_retrospective`, `closing_intention`, `closing_blocker`, `started_at`, `completed_at`. Unique per user per week (one in-progress session at a time).
- `weekly_snapshots`: immutable closing record, FK to `review_sessions`, week identity, required `intention` and `blocker`, plus the session's `opening_retrospective`. The next week's opening snapshot reads the prior week's row.

Review phase flow: Snapshot Open (reads prior weekly snapshot) → Get Clear (inbox to zero) → Get Current (all active projects reviewed) → Get Creative (someday/maybe + goal alignment) → Snapshot Close → UPDATE `review_sessions` + INSERT `weekly_snapshots` → navigate to Engage. Auth gates all `/app/*` routes. The monthly check lives at `/app/review/monthly/[goalId]` and updates the goal's `last_checked_at`; it prompts in-app (no push) once a goal is 30+ days unchecked, and can also be triggered manually from goal detail.

## UX & Interaction Patterns

Inbox: single auto-focused text input at top (Enter or "Capture" saves), item rows show raw text + timestamp + Process/Delete. A persistent floating capture button (`C` shortcut) opens a capture drawer from any view without navigation. Processing is an inline flow. Overdue items carry an amber "Unprocessed for 7+ days" flag. Empty state: "Inbox zero."

Engage: committed actions grouped by goal in collapsible groups; each row shows action text, optional context-tag chips (@energy / @location / @tool), parent project name, and a Done button. Completing prompts "What's next for [project]?" with an inline list of remaining actions to commit, or "mark project complete?" when none remain. Stuck projects appear at the bottom of their goal group with an amber band and a "Commit one →" CTA. Empty state is honest and unadorned: "No committed actions. Open a project and commit one." — no confetti or celebration.

Weekly review phase bar: a horizontal indicator with five beats — Snapshot (open) → Get Clear → Get Current → Get Creative → Snapshot (close). The active beat fills primary (blue), completed beats fill emerald, upcoming are gray; the two snapshot beats are visually distinct (narrower) as bookends. Phases cannot be skipped.

Snapshots: the opening header shows auto-calculated "Week N · [Mon dd] – [Sun dd]", displays the prior week's closing snapshot read-only under "Last week you said:", and requires a non-empty answer to "What actually moved last week? What didn't?" before "Start review →". The closing snapshot requires two `aria-required` fields — "What matters most this coming week?" and "What's the main thing that could derail it?" — each blocking completion with inline validation when empty. Copy stays honest and brief ("This isn't a report — it's a reality check").

Amber is reserved for warnings (stuck projects, inbox backlog) and never for primary actions. Modals are used only for binary decisions or destructive confirmations; toasts float above modal layer. Phase transitions announce the new phase name to screen readers, and focus/keyboard access follow the design system's focus-ring conventions. Goal/project status options relevant to the monthly check and Get Current: Active, Paused, Someday, Not now, Completed, Archived.

## Cross-Story Dependencies

- Story 5.4 (review shell + `review_sessions` persistence) underpins Stories 5.5 and 5.6 — snapshots and phases run inside the persisted shell and its phase bar.
- Story 5.5 closes the loop with 5.6: the closing snapshot is the completion gate for Get Creative, and its fields become the next review's "Last week you said:" opening display.
- Story 5.6 (Get Clear) depends on inbox capture/processing from Stories 5.1 and 5.2 — the phase drives the inbox to zero using the same processing flow.
- Story 5.3 (Engage) depends on committed next actions and stuck-project detection defined in the goals/projects/actions epic; the review's Get Current phase and Engage share the stuck-project and next-action-commit behavior.
- All stories depend on the Supabase auth/schema foundation (goals, projects, actions, inbox_items, review_sessions, weekly_snapshots) being in place.
