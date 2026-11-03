---
title: "Sprint Change Proposal: Daily Shutdown Routine"
created: 2026-11-03
status: approved
project: GTDGoalandProjectCreator (Archer)
change_scope: Minor
---

# Sprint Change Proposal: Daily Shutdown Routine

## 1. Issue Summary

**Trigger:** User-initiated strategic addition based on Cal Newport's research

**Problem Statement:**  
Archer currently enforces GTD discipline through a weekly review cycle, but lacks a daily closure ritual. Cal Newport's research shows that daily shutdown routines (5-10 minutes) provide immediate psychological benefits by closing open loops every evening, preventing work-related stress from bleeding into personal time. The weekly review alone leaves 6 days between formal "closure" moments, which doesn't align with the daily attention residue research by Masicampo and Baumeister.

**Research Foundation:**  
Masicampo & Baumeister's finding: **making a specific plan for unfinished goals (not finishing them) stops attention intrusion**. Newport's shutdown ritual operationalizes this finding through a consistent daily practice that builds trust in the system, enabling genuine mental disengagement.

**Discovery Context:**  
User researched Cal Newport's shutdown routine and identified the gap between Archer's weekly review cadence and the daily closure cadence that Newport recommends for sustained productivity and mental well-being.

---

## 2. Impact Analysis

### Epic Impact

**Current Epic Status:**

- Epics 1-4: Done/Review
- Epic 5 (Inbox, Engage, Weekly Review): In-progress (5.1-5.7 all in review)
- Epic 7-8: In-progress
- Epic H (Hardening): In-progress
- Epic 9 (Analytics): Backlog
- Epic 6 (Data Export/Vault): Backlog

**Impact Assessment:**

- **No existing epics are blocked or invalidated** by this addition
- Epic 5 stories (5.1-5.7) remain valid as-is
- Weekly Review and Daily Shutdown serve different purposes (comprehensive vs. daily closure)

**New Epic Required:** **Epic 10 — Daily Shutdown Routine**

**Proposed Sequencing:**  
Epics 1-5 → **Epic 10** → Epic 7-8 → Epic 9 → Epic 6

**Rationale for Placement:**

- **After Epic 5:** Depends on review persistence patterns (`review_sessions` table as reference), inbox capture (5.1), and action management (4.5)
- **Before Epic 6:** So shutdown history is included in data exports from day one
- **Can run parallel with Epic 9:** Analytics can later add shutdown metrics if desired (not required for v1)

### Story Impact

**No modifications needed to existing stories.** All current stories (Epics 1-8, H) remain as-is.

**New stories to add:** 7 stories in Epic 10 (10.1 through 10.7)

### Artifact Conflicts

#### PRD Modifications

**1. New FR-Group: Daily Shutdown Routine (FR115-FR125)**

- Location: After FR-Group: Monthly Goal Check
- Scope: 11 new functional requirements covering flow structure, navigation, persistence, one-per-day enforcement, Engage indicator, keyboard shortcut, and data export

**2. FR65 Update (Engage View)**

- Add: Display most recent daily shutdown completion timestamp as time-since indicator

**3. FR80 Update (Data Export)**

- Add: "daily shutdown history" to list of exported data

#### Architecture Modifications

**1. New Table: `daily_shutdowns`**

- Schema section, after `weekly_snapshots`
- Fields: `id`, `user_id`, `completed_at`, `intention` (optional), `created_at`, `updated_at`
- Unique constraint: one shutdown per user per calendar day
- RLS policy: users manage own shutdowns
- Index: `(user_id, completed_at desc)`

**2. Schema Design Principles — No Changes**

- Follows existing patterns (uuid PKs, RLS, timestamps, soft deletes where applicable)

#### UI/UX Modifications

**EXPERIENCE.md Updates:**

1. **Surfaces Table** — Add row:
   - Daily Shutdown | Yes | Daily closure ritual (5-10 min) | Keyboard shortcut or header button

2. **Site Map** — Add route:
   - `/app/shutdown` ← Daily shutdown routine

3. **Content Model** — Add entry:
   - Daily Shutdown session: completion timestamp · tomorrow's intention (free text)

4. **Voice and Tone** — Add 6 rows for shutdown microcopy (inbox prompt, progress, intention, phrase cue, complete, already done)

**No changes needed to:**

- DESIGN.md (visual tokens)
- Component patterns (uses existing patterns)
- Responsive breakpoints (works across all devices)

---

## 3. Recommended Approach

**Selected Path:** **Option 1 — Direct Adjustment**

### Implementation Plan

**Add Epic 10: Daily Shutdown Routine**

**Dependencies:**

- Epic 5 must be complete (weekly review persistence patterns)
- Epic 4 must be complete (action management and commit)
- Epic 5.1 must be complete (inbox capture)

**2 Stories:**

1. **Story 10.1:** Daily Shutdown Flow (Complete Feature)
   - Create `/app/shutdown` route with keyboard shortcut (Cmd/Ctrl+Shift+D) and header button
   - Already-completed-today check (show saved intention + timestamp, return to Engage link)
   - Three-screen vertical flow:
     1. **Inbox Check** — display unprocessed count + optional link to process
     2. **Today's Progress** — display actions marked done today with project names
     3. **Tomorrow's Intention** — optional free-text input
   - **Termination phrase screen** — "Say it aloud: 'Shutdown complete.'" with Done button
   - Save to `daily_shutdowns` table and navigate to Engage on completion
   - Create `daily_shutdowns` table with RLS + migration
   - Exit link returns to Engage without saving

2. **Story 10.2:** Engage Indicator + Data Export
   - Display last shutdown timestamp in Engage view header ("Last shutdown: X ago")
   - Include shutdown history in data export (JSON + Markdown)

### Effort Estimate

**Medium** — New epic with 7 stories, estimated 1-2 weeks of implementation

**Breakdown:**

- Route + navigation: 1 day
- Three flow screens: 2 days
- Termination phrase + save: 1 day
- Engage indicator: 1 day
- Data export: 1 day
- Testing + polish: 2-3 days

### Risk Assessment

**Low Risk**

**Justification:**

- Pure addition — no existing code changes required
- Uses established patterns (Supabase persistence, RLS, authenticated routes)
- No dependencies on external services
- No performance concerns (simple queries, single row per day)
- Routed page approach (not modal) simplifies implementation
- No AI generation or complex state management

### Timeline Impact

**+1 Epic** of work, but does not block any in-progress epics.

**Current trajectory continues:**

- Epics 2-5, 7-8, H complete their current stories
- Epic 10 begins after Epic 5 is done
- Epic 9 and Epic 6 remain scheduled after Epic 10

---

## 4. Detailed Change Proposals

### PRD Changes

#### Change 1: Add FR-Group: Daily Shutdown Routine

**Location:** After FR-Group: Monthly Goal Check (around line 390)

**Content to INSERT:**

```markdown
### FR-Group: Daily Shutdown Routine [NOT YET BUILT]

> The daily shutdown routine is Cal Newport's daily closure ritual adapted for Archer's GTD system. It provides a lightweight 5-10 minute end-of-day review that closes open loops and enables genuine mental disengagement from work. Unlike the comprehensive weekly review, the daily shutdown focuses on: quick inbox triage, confirming today's progress, and setting tomorrow's committed actions. Research by Masicampo & Baumeister shows that making a specific plan for unfinished work (not finishing it) stops attention intrusion — the daily shutdown operationalizes this finding.

**FR115:** The daily shutdown SHALL be accessed via navigating to `/app/shutdown` route, triggered by keyboard shortcut (Cmd/Ctrl+Shift+D) or header button.

**FR116:** The shutdown flow SHALL consist of three sequential screens displayed as a vertical flow on a single page:

1. **Inbox Check** — show unprocessed inbox count; offer quick link to Inbox if > 0; "Continue" button to advance
2. **Today's Progress** — show actions marked done today with their project names; "Continue" button to advance
3. **Tomorrow's Intention** — free-text field asking "What matters most tomorrow?"; "Complete shutdown" button

**FR117:** The flow SHALL target 5-10 minutes completion time. No section is mandatory — the user can click "Continue" or "Complete shutdown" without entering data or processing inbox.

**FR118:** After clicking "Complete shutdown", the app SHALL display the termination phrase screen: Large centered text "Say it aloud:" followed by the phrase "Shutdown complete" in display font, with a "Done" button below.

**FR119:** On "Done", the app SHALL save a `daily_shutdowns` row with: `completed_at` timestamp and tomorrow's `intention` text (if provided), then navigate to `/app/engage`.

**FR120:** The daily shutdown SHALL enforce one completion per calendar day per user. Navigating to `/app/shutdown` when already completed today SHALL show: "Shutdown complete for today" with the saved intention displayed and the completion time. A "Return to Engage" link is provided.

**FR121:** The most recent daily shutdown completion timestamp SHALL be displayed in the Engage view header as a subtle indicator: "Last shutdown: 3 hours ago" or "Last shutdown: yesterday 6:42 PM".

**FR122:** The shutdown page SHALL include a header with an "Exit" or back link that returns to `/app/engage` without saving (no intermediate confirmation — abandoning is acceptable and low-friction).

**FR123:** Daily shutdown completion data SHALL be persisted to Supabase in the `daily_shutdowns` table, scoped by RLS to the signed-in user.

**FR124:** The keyboard shortcut (Cmd/Ctrl+Shift+D) SHALL navigate to `/app/shutdown` from any authenticated view and SHALL be registered globally for the authenticated shell.

**FR125:** Daily shutdown history (completion timestamps and intentions) SHALL be included in the user's data export alongside goals, projects, actions, inbox items, and review history.
```

#### Change 2: Update FR65

**Location:** FR-Group: Engage View (Daily Actions)

**OLD:**

```markdown
**FR65:** The Engage view SHALL show only the committed next actions across all active, non-paused goals and projects — not the full action list, not a Kanban board, not a project tree. It SHALL also display the latest completed weekly snapshot's intention and saved date in a read-only Weekly commitment until superseded. The blocker SHALL NOT be displayed; missing data and read failure SHALL be distinct, and snapshot failure SHALL NOT block action use.
```

**NEW:**

```markdown
**FR65:** The Engage view SHALL show only the committed next actions across all active, non-paused goals and projects — not the full action list, not a Kanban board, not a project tree. It SHALL also display the latest completed weekly snapshot's intention and saved date in a read-only Weekly commitment until superseded. The blocker SHALL NOT be displayed; missing data and read failure SHALL be distinct, and snapshot failure SHALL NOT block action use. The Engage view SHALL also display the most recent daily shutdown completion timestamp as a subtle time-since indicator (e.g., "Last shutdown: 3 hours ago" or "Last shutdown: yesterday 6:42 PM").
```

#### Change 3: Update FR80

**Location:** FR-Group: Data Persistence

**OLD:**

```markdown
**FR80:** The user SHALL be able to export all their data on demand in a portable format (JSON and/or Markdown). Export SHALL include Focus profiles, Life Areas, goals, projects, actions, inbox items, and review history.
```

**NEW:**

```markdown
**FR80:** The user SHALL be able to export all their data on demand in a portable format (JSON and/or Markdown). Export SHALL include Focus profiles, Life Areas, goals, projects, actions, inbox items, review history, and daily shutdown history.
```

---

### Architecture Changes

#### Change 4: Add `daily_shutdowns` Table

**Location:** ARCHITECTURE-SPINE.md, Schema section (after `weekly_snapshots`)

**Content to INSERT:**

````markdown
### `daily_shutdowns`

```sql
create table daily_shutdowns (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,

  -- Core data
  completed_at    timestamptz not null default now(),
  intention       text,  -- Tomorrow's priority/intention (optional)

  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  -- One shutdown per user per calendar day
  constraint daily_shutdowns_user_date_unique
    unique (user_id, date(completed_at))
);

-- RLS
alter table daily_shutdowns enable row level security;

create policy "users manage own daily shutdowns"
  on daily_shutdowns for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Index
create index daily_shutdowns_user_completed_idx
  on daily_shutdowns (user_id, completed_at desc);

-- Trigger
create trigger set_daily_shutdowns_updated_at
  before update on daily_shutdowns
  for each row
  execute function fn_set_updated_at();
```
````

````

---

### UX Changes (EXPERIENCE.md)

#### Change 5: Add to Surfaces Table

**Location:** Information Architecture → Surfaces table

**Content to INSERT:**

```markdown
| **Daily Shutdown**                 | Yes           | Daily closure ritual (5-10 min): inbox check, today's progress, tomorrow's intention                          | Keyboard shortcut (Cmd/Ctrl+Shift+D) or header button                         |
````

#### Change 6: Add to Site Map

**Location:** Information Architecture → Site Map (under `/app` routes, after `/app/review`)

**Content to INSERT:**

```markdown
├── /app/shutdown ← Daily shutdown routine
```

#### Change 7: Add to Content Model

**Location:** Information Architecture → Content Model (after "Weekly Review session")

**Content to INSERT:**

```markdown
**Daily Shutdown session:** completion timestamp · tomorrow's intention (free text)
```

#### Change 8: Add to Voice and Tone Table

**Location:** Voice and Tone section

**Content to INSERT:**

```markdown
| Daily shutdown — inbox prompt | Matter-of-fact | "Unprocessed: 3 items" |
| Daily shutdown — progress | Factual, affirming | "Done today: 5 actions" |
| Daily shutdown — intention | Calm, forward-looking | "What matters most tomorrow?" |
| Daily shutdown — phrase cue | Ritual, consistent | "Say it aloud: 'Shutdown complete.'" |
| Daily shutdown — complete | Earned completion | "Shutdown complete. Tomorrow's clear." |
| Daily shutdown — already done | Neutral, informative | "Shutdown complete for today. Last: 6:42 PM" |
```

---

### Epic and Story Changes

#### Change 9: Add Epic 10 to Epics Document

**Location:** epics.md, after Epic 9, before Epic 6

**Content to INSERT:**

```markdown
---

## Epic 10: Daily Shutdown Routine

**Goal:** Implement Cal Newport's daily shutdown routine as a 5-10 minute end-of-day closure ritual that closes open loops, confirms today's progress, sets tomorrow's intention, and enables genuine mental disengagement from work.

**Context:** Research by Masicampo & Baumeister shows that making a specific plan for unfinished work (not completing it) stops attention intrusion. Newport's shutdown ritual operationalizes this finding with a consistent daily practice. The daily shutdown complements (not replaces) the weekly review — it provides daily closure while the weekly review provides comprehensive reflection.

**Dependencies:**
- Epic 5 (Weekly Review) must be complete — daily shutdown references similar persistence patterns
- Epic 4 (Action Management) must be complete — shutdown displays today's completed actions
- Epic 5.1 (Inbox Capture) must be complete — shutdown shows unprocessed inbox count

**Success Criteria:**
- [ ] User can access `/app/shutdown` via keyboard shortcut (Cmd/Ctrl+Shift+D) or header button
- [ ] Shutdown flow guides through: inbox check → today's progress → tomorrow's intention → termination phrase
- [ ] One completion per day enforced (attempting second shows "already done")
- [ ] Most recent completion timestamp visible in Engage view
- [ ] Shutdown completion saves to Supabase with RLS
- [ ] Shutdown history included in data export

### Stories

**Story 10.1: Daily Shutdown Flow (Complete Feature)**

Implement the complete daily shutdown routine from route to save.

**Implementation:**
- Create `/app/shutdown` route with authenticated layout
- Register global keyboard shortcut (Cmd/Ctrl+Shift+D) that navigates to shutdown
- Add header button that navigates to shutdown
- On route load: check if user already completed shutdown today
  - If yes: show "Shutdown complete for today" with saved intention and timestamp, plus "Return to Engage" link
  - If no: show the shutdown flow
- Shutdown flow (three screens in vertical layout):
  1. **Inbox Check** — Display unprocessed inbox count (`inbox_items` where `processing_status = 'unprocessed'`); if count > 0, show optional "Process inbox" link; "Continue" button advances
  2. **Today's Progress** — Display actions marked done today (`actions` where `status = 'done'` and `updated_at::date = current_date`); show action text + parent project name; empty state if none; "Continue" button advances
  3. **Tomorrow's Intention** — Free-text input "What matters most tomorrow?" (optional, 500 char limit); "Complete shutdown" button advances
- **Termination phrase screen** — Large centered text "Say it aloud:" followed by "Shutdown complete" in display font; "Done" button saves and navigates
- On Done: save `daily_shutdowns` row with `completed_at` and optional `intention`, then navigate to `/app/engage`
- Create `daily_shutdowns` table with migration:
  - Fields: `id`, `user_id`, `completed_at`, `intention` (text, optional), `created_at`, `updated_at`
  - Unique constraint: `(user_id, date(completed_at))`
  - RLS policy: users manage own shutdowns
  - Index: `(user_id, completed_at desc)`
- Exit link in page header returns to Engage without saving

**Acceptance Criteria:**
- Keyboard shortcut (Cmd/Ctrl+Shift+D) works from any authenticated view
- Header button visible on all authenticated pages
- Already-completed state shows correctly with saved data
- All three flow screens display correct data (inbox count, completed actions, intention input)
- Termination phrase screen displays correctly
- Save enforces one-per-day constraint
- Navigation to Engage works on completion and on exit
- Error handling with retry on save failure
- All queries are RLS-scoped

---

**Story 10.2: Engage Indicator + Data Export**

Display shutdown completion in Engage view and include in data export.

**Implementation:**

- Update Engage view header to display most recent shutdown timestamp
  - Query: `daily_shutdowns` order by `completed_at desc limit 1`, RLS-scoped
  - Format: "Last shutdown: 3 hours ago" or "Last shutdown: yesterday 6:42 PM"
  - Hide if no shutdown history exists
- Update data export to include `daily_shutdowns` table
  - JSON export: include `completed_at` and `intention` fields
  - Markdown export: append "Daily Shutdowns" section with chronological list
  - Respect RLS (only user's own shutdowns)

**Acceptance Criteria:**

- Indicator shows in Engage view header with natural time-since formatting
- Indicator hidden when no shutdown history
- Subtle styling (not prominent)
- Indicator updates after completing shutdown (via navigation refresh)
- Data export includes all shutdown records in both JSON and Markdown formats
- Export is RLS-scoped and chronologically ordered (newest first)

---

**Epic 10 Retrospective:** Optional
```

---

## 5. Implementation Handoff

### Change Scope Classification

**Minor** — Adds new epic with 2 stories; no modifications to existing epics or in-progress work.

### Handoff Plan

**Route to: Developer Agent** for direct implementation after Epic 5 completion.

**Responsibilities:**

1. **Update Planning Artifacts:**
   - Apply all 9 approved changes to PRD, Architecture Spine, EXPERIENCE.md, and epics.md
   - Update sprint-status.yaml to add Epic 10 entries

2. **Implementation Sequence:**
   - Wait for Epic 5 completion (dependencies: review persistence, inbox, actions)
   - Begin Epic 10 Story 10.1 (complete shutdown flow)
   - Implement Story 10.2 (Engage indicator + export)
   - Mark Epic 10 complete when both stories done

3. **Success Criteria:**
   - All FRs (FR115-FR125) implemented and verified
   - Daily shutdown accessible and functional across all devices
   - One-per-day enforcement working
   - Engage indicator showing last completion
   - Data export including shutdown history
   - No regressions in existing features

**Timeline Expectations:**

- Epic 10 estimated at 1-2 weeks implementation
- Can run in parallel with Epic 7-8 if team capacity allows
- Must complete before Epic 6 (data export depends on it)

**Next Steps:**

1. Mthizo approves this Sprint Change Proposal
2. Developer updates all planning artifacts
3. Developer waits for Epic 5 completion
4. Developer begins Epic 10 implementation

---

## Summary

**Change Type:** Strategic addition — new daily closure feature based on productivity research

**Scope:** Epic 10 (2 stories), + 11 new FRs + 1 new table + UX documentation

**Impact:**

- ✅ No existing work affected
- ✅ Clean dependencies (after Epic 5)
- ✅ Low risk (established patterns)
- ✅ High value (daily psychological benefit)

**Recommendation:** Approve and schedule Epic 10 after Epic 5, before Epic 6.

---

**Prepared by:** Kiro (bmad-correct-course workflow)  
**Date:** 2026-11-03  
**Status:** Pending user approval
