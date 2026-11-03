# Epic 10 Context: Daily Shutdown Routine

<!-- Compiled from planning artifacts. Edit freely. Regenerate with compile-epic-context if planning docs change. -->

## Goal

Implement Cal Newport's daily shutdown routine as a 5-10 minute end-of-day closure ritual that closes open loops, confirms today's progress, sets tomorrow's intention, and enables genuine mental disengagement from work. Research by Masicampo & Baumeister shows that making a specific plan for unfinished work (not completing it) stops attention intrusion. The daily shutdown complements (not replaces) the weekly review — it provides daily closure while the weekly review provides comprehensive reflection.

## Stories

- Story 10.1: Daily Shutdown Flow (Complete Feature)
- Story 10.2: Engage Indicator + Data Export

## Requirements & Constraints

### Daily Shutdown Flow

**FR115:** The daily shutdown SHALL be accessed via navigating to `/app/shutdown` route, triggered by keyboard shortcut (Cmd/Ctrl+Shift+D) or header button.

**FR116:** The shutdown flow SHALL consist of three sequential screens displayed as a vertical flow on a single page:
1. **Inbox Check** — show unprocessed inbox count; offer quick link to Inbox if > 0; "Continue" button to advance
2. **Today's Progress** — show actions marked done today; empty state if none; "Continue" button to advance
3. **Tomorrow's Intention** — free-text input "What matters most tomorrow?" (optional, 500 char limit); "Complete shutdown" button to advance

**FR117:** After intention, a **Termination Phrase Screen** SHALL display large centered text: "Say it aloud:" followed by "Shutdown complete" in display font; "Done" button to save and navigate.

**FR118:** Abandoning the shutdown flow (via exit link or back navigation) SHALL NOT save a completion; no intermediate state is preserved.

**FR119:** On "Done", the app SHALL save a `daily_shutdowns` row with: `completed_at` timestamp and tomorrow's `intention` text (if provided), then navigate to `/app/engage`.

**FR120:** The daily shutdown SHALL enforce one completion per calendar day per user. Navigating to `/app/shutdown` when already completed today SHALL show: "Shutdown complete for today" with the saved intention displayed and the completion time. A "Return to Engage" link is provided.

**FR121:** The most recent daily shutdown completion timestamp SHALL be displayed in the Engage view header as a subtle indicator: "Last shutdown: 3 hours ago" or "Last shutdown: yesterday 6:42 PM".

**FR122:** The shutdown page SHALL include a header with an "Exit" or back link that returns to `/app/engage` without saving (no intermediate confirmation — abandoning is acceptable and low-friction).

**FR123:** Daily shutdown completion data SHALL be persisted to Supabase in the `daily_shutdowns` table, scoped by RLS to the signed-in user.

**FR124:** The keyboard shortcut (Cmd/Ctrl+Shift+D) SHALL navigate to `/app/shutdown` from any authenticated view and SHALL be registered globally for the authenticated shell.

**FR125:** Daily shutdown history (completion timestamps and intentions) SHALL be included in the user's data export alongside goals, projects, actions, inbox items, and review history.

### Engage Indicator

The most recent daily shutdown completion timestamp SHALL be displayed in the Engage view header as a subtle indicator with natural time-since formatting (e.g., "Last shutdown: 3 hours ago" or "Last shutdown: yesterday 6:42 PM"). The indicator SHALL be hidden if no shutdown history exists.

### Data Export

Daily shutdown history SHALL be included in both JSON and Markdown export formats:
- JSON export: include `completed_at` and `intention` fields
- Markdown export: append "Daily Shutdowns" section with chronological list (newest first)
- All exports respect RLS (only user's own shutdowns)

## Technical Decisions

### Data Model

**Table: `daily_shutdowns`**
- Fields: `id` (uuid), `user_id` (uuid, FK to auth.users), `completed_at` (timestamptz), `intention` (text, optional), `created_at` (timestamptz), `updated_at` (timestamptz)
- Unique constraint: `(user_id, date(completed_at))` — enforces one completion per calendar day per user
- RLS policy: `users manage own daily shutdowns` — users can only access their own shutdown records
- Index: `(user_id, completed_at desc)` — optimizes "most recent shutdown" query

### Routes & Navigation

- `/app/shutdown` — Daily shutdown routine page (authenticated route)
- Global keyboard shortcut: Cmd/Ctrl+Shift+D navigates to shutdown from any authenticated view
- Header button present on all authenticated pages for manual access

### Queries

**Inbox count:** `SELECT COUNT(*) FROM inbox_items WHERE user_id = auth.uid() AND processing_status = 'unprocessed'`

**Today's completed actions:** `SELECT a.text, p.name FROM actions a JOIN projects p ON a.project_id = p.id WHERE a.user_id = auth.uid() AND a.status = 'done' AND a.updated_at::date = current_date`

**Today's completion check:** `SELECT * FROM daily_shutdowns WHERE user_id = auth.uid() AND date(completed_at) = current_date LIMIT 1`

**Most recent shutdown:** `SELECT completed_at, intention FROM daily_shutdowns WHERE user_id = auth.uid() ORDER BY completed_at DESC LIMIT 1`

All queries are automatically RLS-scoped via `user_id = auth.uid()` policies.

## UX & Interaction Patterns

### Shutdown Flow Pattern

The shutdown uses a **vertical single-page flow** (not a wizard with steps):
- All three screens stack vertically on one page
- Progress advances by scrolling to next section after button click
- No step navigation or back buttons between sections
- Exit link in page header for abandoning the flow

### Already-Completed State

When user navigates to `/app/shutdown` after already completing today:
- Show full-page message: "Shutdown complete for today"
- Display saved intention (if provided) and completion timestamp
- Single "Return to Engage" link
- No way to re-complete or edit today's shutdown

### Termination Phrase

Large centered display:
```
Say it aloud:

"Shutdown complete"
```
This creates a ritual consistency and psychological closure moment. The phrase is fixed (not customizable).

### Voice & Tone

- Inbox prompt: Matter-of-fact ("Unprocessed: 3 items")
- Progress: Factual, affirming ("Done today: 5 actions")
- Intention: Calm, forward-looking ("What matters most tomorrow?")
- Phrase cue: Ritual, consistent ("Say it aloud: 'Shutdown complete.'")
- Complete: Earned completion ("Shutdown complete. Tomorrow's clear.")
- Already done: Neutral, informative ("Shutdown complete for today. Last: 6:42 PM")

## Cross-Story Dependencies

### Prerequisites (Must Be Complete Before Epic 10)

- **Epic 5 (Weekly Review)** — Daily shutdown references similar persistence patterns (`daily_shutdowns` table structure mirrors `review_sessions` and `weekly_snapshots`)
- **Epic 4 (Action Management)** — Shutdown displays today's completed actions; requires `actions.status` and `actions.updated_at`
- **Epic 5.1 (Inbox Capture)** — Shutdown shows unprocessed inbox count; requires `inbox_items.processing_status`

### Story Dependencies Within Epic 10

Story 10.2 depends on Story 10.1:
- 10.2 queries the `daily_shutdowns` table created in 10.1
- 10.2 extends data export to include shutdown history
