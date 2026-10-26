# Proposed Epic 9: Analytics & Goal-Gap Progress

**Status:** Added to canonical `epics.md` and `sprint-status.yaml` as Epic 9 and Stories 9.1-9.5, all `backlog`.

A signed-in user can understand what work is moving, what has been completed, and whether their self-assessed capability gaps have changed. Analytics distinguishes project progress from skill acquisition: completed projects contribute to a gap's work evidence only when explicitly linked, while capability ratings change only when the user reassesses. No scores, streaks, rankings, or automatic skill inference.

## Proposed Stories

### Story 9.1: Project and Goal Lifecycle History

Capture timestamped, user-owned status transitions for projects and goals, including first activation, pause/park/archive, completion, and reopen. Existing current status remains authoritative for current views; history supports time-window analytics. Preserve existing rows and do not fabricate old transition dates.

### Story 9.2: Stable Goal Gaps and Project Links

Give each goal skill gap a stable identity. Let a user explicitly associate one or more goal-linked projects to one or more gaps, and revise/remove those links without deleting history needed to explain prior analytics. Validate that linked projects and gaps belong to the same user and goal.

### Story 9.3: User Reassessment and Gap History

Capture immutable dated assessments for each gap, preserving the required level and the user's rating at assessment time. The user explicitly updates ratings; project completion never changes ratings. Provide an explicit reassessment entry point from goal detail and/or the monthly goal check. Mark changed requirements as a new comparison baseline rather than silently rewriting prior scores.

### Story 9.4: Goal and Project Analytics Overview

Provide a server-rendered, user-scoped `/app/analytics` view with current status counts, completed-project throughput over a selected period, goal completion counts, and clearly defined cohort completion metrics only where lifecycle history supports them. Every rate exposes its numerator, denominator, cohort/window, and as-of date. Surface data-history limitations instead of imputing history.

### Story 9.5: Gap Progress and Work Contribution

For each goal gap, show the target level, baseline and latest user-entered ratings, remaining gap, rating-change date, and linked/completed project counts. Clearly separate “work completed toward this gap” from “self-assessed gap change.” A project completion can update work counts, never skill ratings.

## Draft Acceptance Criteria

- Current status distribution and date-window completion throughput are distinguishable, with all relevant status counts visible.
- A completion rate is not shown without explicit start/end semantics and a denominator. A cohort starts when a project/goal first becomes Active, not when a newly-created Paused project is inserted.
- A project is counted at most once in first-completion throughput; reopen events remain visible and do not erase past completion history.
- Parked/paused/archived started work is not silently dropped from a cohort denominator; expose those outcome states and document any chosen exclusions.
- Existing pre-history records are labeled as lacking historical data. No dates or rating trajectories are backfilled from `updated_at` or current status.
- A gap shows linked project progress separately from rating movement. The rating difference is calculated against the unchanged requirement/baseline version; changed framework requirements start a new comparison baseline or are explicitly marked incomparable.
- Missing baseline or missing assessment history is communicated as “history starts on [date]” / “not enough history,” not zero gain.
- All reads/writes use authenticated ownership and RLS. History is user data; no analytics vendor, telemetry, or third-party tracking is introduced.
- Charts have adjacent textual values or table alternatives, do not encode meaning by color alone, work on mobile and keyboard, and use labels that state time window and denominator.

## Data Model Direction

Likely migration-backed data, subject to architecture review:

- A project/goal status-transition history table with owner, entity id, old/new status, and event timestamp; use an append-only server mutation path and stable indexes.
- Stable goal-gap rows (or equivalent IDs) and user-authored project-gap associations, with ownership/goal-match enforcement.
- Immutable goal-gap assessment snapshots storing rating, required level/version, and assessment timestamp. Keep existing `goals.skill_framework` as a compatibility/current projection during migration if needed.

Do not use `projects.updated_at` as a completion timestamp: it changes on unrelated edits. Do not infer gap relationships by parsing project names or AI prose.

## Dependencies and Order

1. Define metric semantics and lifecycle rules (including reopen/archived behavior and a completion cohort window).
2. Add transition/history and stable gap-association/assessment persistence with RLS and owner constraints.
3. Add user reassessment and project-gap linking workflows.
4. Build the analytics overview and gap-progress views from those explicit records.

## Decisions Encoded in Epic 9

- Offer 30/60/90-day cohort maturity windows. A selected cohort is eligible only after its full follow-up window; no window is claimed to be empirically optimal.
- Projects/goals paused, parked, or archived after activation remain visible in the denominator and are broken out by current status.
- Reassessment is explicitly user-triggered from both Goal detail and Monthly Goal Check; there is no automatic rating change or nudge.
- Store the required level/version on each immutable assessment snapshot; a changed target starts a labeled new comparison baseline.
- Allow many-to-many Project-gap links, explicit and user-managed, within the same parent Goal.
- Keep the first version per-gap; do not create a weighted goal-level score without a later explicit product decision.
- Add user testing for cohort-window labels, denominator comprehension, and reassessment flow before implementation is considered complete.
